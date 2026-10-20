const Product = require("../models/Product");
const Order = require("../models/Order");
const Return = require("../models/Return");
const Expense = require("../models/Expense");

const generateInsights = async (sellerId) => {
    const insights = [];

    //Get seller data
    const products = await Product.find({
        seller: sellerId,
    });

    const orders = await Order.find({
        seller: sellerId,
    });

    const expenses = await Expense.find({
        seller: sellerId,
    });

    const returns = await Return.find({
        seller: sellerId,
    })

    //Inventory insights

    products.forEach((product) => {
        if (product.stock === 0) {
            insights.push({
                type: "inventory",
                severity: "high",
                title: "Out of stock",
                message: `${product.name} is currently out of stock`,
                productId: product._id,
            });
        }
        else if (product.stock <= product.lowStockThreshold) {
            insights.push({
                type: "inventory",
                severity: "medium",
                title: "Low stock",
                message: `${product.name} is running low on stock`,
                productId: product._id
            });
        }
    });

    //2. Product profit insights
    const deliveredOrders = orders.filter(
        (order) => order.orderStatus === "Delivered"
    );

    const productMap = {};

    deliveredOrders.forEach((order) => {
        const productId = order.productId.toString();

        if (!productMap[productId]) {
            productMap[productId] = {
                revenue: 0,
                cost: 0,
                quantity: 0
            };
        }

        productMap[productId].revenue +=
            order.sellingPriceSnapshot * order.quantity;

        productMap[productId].cost +=
            order.costPriceSnapshot * order.quantity;

        productMap[productId].quantity += order.quantity;
    });

    for (const productId in productMap) {
        const data = productMap[productId];

        if (data.revenue > 0) {
            const profit = data.revenue - data.cost;

            const margin = (profit / data.revenue) * 100;

            const product = products.find(
                (item) => item._id.toString() === productId
            );

            if (product && margin < 10) {
                insights.push({
                    type: "profit",
                    severity: "high",
                    title: "Low profit Margin",
                    message: `${product.name} has a low profit margin of ${margin.toFixed(
                        2
                    )}%.`,
                    productId: product._id
                });
            }
        }
    }

    //3. return insights
    const returnQuantity = returns.reduce((total, item) => {
        if (
            item.returnStatus === "Approved" ||
            item.returnStatus === "Completed"
        ) {
            return total + item.quantity;
        }
        return total
    }, 0);

    const soldQuantity = deliveredOrders.reduce((total, order) => total + order.quantity, 0);

    if (soldQuantity > 0) {
        const returnRate =
            (returnQuantity / soldQuantity) * 100;

        if (returnRate > 20) {
            insights.push({
                type: "returns",
                severity: "high",
                title: "High return rate",
                message: `Your return rate is ${returnRate.toFixed(2)}%. Review products with frequent returns`,
            });

        }
    }

    //4. Advertising expense insight
    const advertisingExpense = expenses
        .filter((expense) => expense.type === "Advertising")
        .reduce((total, expense) => total + expense.amount, 0);

    if (advertisingExpense > 5000) {
        insights.push({
            type: "expense",
            severity: "medium",
            title: "High Advertising Expense",
            message: `Your advertising expenses are ₹${advertisingExpense.toFixed(2)}. Review your advertising spend and its return.`,
        });
    }
    //5. High expense ratio insight

    const totalExpenseAmount = expenses.reduce(
        (total, expense) => total + expense.amount, 0
    );

    const deliveredRevenue = deliveredOrders.reduce(
        (total, order) =>
            total + (order.sellingPriceSnapshot * order.quantity), 0
    );

    if (deliveredRevenue > 0) {
        const expenseRatio =
            (totalExpenseAmount / deliveredRevenue) * 100;

        if (expenseRatio > 50) {
            insights.push({
                type: "expense",
                severity: "high",
                title: "High Expense Ratio",
                message: `Your expenses are ${expenseRatio.toFixed(2)}
                % of your revenue. Review your operating expenses.`
            });
        }
    }

    //6. Best performing product

    let bestProduct = null;
    let highestProfit = 0;

    for (const productId in productMap) {
        const data = productMap[productId];

        const profit = data.revenue - data.cost;

        if (profit > highestProfit) {
            highestProfit = profit;
            bestProduct = productId;
        }
    }

    if (bestProduct) {
        const product = products.find(
            (item) => item._id.toString() === bestProduct
        );

        if (product) {
            insights.push({
                type: "profit",
                severity: "low",
                title: "Best Performing Product",
                message: `${product.name} is currently your highest profit-generating product with ₹${highestProfit.toFixed(
                    2
                )} profit.`,
                productId: product._id,
            })
        }
    }

    return insights;
}

module.exports = { generateInsights }