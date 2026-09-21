const express = require('express');

const Order = require("../models/Order");
const Product = require("../models/Product");
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', protect, async (req, res) => {
    try {
        const {
            productId,
            orderNumber,
            quantity,
            orderStatus,
            customerLocation,
            orderDate,
        } = req.body;

        //validated required fields

        if (!productId || !orderNumber || quantity === undefined) {
            return res.status(400).json({
                message: "Product, order number and quantity are required",
            })
        }

        if(!Number.isInteger(quantity) || quantity < 1){
            return res.status(400).json({
                message:"Quantity must be a positive integer",
            })
        }

        const product = await Product.findOne({
            _id: productId,
            seller: req.userId,
        })
        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            })
        }

        const normalizedOrderNumber = orderNumber.trim();

        const existingOrder = await Order.findOne({
            seller: req.userId,
            orderNumber:normalizedOrderNumber,
        })

        if (existingOrder) {
            return res.status(400).json({
                message: "Order number already exists",
            })
        }

        //check stock
        if (product.stock < quantity) {
            return res.status(400).json({
                message: "Insufficient stock",
            })
        }

        const validateStatus = ["Pending", "Confirmed", "Shipped", "Delivered", "Cancelled", "Returned"];

        if(orderStatus !== undefined &&
            !validateStatus.includes(orderStatus)
        ){
            return res.status(400).json({
                message:"Invalid order status",
            })
        }

        //Create order with historical price snapshot
        const order = await Order.create({
            seller: req.userId,
            productId: product._id,
            orderNumber:normalizedOrderNumber,
            quantity,
            sellingPriceSnapshot: product.sellingPrice,
            costPriceSnapshot: product.costPrice,
            orderStatus,
            customerLocation,
            orderDate,
        });
        //Reduce stock when order is not cancelled
        if (order.orderStatus !== "Cancelled") {
            product.stock -= quantity;
            await product.save();
        }

        res.status(201).json({
            message: "Order created successfullly",
            order,
        });
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})


//get-all orders of logged-in sellers
// GET ALL ORDERS OF LOGGED-IN SELLER
router.get("/", protect, async (req, res) => {
    try {
        const orders = await Order.find({
            seller: req.userId,
        })
            .populate("productId", "name sku category")
            .sort({ createdAt: -1 });

        res.status(200).json({
            count: orders.length,
            orders,
        });
    } catch (err) {
        res.status(500).json({
            message: "Server error",
            err: err.message
        });
    }
})

router.get("/:id", protect, async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            seller: req.userId
        })
        .populate('productId','name sku category')
        .sort({createdAt:-1})

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            })
        }

        res.status(200).json({
            order,
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.put('/:id', protect, async (req, res) => {
    try {
        const { quantity, orderStatus, customerLocation, orderDate } = req.body;

        const order = await Order.findOne({
            _id: req.params.id,
            seller: req.userId
        })

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            })
        }

        //find  the related product
        const product = await Product.findOne({
            _id: order.productId,
            seller: req.userId
        })

        if (!product) {
            return res.status(404).json({
                message: "Related product not found",
            })
        }

        const oldQuantity = order.quantity;
        const newQuantity = quantity !== undefined ? quantity : oldQuantity;

        if(
            quantity !== undefined &&
            (!Number.isInteger(quantity) || quantity < 1)
        ){
            return res.status(400).json({
                message:"Quantity must be a positive integer",
            })
        }

        const oldStatus = order.orderStatus;
        const validateStatus = ["Pending","Confirmed","Shipped","Delivered","Cancelled","Returned"];
        
        if(orderStatus !== undefined && !validateStatus.includes(orderStatus)){
            return res.status(400).json({
                message:"Invalid order status",
            })
        }
        const newStatus = orderStatus !== undefined ? orderStatus : oldStatus;

        const oldAffectsStock = oldStatus !== "Cancelled";
        const newAffectsStock = newStatus !== "Cancelled";

        if (oldAffectsStock && newAffectsStock) {
            const difference = newQuantity - oldQuantity;

            if (difference > 0) {
                if (product.stock < difference) {
                    return res.status(400).json({
                        message: "Insufficient stock for updated quantity"
                    });
                }
                product.stock -= difference;
            }
            if (difference < 0) {
                product.stock += Math.abs(difference)
            }
        }

        if (oldAffectsStock && !newAffectsStock) {
            product.stock += oldQuantity;
        }

        if (!oldAffectsStock && newAffectsStock) {
            if (product.stock < newQuantity) {
                return res.status(400).json({
                    message: "Insufficient stock",
                })
            }
            product.stock -= newQuantity;
        }

        //save product stock
        await product.save();

        // Update order fields
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

        res.status(200).json({
            message: "Order updated successfully",
            order,
            currentStock: product.stock,
        });

    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.delete('/:id',protect,async(req,res) => {
    try{
        const order = await Order.findOne({
            _id:req.params.id,
            seller:req.userId
        })

        if(!order){
            return res.status(404).json({
                message:"Order not found",
            })
        }

        const product = await Product.findOne({
            _id:order.productId,
            seller:req.userId
        })

        if(!product){
            return res.status(404).json({
                message:"Related product not found",
            })
        }

        if(order.orderStatus !== "Cancelled"){
            product.stock += order.quantity;
            await product.save();
        }

        await Order.deleteOne({
            _id:req.params.id,
            seller:req.userId
        });

        res.status(200).json({
            message:"Order deleted successfully",
            restoredStock:
            order.orderStatus !== "Cancelled" ? order.quantity : 0,
            currentStock: product.stock,
        })
    }catch(err){
        res.status(500).json({
            message:"Server failed",
            err:err.message
        })
    }
})
module.exports = router