const express = require("express");

const Order = require('../models/Order');
const Return = require('../models/Return');
const User = require('../models/User');
const Product = require('../models/Product');
const protect = require('../middleware/authMiddleware')
const router = express.Router();

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

        //Required field
        if (!order || !product || !quantity || !reason) {
            return res.status(400).json({
                message: "Order, Product, Quantity, and Reason are required",
            })
        }

        //Check order belongs to logged-in seller
        const existingOrder = await Order.findOne({
            _id: order,
            seller: req.userId,
        });

        if (!existingOrder) {
            return res.status(404).json({
                message: "Order not found",
            })
        }

        //Check product belongs to logged-in seller
        const existingProduct = await Product.findOne({
            _id: product,
            seller: req.userId,
        })

        if (!existingProduct) {
            return res.status(404).json({
                message: "Product not found",
            })
        }

        //Check product actually belongs to the Order
        if (existingOrder.productId.toString() !== product.toString()) {
            return res.status(400).json({
                message: "Product does not belong to this order",
            });
        }
        //Return quantity cannot exceed ordered quantity
        if (quantity > existingOrder.quantity) {
            return res.status(400).json({
                message: "Return quantity cannot exceed order quantity",
            })
        }

        const existingReturns = await Return.find({
            order,
            seller:req.userId,
            returnStatus:{
                $ne:"Rejected",
            },
        });
        
        const alreadyReturnedQuantity = existingReturns.reduce(
            (total,item) => total + item.quantity,0
        );

       if(alreadyReturnedQuantity + quantity > existingOrder.quantity){
        return res.status(400).json({
            messagge:"Total return quantity cannot exceed order quantity",
        })
       }
        const newReturn = await Return.create({
            seller: req.userId,
            order,
            product,
            quantity,
            reason,
            returnStatus,
            returnCost,
            returnDate
        });

        res.status(201).json({
            message: "Return created successfully",
            return: newReturn
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.get("/", protect, async (req, res) => {
    try {
        const returns = await Return.find({
            seller: req.userId,
        })
            .populate("order", "orderNumber quantity orderStatus")
            .populate("product", "name sku category")
            .sort({ returnDate: -1 });

        res.status(200).json({
            count: returns.length,
            returns,
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failedwinget",
            err: err.message
        })
    }
})

router.get("/:id", protect, async (req, res) => {
    try {
        const returnData = await Return.findOne({
            _id: req.params.id,
            seller: req.userId
        })
            .populate("order", "orderNumber quantity orderStatus")
            .populate("product", "name sku category")

        if (!returnData) {
            return res.status(404).json({
                message: "Return not found",
            });
        }

        res.status(200).json({
            return: returnData,
        })
    }
    catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.put("/:id", protect, async (req, res) => {
    try {
        const {
            quantity,
            reason,
            returnStatus,
            returnCost,
            returnDate
        } = req.body;

        const existingReturn = await Return.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!existingReturn) {
            return res.status(404).json({
                message: "Return not found",
            })
        }

        if (quantity !== undefined) {
            if (quantity < 1) {
                return res.status(400).json({
                    message: "Return quantity must at least 1",
                })
            }

            const existingOrder = await Order.findOne({
                _id: existingReturn.order,
                seller: req.userId
            })

            if (!existingOrder) {
                return res.status(404).json({
                    message: "Realted Order not found",
                })
            }

            if (quantity > existingOrder.quantity) {
                return res.status(400).json({
                    message: "Return quantity cannot exceed order quantity",
                })
            }
            existingReturn.quantity = quantity;
        }

        if (reason !== undefined) {
            existingReturn.reason = reason;
        }

        if (returnStatus !== undefined) {
            existingReturn.returnStatus = returnStatus;
        }

        if (returnCost !== undefined) {
            if (returnCost < 0) {
                return res.status(400).json({
                    message: "Return cost cannot be negative",
                });
            }

            existingReturn.returnCost = returnCost;
        }

        if(returnDate !== undefined){
            existingReturn.returnDate = returnDate;
        }

        await existingReturn.save();

        res.status(200).json({
            message:"Return updated successfully",
            return:existingReturn
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.messagge
        })
    }
})

router.delete("/:id",protect, async(req,res) => {
    try{
        const existingReturn = await Return.findOne({
            _id:req.params.id,
            seller:req.userId
        });

        if(!existingReturn){
            return res.status(404).json({
                message:"Return not found",
            })
        }

        await Return.deleteOne({
            _id:existingReturn._id,
        });

        res.status(200).json({
            messagge:"Return deleted successfully",
            deleteReturnId: existingReturn._id
        })
    }catch(err){
        res.status(500).json({
            message:"Server failed",
            err:err.message
        })
    }
})
module.exports = router