const express = require('express');
const router = express.Router();
const protect = require("../middleware/authMiddleware");

const {
    getInventorySummary,
    getInventory,
    getLowStockProducts,
    adjustStock
    } = require("../services/inventoryServices");

//get inventory summary
router.get("/summary", protect, async(req,res)=> {
    try{
        const summary = await getInventorySummary(req.userId);

        res.status(200).json({
            message:"Inventory summary calculated Successfully",
            inventory:summary
        })
    }catch(err){
        res.status(500).json({
            message:"Server failed",
            err:err.message
        })
    }
})

// GET LOW STOCK PRODUCTS
router.get("/low-stock", protect, async (req, res) => {
  try {
    const lowStockProducts = await getLowStockProducts(
      req.userId
    );

    res.status(200).json({
      message: "Low stock products fetched successfully",
      count: lowStockProducts.length,
      products: lowStockProducts,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server failed",
      err: err.message,
    });
  }
});

//get all inventory
router.get("/", protect, async (req, res) => {
  try {
    const inventory = await getInventory(req.userId);

    res.status(200).json({
      message: "Inventory fetched successfully",
      count: inventory.length,
      inventory,
    });
  } catch (err) {
    res.status(500).json({
      message: "Server failed",
      err: err.message,
    });
  }
});

//adjust stock
router.put("/:id/stock", protect, async(req,res) => {
    try{
        const {quantity, action} = req.body;

        
        if(quantity === undefined || !action){
            return res.status(400).json({
                message:"Quantity and action are required",
            })
        }

        const result = await adjustStock(
            req.userId,
            req.params.id,
            quantity,
            action
        );

        res.status(200).json({
            message:"Stock adjusted successfully",
            inventory: result,
        })
    }catch(err){
       if(err.message === "Product not found" ||
        err.message === "Quantity must be a positive integer" ||
        err.message === "Action must be increase or decrease" ||
        err.message === "Stock cannot become negative"
       ) {
        return res.status(400).json({
            message:err.message
        })
       }

       res.status(500).json({
        message:"Server failed",
        err:err.message
       })
    }
})
module.exports = router;