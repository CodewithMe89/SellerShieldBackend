const Product = require('../models/Product');

//Get inventory Summary
const getInventorySummary = async (sellerId) => {
    const products = await Product.find({
        seller: sellerId,
    });

    let totalProducts = products.length;
    let totalUnits = 0;
    let stockValue = 0;
    let lowStockThreshold = 0;
    let outOfStockProducts = 0;

    products.forEach((product) => {
        totalUnits += product.stock;

        stockValue += product.stock * product.costPrice;

        if (product.stock === 0) {
            outOfStockProducts++;
        } else if (product.stock <= product.lowStockThreshold) {
            lowStockThreshold++;
        }
    });

    return {
        totalProducts,
        totalUnits,
        stockValue,
        lowStockThreshold,
        outOfStockProducts,
    };
};

// GET ALL INVENTORY
const getInventory = async (sellerId) => {
    const products = await Product.find({
        seller: sellerId,
    }).sort({ stock: 1 });

    const inventory = products.map((product) => {
        let stockStatus = "Healthy";

        if (product.stock === 0) {
            stockStatus = "Out of Stock";
        } else if (product.stock <= product.lowStockThreshold) {
            stockStatus = "Low Stock";
        }

        return {
            productId: product._id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            stock: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            stockValue: product.stock * product.costPrice,
            stockStatus,
        };
    });

    return inventory;
};

//Get low stock products
const getLowStockProducts = async (sellerId) => {
    const products = await Product.find({
        seller: sellerId,
    }).sort({ stock: 1 });

    const lowStockProducts = products
        .filter((product) => product.stock <= product.lowStockThreshold)
        .map((product) => ({
            productId: product._id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            stock: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            status: product.stock === 0 ? "Out of Stock" : "Low Stock",
        }));

    return lowStockProducts;
};

//adjust stock
const adjustStock = async (sellerId,productId, quantity, action) => {
    const product = await Product.findOne({
        _id: productId,
        seller: sellerId,
    });

    if (!product) {
        throw new Error("Product not found");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Quantity must be a positive integer ");
    }

    if (action !== "increase" && action !== "decrease") {
        throw new Error("Action must be increase or decrease");
    }

    if (action === "increase") {
        product.stock += quantity;
    }

    if (action === "decrease") {
        if (quantity > product.stock) {
            throw new Error("Stock cannot become negative");
        }
        product.stock -= quantity
    }

    await product.save();

    return {
        productId: product._id,
        name: product.name,
        previousStock:
            action === "increase"
                ? product.stock - quantity
                : product.stock + quantity,
        adjustment: action === "increase" ? quantity : -quantity,
        currentStock: product.stock,
        stockStatus:
            product.stock === 0
                ? "Out of Stock"
                : product.stock <= product.lowStockThreshold
                    ? "Low Stock"
                    : "Healthy",
    };
}
module.exports = { getInventorySummary, getInventory, getLowStockProducts, adjustStock }