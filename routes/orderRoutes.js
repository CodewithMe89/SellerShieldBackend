
const express = require("express");

const Order = require("../models/Order");
const Product = require("../models/Product");
const Return = require("../models/Return");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

const VALID_ORDER_STATUSES = [
    "Pending",
    "Confirmed",
    "Shipped",
    "Delivered",
    "Cancelled",
    "Returned",
];

// POST: Create an order
router.post("/", protect, async (req, res) => {
    try {
        const {
            productId,
            orderNumber,
            quantity,
            orderStatus,
            customerLocation,
            orderDate,
        } = req.body;

        if (!productId || !orderNumber?.trim() || quantity === undefined) {
            return res.status(400).json({
                message: "Product, order number and quantity are required",
            });
        }

        if (!Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).json({
                message: "Quantity must be a positive integer",
            });
        }

        if (
            orderStatus !== undefined &&
            !VALID_ORDER_STATUSES.includes(orderStatus)
        ) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }

        // A new order cannot already be returned.
        if (orderStatus === "Returned") {
            return res.status(400).json({
                message: "Create the order first, then process its return",
            });
        }

        const product = await Product.findOne({
            _id: productId,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        const normalizedOrderNumber = orderNumber.trim();

        const existingOrder = await Order.findOne({
            seller: req.userId,
            orderNumber: normalizedOrderNumber,
        });

        if (existingOrder) {
            return res.status(400).json({
                message: "Order number already exists",
            });
        }

        const initialStatus = orderStatus || "Pending";

        if (initialStatus !== "Cancelled" && product.stock < quantity) {
            return res.status(400).json({
                message: "Insufficient stock",
            });
        }

        const order = await Order.create({
            seller: req.userId,
            productId: product._id,
            orderNumber: normalizedOrderNumber,
            quantity,
            sellingPriceSnapshot: product.sellingPrice,
            costPriceSnapshot: product.costPrice,
            orderStatus: initialStatus,
            customerLocation,
            orderDate,
        });

        if (initialStatus !== "Cancelled") {
            product.stock -= quantity;
            await product.save();
        }

        return res.status(201).json({
            message: "Order created successfully",
            order,
            currentStock: product.stock,
        });
    } catch (err) {
        console.error("Create order error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// GET: All orders for the logged-in seller
router.get("/", protect, async (req, res) => {
    try {
        const orders = await Order.find({
            seller: req.userId,
        })
            .populate("productId", "name sku category")
            .sort({ createdAt: -1 });

        return res.status(200).json({
            count: orders.length,
            orders,
        });
    } catch (err) {
        console.error("Get orders error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// GET: One order
router.get("/:id", protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            seller: req.userId,
        }).populate("productId", "name sku category");

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        return res.status(200).json({ order });
    } catch (err) {
        console.error("Get order error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// PUT: Update an order
router.put("/:id", protect, async (req, res) => {
    try {
        const {
            quantity,
            orderStatus,
            customerLocation,
            orderDate,
        } = req.body;

        const order = await Order.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        const product = await Product.findOne({
            _id: order.productId,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Related product not found",
            });
        }

        if (
            quantity !== undefined &&
            (!Number.isInteger(quantity) || quantity < 1)
        ) {
            return res.status(400).json({
                message: "Quantity must be a positive integer",
            });
        }

        if (
            orderStatus !== undefined &&
            !VALID_ORDER_STATUSES.includes(orderStatus)
        ) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }

        const oldQuantity = order.quantity;
        const newQuantity =
            quantity !== undefined ? quantity : oldQuantity;

        const oldStatus = order.orderStatus;
        const newStatus =
            orderStatus !== undefined ? orderStatus : oldStatus;

        const returnRecords = await Return.find({
            order: order._id,
            seller: req.userId,
        });

        // Count only return quantities already restored to inventory.
        const restoredReturnQuantity = returnRecords.reduce(
            (total, item) => {
                return (
                    total +
                    (
                        item.returnStatus === "Completed" &&
                        item.stockRestored
                            ? item.quantity
                            : 0
                    )
                );
            },
            0
        );

        // Changing an order quantity after return records exist can
        // invalidate return limits and inventory accounting.
        if (
            quantity !== undefined &&
            newQuantity !== oldQuantity &&
            returnRecords.length > 0
        ) {
            return res.status(400).json({
                message:
                    "Order quantity cannot be changed after a return has been created",
            });
        }

        // A Returned order means its entire ordered quantity has
        // been received back. Partial returns remain Delivered.
        if (
            newStatus === "Returned" &&
            restoredReturnQuantity < newQuantity
        ) {
            return res.status(400).json({
                message:
                    "Complete the return of all ordered units before marking the order Returned",
            });
        }

        // Do not reactivate a fully returned order.
        if (
            oldStatus === "Returned" &&
            newStatus !== "Returned"
        ) {
            return res.status(400).json({
                message:
                    "A returned order cannot be moved to another status",
            });
        }

        // Inventory allocated to this order excludes units already
        // returned and restored. Cancelled orders have no allocation.
        const oldAllocatedQuantity =
            oldStatus === "Cancelled"
                ? 0
                : Math.max(0, oldQuantity - restoredReturnQuantity);

        const newAllocatedQuantity =
            newStatus === "Cancelled"
                ? 0
                : Math.max(0, newQuantity - restoredReturnQuantity);

        const stockDifference =
            newAllocatedQuantity - oldAllocatedQuantity;

        // Positive difference means additional stock is required.
        if (stockDifference > 0 && product.stock < stockDifference) {
            return res.status(400).json({
                message: "Insufficient stock for updated order",
            });
        }

        // More allocated units consume stock; fewer allocated units
        // release stock back to inventory.
        product.stock -= stockDifference;

        await product.save();

        if (quantity !== undefined) {
            order.quantity = quantity;
        }

        if (orderStatus !== undefined) {
            order.orderStatus = orderStatus;
        }

        if (customerLocation !== undefined) {
            order.customerLocation = customerLocation;
        }

        if (orderDate !== undefined) {
            order.orderDate = orderDate;
        }

        await order.save();

        return res.status(200).json({
            message: "Order updated successfully",
            order,
            currentStock: product.stock,
        });
    } catch (err) {
        console.error("Update order error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

// DELETE: Delete an order
router.delete("/:id", protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        // Preserve return history and prevent inventory mismatches.
        const existingReturns = await Return.exists({
            order: order._id,
            seller: req.userId,
        });

        if (existingReturns) {
            return res.status(400).json({
                message:
                    "This order has return records and cannot be deleted",
            });
        }

        const product = await Product.findOne({
            _id: order.productId,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Related product not found",
            });
        }

        if (order.orderStatus !== "Cancelled") {
            product.stock += order.quantity;
            await product.save();
        }

        await Order.deleteOne({
            _id: order._id,
            seller: req.userId,
        });

        return res.status(200).json({
            message: "Order deleted successfully",
            restoredStock:
                order.orderStatus !== "Cancelled"
                    ? order.quantity
                    : 0,
            currentStock: product.stock,
        });
    } catch (err) {
        console.error("Delete order error:", err);

        return res.status(500).json({
            message: "Server failed",
            error: err.message,
        });
    }
});

module.exports = router;
