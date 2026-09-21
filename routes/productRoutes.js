const express = require("express");

const Product = require("../models/Product");
const protect = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/", protect, async (req, res) => {
    try {
        const {
            name,
            sku,
            category,
            sellingPrice,
            costPrice,
            stock,
            lowStockThreshold,
            description,
        } = req.body;

        if (!name || !sku || !category) {
            return res.status(400).json({
                message: "Name, SKU, and category are required",
            });
        }

        if (
            sellingPrice === undefined ||
            costPrice === undefined ||
            stock === undefined ||
            lowStockThreshold === undefined
        ) {
            return res.status(400).json({
                message:
                    "Selling price, cost price, stock, and low stock threshold are required",
            });
        }

        if (
            !Number.isFinite(sellingPrice) ||
            !Number.isFinite(costPrice) ||
            !Number.isFinite(stock) ||
            !Number.isFinite(lowStockThreshold)
        ) {
            return res.status(400).json({
                message:
                    "Prices, stock, and low stock threshold must be valid numbers",
            });
        }

        if (
            sellingPrice < 0 ||
            costPrice < 0 ||
            stock < 0 ||
            lowStockThreshold < 0
        ) {
            return res.status(400).json({
                message:
                    "Prices, stock, and low stock threshold cannot be negative",
            });
        }

        if (
            !Number.isInteger(stock) ||
            !Number.isInteger(lowStockThreshold)
        ) {
            return res.status(400).json({
                message:
                    "Stock and low stock threshold must be integers",
            });
        }

        const normalizedSku = sku.trim().toUpperCase();

        const existingProduct = await Product.findOne({
            seller: req.userId,
            sku: normalizedSku,
        });

        if (existingProduct) {
            return res.status(400).json({
                message: "Product with this SKU already exists",
            });
        }

        const product = await Product.create({
            seller: req.userId,
            name: name.trim(),
            sku: normalizedSku,
            category: category.trim(),
            sellingPrice,
            costPrice,
            stock,
            lowStockThreshold,
            description: description?.trim() || "",
        });

        res.status(201).json({
            message: "Product created successfully",
            product,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server error",
        });
    }
});

router.get("/", protect, async (req, res) => {
    try {
        const products = await Product.find({
            seller: req.userId,
        }).sort({ createdAt: -1 });

        res.status(200).json({
            count: products.length,
            products,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server error",
        });
    }
});


router.get("/:id", protect, async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        res.status(200).json({
            product,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server error",
        });
    }
});

router.put("/:id", protect, async (req, res) => {
    try {
        const {
            name,
            sku,
            category,
            sellingPrice,
            costPrice,
            stock,
            lowStockThreshold,
            description,
        } = req.body;

        const product = await Product.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        if (sku !== undefined) {
            if (typeof sku !== "string" || !sku.trim()) {
                return res.status(400).json({
                    message: "SKU must be a valid non-empty string",
                });
            }

            const normalizedSku = sku.trim().toUpperCase();

            const duplicateProduct = await Product.findOne({
                seller: req.userId,
                sku: normalizedSku,
                _id: { $ne: req.params.id },
            });

            if (duplicateProduct) {
                return res.status(400).json({
                    message: "Product with this SKU already exists",
                });
            }

            product.sku = normalizedSku;
        }

        if (
            sellingPrice !== undefined &&
            (!Number.isFinite(sellingPrice) || sellingPrice < 0)
        ) {
            return res.status(400).json({
                message: "Selling price must be a non-negative number",
            });
        }

        if (
            costPrice !== undefined &&
            (!Number.isFinite(costPrice) || costPrice < 0)
        ) {
            return res.status(400).json({
                message: "Cost price must be a non-negative number",
            });
        }

        if (
            stock !== undefined &&
            (!Number.isInteger(stock) || stock < 0)
        ) {
            return res.status(400).json({
                message: "Stock must be a non-negative integer",
            });
        }

        if (
            lowStockThreshold !== undefined &&
            (!Number.isInteger(lowStockThreshold) ||
                lowStockThreshold < 0)
        ) {
            return res.status(400).json({
                message:
                    "Low stock threshold must be a non-negative integer",
            });
        }

        if (name !== undefined) {
            if (typeof name !== "string" || !name.trim()) {
                return res.status(400).json({
                    message: "Name must be a valid non-empty string",
                });
            }

            product.name = name.trim();
        }

        if (category !== undefined) {
            if (typeof category !== "string" || !category.trim()) {
                return res.status(400).json({
                    message:
                        "Category must be a valid non-empty string",
                });
            }

            product.category = category.trim();
        }

        if (sellingPrice !== undefined) {
            product.sellingPrice = sellingPrice;
        }

        if (costPrice !== undefined) {
            product.costPrice = costPrice;
        }

        if (stock !== undefined) {
            product.stock = stock;
        }

        if (lowStockThreshold !== undefined) {
            product.lowStockThreshold = lowStockThreshold;
        }

        if (description !== undefined) {
            if (typeof description !== "string") {
                return res.status(400).json({
                    message: "Description must be a string",
                });
            }

            product.description = description.trim();
        }

        const updatedProduct = await product.save();

        res.status(200).json({
            message: "Product updated successfully",
            product: updatedProduct,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server error",
        });
    }
});

router.delete("/:id", protect, async (req, res) => {
    try {
        const product = await Product.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!product) {
            return res.status(404).json({
                message: "Product not found",
            });
        }

        await Product.deleteOne({
            _id: req.params.id,
            seller: req.userId,
        });

        res.status(200).json({
            message: "Product deleted successfully",
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server error",
        });
    }
});


module.exports = router;