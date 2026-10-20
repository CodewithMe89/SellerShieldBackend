
const express = require("express");

const Order = require("../models/Order");
const Return = require("../models/Return");
const Product = require("../models/Product");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const VALID_RETURN_STATUSES = [
    "Requested",
    "Approved",
    "Pending",
    "Rejected",
    "Completed",
];

// Helper: validate return status
const isValidReturnStatus = (status) =>
    VALID_RETURN_STATUSES.includes(status);

// Helper: validate quantity
const isValidQuantity = (quantity) =>
    Number.isInteger(quantity) && quantity >= 1;

// POST: Create a return
router.post("/", protect, async (req, res) => {
    try {
        const {
            order,
            product,
            quantity,
            reason,
            returnStatus,
            returnCost,
            returnDate,
        } = req.body;

        if (!order || !product || quantity === undefined || !reason) {
            return res.status(400).json({
                message: "Order, Product, Quantity, and Reason are required",
            });
        }

        if (!isValidQuantity(quantity)) {
            return res.status(400).json({
                message: "Return quantity must be a positive integer",
            });
        }

        if (
            returnStatus !== undefined &&
            !isValidReturnStatus(returnStatus)
        ) {
            return res.status(400).json({
                message: "Invalid return status",
            });
        }

        if (
            returnCost !== undefined &&
            (!Number.isFinite(returnCost) || returnCost < 0)
        ) {
            return res.status(400).json({
                message: "Return cost must be a non-negative number",
            });
        }

        const effectiveStatus = returnStatus || "Requested";

        const existingOrder = await Order.findOne({
            _id: order,
            seller: req.userId,
        });

        if (!existingOrder) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        if (!["Delivered", "Returned"].includes(existingOrder.orderStatus)) {
            return res.status(400).json({
                message: "Only delivered orders can be returned",
            });
        }

        const existingProduct = await Product.findOne({
            _id: product,
            seller: req.userId,
        });

        if (!existingProduct) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        if (
            !existingOrder.productId ||
            existingOrder.productId.toString() !== product.toString()
        ) {
            return res.status(400).json({
                message: "Product does not belong to this order",
            });
        }

        const existingReturns = await Return.find({
            order,
            seller: req.userId,
            returnStatus: { $ne: "Rejected" },
        });

        const alreadyReturnedQuantity = existingReturns.reduce(
            (total, item) => total + item.quantity,
            0
        );

        if (
            alreadyReturnedQuantity + quantity >
            existingOrder.quantity
        ) {
            return res.status(400).json({
                message:
                    "Total return quantity cannot exceed order quantity",
            });
        }

        const newReturn = await Return.create({
            seller: req.userId,
            order,
            product,
            quantity,
            reason,
            returnStatus: effectiveStatus,
            returnCost: returnCost ?? 0,
            returnDate,
            stockRestored: false,
        });

        // Only Completed returns are considered physically received.
        if (effectiveStatus === "Completed") {
            existingProduct.stock += quantity;
            await existingProduct.save();

            newReturn.stockRestored = true;
            await newReturn.save();
        }

        return res.status(201).json({
            message: "Return created successfully",
            return: newReturn,
            currentStock: existingProduct.stock,
        });
    } catch (err) {
        console.error("Create return error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// GET: All returns for the logged-in seller
router.get("/", protect, async (req, res) => {
    try {
        const returns = await Return.find({
            seller: req.userId,
        })
            .populate("order", "orderNumber quantity orderStatus")
            .populate("product", "name sku category")
            .sort({ returnDate: -1 });

        return res.status(200).json({
            count: returns.length,
            returns,
        });
    } catch (err) {
        console.error("Get returns error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// GET: One return
router.get("/:id", protect, async (req, res) => {
    try {
        const returnData = await Return.findOne({
            _id: req.params.id,
            seller: req.userId,
        })
            .populate("order", "orderNumber quantity orderStatus")
            .populate("product", "name sku category");

        if (!returnData) {
            return res.status(404).json({
                message: "Return not found",
            });
        }

        return res.status(200).json({
            return: returnData,
        });
    } catch (err) {
        console.error("Get return error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// PUT: Update a return
router.put("/:id", protect, async (req, res) => {
    try {
        const {
            quantity,
            reason,
            returnStatus,
            returnCost,
            returnDate,
        } = req.body;

        const existingReturn = await Return.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!existingReturn) {
            return res.status(404).json({
                message: "Return not found",
            });
        }

        if (
            returnStatus !== undefined &&
            !isValidReturnStatus(returnStatus)
        ) {
            return res.status(400).json({
                message: "Invalid return status",
            });
        }

        if (
            quantity !== undefined &&
            !isValidQuantity(quantity)
        ) {
            return res.status(400).json({
                message: "Return quantity must be a positive integer",
            });
        }

        if (
            returnCost !== undefined &&
            (!Number.isFinite(returnCost) || returnCost < 0)
        ) {
            return res.status(400).json({
                message: "Return cost must be a non-negative number",
            });
        }

        // Once stock is restored, do not allow changes that could
        // invalidate the stock adjustment.
        if (
            existingReturn.stockRestored &&
            (
                quantity !== undefined &&
                quantity !== existingReturn.quantity
            )
        ) {
            return res.status(400).json({
                message:
                    "Quantity cannot be changed after stock has been restored",
            });
        }

        if (
            existingReturn.stockRestored &&
            returnStatus !== undefined &&
            returnStatus !== "Completed"
        ) {
            return res.status(400).json({
                message:
                    "A completed, restocked return cannot be moved to another status",
            });
        }

        const existingOrder = await Order.findOne({
            _id: existingReturn.order,
            seller: req.userId,
        });

        if (!existingOrder) {
            return res.status(404).json({
                message: "Related order not found",
            });
        }

        // Exclude this return when calculating other reserved quantities.
        const otherReturns = await Return.find({
            _id: { $ne: existingReturn._id },
            order: existingReturn.order,
            seller: req.userId,
            returnStatus: { $ne: "Rejected" },
        });

        const otherReturnQuantity = otherReturns.reduce(
            (total, item) => total + item.quantity,
            0
        );

        const newQuantity =
            quantity !== undefined
                ? quantity
                : existingReturn.quantity;

        const newStatus =
            returnStatus !== undefined
                ? returnStatus
                : existingReturn.returnStatus;

        if (
            newStatus !== "Rejected" &&
            otherReturnQuantity + newQuantity > existingOrder.quantity
        ) {
            return res.status(400).json({
                message:
                    "Total return quantity cannot exceed order quantity",
            });
        }

        // If this return is being completed for the first time,
        // restore its quantity once.
        if (
            newStatus === "Completed" &&
            !existingReturn.stockRestored
        ) {
            const product = await Product.findOne({
                _id: existingReturn.product,
                seller: req.userId,
            });

            if (!product) {
                return res.status(404).json({
                    message: "Related product not found",
                });
            }

            product.stock += newQuantity;
            await product.save();

            existingReturn.stockRestored = true;
        }

        if (quantity !== undefined) {
            existingReturn.quantity = quantity;
        }

        if (reason !== undefined) {
            existingReturn.reason = reason;
        }

        if (returnStatus !== undefined) {
            existingReturn.returnStatus = returnStatus;
        }

        if (returnCost !== undefined) {
            existingReturn.returnCost = returnCost;
        }

        if (returnDate !== undefined) {
            existingReturn.returnDate = returnDate;
        }

        await existingReturn.save();

        return res.status(200).json({
            message: "Return updated successfully",
            return: existingReturn,
        });
    } catch (err) {
        console.error("Update return error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// DELETE: Delete a return
router.delete("/:id", protect, async (req, res) => {
    try {
        const existingReturn = await Return.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!existingReturn) {
            return res.status(404).json({
                message: "Return not found",
            });
        }

        // Do not delete a restocked return: doing so would lose the
        // record needed to explain the inventory adjustment.
        if (existingReturn.stockRestored) {
            return res.status(400).json({
                message:
                    "A restocked return cannot be deleted",
            });
        }

        await Return.deleteOne({
            _id: existingReturn._id,
            seller: req.userId,
        });

        return res.status(200).json({
            message: "Return deleted successfully",
            deleteReturnId: existingReturn._id,
        });
    } catch (err) {
        console.error("Delete return error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

module.exports = router;
