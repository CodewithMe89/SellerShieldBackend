
const Order = require("../models/Order");
const Expense = require("../models/Expense");
const Return = require("../models/Return");

// Only these orders represent sales that were actually delivered
// or subsequently returned. Cancelled orders are excluded.
const getRelevantOrders = (sellerId) =>
    Order.find({
        seller: sellerId,
        orderStatus: { $in: ["Delivered", "Returned"] },
    });

// Returns that have actually been completed and received
const getCompletedReturns = (sellerId) =>
    Return.find({
        seller: sellerId,
        returnStatus: "Completed",
    });

const calculateProfit = async (sellerId) => {
    const [orders, expenses, returns] = await Promise.all([
        getRelevantOrders(sellerId),
        Expense.find({ seller: sellerId }),
        getCompletedReturns(sellerId),
    ]);

    // Total completed return quantity for each order
    const returnedByOrder = new Map();

    returns.forEach((item) => {
        const orderId = item.order.toString();

        returnedByOrder.set(
            orderId,
            (returnedByOrder.get(orderId) || 0) + item.quantity
        );
    });

    let revenue = 0;
    let productCost = 0;
    let totalExpenses = 0;

    orders.forEach((order) => {
        const returnedQuantity =
            returnedByOrder.get(order._id.toString()) || 0;

        const retainedQuantity = Math.max(
            0,
            order.quantity - returnedQuantity
        );

        revenue +=
            (order.sellingPriceSnapshot || 0) * retainedQuantity;

        productCost +=
            (order.costPriceSnapshot || 0) * retainedQuantity;
    });

    expenses.forEach((expense) => {
        totalExpenses += expense.amount || 0;
    });

    // Return cost is counted once per completed return record
    const returnCost = returns.reduce(
        (total, item) => total + (item.returnCost || 0),
        0
    );

    const grossProfit = revenue - productCost;
    const netProfit = grossProfit - totalExpenses - returnCost;

    const profitMargin =
        revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
        revenue,
        productCost,
        totalExpenses,
        returnCost,
        grossProfit,
        netProfit,
        profitMargin: Number(profitMargin.toFixed(2)),
        deliveredOrders: orders.filter(
            (order) => order.orderStatus === "Delivered"
        ).length,
        completedReturns: returns.length,
    };
};

const calculateExpenseBreakdown = async (sellerId) => {
    const expenses = await Expense.find({ seller: sellerId });

    const expenseBreakdown = {
        platformFee: 0,
        shipping: 0,
        advertising: 0,
        packaging: 0,
        other: 0,
        total: 0,
    };

    expenses.forEach((expense) => {
        switch (expense.type) {
            case "Platform Fee":
                expenseBreakdown.platformFee += expense.amount;
                break;
            case "Shipping":
                expenseBreakdown.shipping += expense.amount;
                break;
            case "Advertising":
                expenseBreakdown.advertising += expense.amount;
                break;
            case "Packaging":
                expenseBreakdown.packaging += expense.amount;
                break;
            case "Other":
                expenseBreakdown.other += expense.amount;
                break;
        }
    });

    expenseBreakdown.total =
        expenseBreakdown.platformFee +
        expenseBreakdown.shipping +
        expenseBreakdown.advertising +
        expenseBreakdown.packaging +
        expenseBreakdown.other;

    return expenseBreakdown;
};

const calculateProductProfit = async (sellerId) => {
    const [orders, returns] = await Promise.all([
        getRelevantOrders(sellerId).populate(
            "productId",
            "name sku category"
        ),
        getCompletedReturns(sellerId),
    ]);

    const returnedByOrder = new Map();

    returns.forEach((item) => {
        const orderId = item.order.toString();

        returnedByOrder.set(
            orderId,
            (returnedByOrder.get(orderId) || 0) + item.quantity
        );
    });

    const productMap = {};

    orders.forEach((order) => {
        if (!order.productId) return;

        const productId = order.productId._id.toString();

        const returnedQuantity =
            returnedByOrder.get(order._id.toString()) || 0;

        const retainedQuantity = Math.max(
            0,
            order.quantity - returnedQuantity
        );

        if (!productMap[productId]) {
            productMap[productId] = {
                productId: order.productId._id,
                productName: order.productId.name || "Unknown Product",
                sku: order.productId.sku || "N/A",
                category: order.productId.category || "Uncategorized",
                quantitySold: 0,
                returnedQuantity: 0,
                revenue: 0,
                productCost: 0,
            };
        }

        const product = productMap[productId];

        product.quantitySold += retainedQuantity;
        product.returnedQuantity += returnedQuantity;

        product.revenue +=
            (order.sellingPriceSnapshot || 0) * retainedQuantity;

        product.productCost +=
            (order.costPriceSnapshot || 0) * retainedQuantity;
    });

    return Object.values(productMap).map((product) => {
        const profit = product.revenue - product.productCost;

        const margin =
            product.revenue > 0
                ? (profit / product.revenue) * 100
                : 0;

        return {
            ...product,
            profit,
            margin: Number(margin.toFixed(2)),
        };
    });
};

const calculateReturnAnalytics = async (sellerId) => {
    const [returns, orders] = await Promise.all([
        Return.find({ seller: sellerId }),
        getRelevantOrders(sellerId),
    ]);

    // Denominator: total units in delivered/returned orders
    const soldQuantity = orders.reduce(
        (total, order) => total + order.quantity,
        0
    );

    // Only completed returns count as physically returned units
    const completedReturns = returns.filter(
        (item) => item.returnStatus === "Completed"
    );

    const returnedQuantity = completedReturns.reduce(
        (total, item) => total + item.quantity,
        0
    );

    const returnRate =
        soldQuantity > 0
            ? (returnedQuantity / soldQuantity) * 100
            : 0;

    const reasonBreakdown = {};

    returns.forEach((item) => {
        if (
            item.returnStatus === "Approved" ||
            item.returnStatus === "Completed"
        ) {
            reasonBreakdown[item.reason] =
                (reasonBreakdown[item.reason] || 0) + item.quantity;
        }
    });

    const completedReturnCost = completedReturns.reduce(
        (total, item) => total + (item.returnCost || 0),
        0
    );

    return {
        soldQuantity,
        returnedQuantity,
        returnRate: Number(returnRate.toFixed(2)),
        completedReturnCost,
        reasonBreakdown,
    };
};

const getProfitSummary = async (sellerId) => {
    const [
        profit,
        productProfit,
        expenses,
        returns,
    ] = await Promise.all([
        calculateProfit(sellerId),
        calculateProductProfit(sellerId),
        calculateExpenseBreakdown(sellerId),
        calculateReturnAnalytics(sellerId),
    ]);

    return {
        overview: {
            revenue: profit.revenue,
            productCost: profit.productCost,
            grossProfit: profit.grossProfit,
            totalExpenses: profit.totalExpenses,
            returnCost: profit.returnCost,
            netProfit: profit.netProfit,
            profitMargin: profit.profitMargin,
        },
        orders: {
            deliveredOrders: profit.deliveredOrders,
        },
        expenses,
        returns,
        productProfit,
    };
};

module.exports = {
    calculateProfit,
    calculateExpenseBreakdown,
    calculateProductProfit,
    calculateReturnAnalytics,
    getProfitSummary,
};
