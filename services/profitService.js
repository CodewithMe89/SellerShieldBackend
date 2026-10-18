const Order = require('../models/Order');
const Expense = require('../models/Expense');
const Return = require('../models/Return');

const calculateProfit = async (sellerId) => {
    // 1. Get delivered Orders
    const orders = await Order.find({
        seller: sellerId,
        orderStatus: "Delivered",
    })

    //2. Calculate revenue and product cost
    let revenue = 0;
    let productCost = 0;

    orders.forEach((order) => {
        revenue += order.sellingPriceSnapshot * order.quantity;

        productCost += order.costPriceSnapshot * order.quantity;
    })

    //3. Get all expenses
    const expenses = await Expense.find({
        seller: sellerId,
    })

    let totalExpenses = 0;

    expenses.forEach((expense) => {
        totalExpenses += expense.amount;
    })

    //4. Get completed Returns
    const returns = await Return.find({
        seller: sellerId,
        returnStatus: "Completed",
    })

    let returnCost = 0;

    returns.forEach((item) => {
        returnCost += item.returnCost
    })

    //5. calculate gross profit
    const grossProfit = revenue - productCost;

    //6. calculate net profit
    const netProfit = grossProfit - totalExpenses - returnCost;

    //7. Calculate Profit Margin
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    return {
        revenue,
        productCost,
        totalExpenses,
        returnCost,
        grossProfit,
        netProfit,
        profitMargin: Number(profitMargin.toFixed(2)),
        deliveredOrders: orders.length,
        completedReturns: returns.length,
    };
};

const calculateExpenseBreakdown = async(sellerId) => {
    const expenses = await Expense.find({
        seller:sellerId,
    }) 

    const expenseBreakdown = {
        platformFee : 0,
        shipping: 0,
        advertising: 0,
        packaging: 0,
        other: 0,
        total: 0,
    };

    expenses.forEach((expense) => {
        switch(expense.type){
            case "Platform Fee" :
                expenseBreakdown.platformFee += expense.amount;
                break;
            case "Shipping" :
                expenseBreakdown.shipping += expense.amount;
                break;
            case "Advertising":
                expenseBreakdown.advertising += expense.amount;
                break;
            case "Packaging" :
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
}


const calculateProductProfit = async (sellerId) => {
    // Get only delivered Orders
    const orders = await Order.find({
        seller: sellerId,
        orderStatus: "Delivered",
    }).populate("productId", "name sku category");

    const productMap = {};

    orders.forEach((order) => {
        // Skip orders where productId was deleted or null
        if (!order.productId) return;

        const productId = order.productId._id.toString();

        if (!productMap[productId]) {
            productMap[productId] = {
                productId: order.productId._id,
                productName: order.productId.name || "Unknown Product",
                sku: order.productId.sku || "N/A",
                category: order.productId.category || "Uncategorized",
                quantitySold: 0,
                revenue: 0,
                productCost: 0,
            };
        }

        productMap[productId].quantitySold += order.quantity || 0;
        productMap[productId].revenue += (order.sellingPriceSnapshot || 0) * (order.quantity || 0);
        productMap[productId].productCost += (order.costPriceSnapshot || 0) * (order.quantity || 0);
    });

    // Convert object into array and calculate Profits
    const productProfit = Object.values(productMap).map((product) => {
        const profit = product.revenue - product.productCost;

        const margin = product.revenue > 0
            ? (profit / product.revenue) * 100
            : 0;

        return {
            ...product,
            profit,
            margin: Number(margin.toFixed(2))
        };
    });

    return productProfit;
};

//Caluclate returns analytics
const calculateReturnAnalytics = async(sellerId) =>{
    const returns = await Return.find({
        seller:sellerId
    });

    //get delivered orders
    const deliveredOrders = await Order.find({
        seller:sellerId,
        orderStatus:"Delivered",
    });

    let returnedQuantity = 0;

    returns.forEach((item) => {
        if(
            item.returnStatus == "Approved" ||
            item.returnStatus == "Completed"
        ){
            returnedQuantity += item.quantity;
        }
    });

    let soldQuantity = 0;

    deliveredOrders.forEach((order) => {
        soldQuantity += order.quantity;
    })

    //Return rate

    const returnRate = 
    soldQuantity > 0
    ? (returnedQuantity / soldQuantity) * 100
    : 0;

    const reasonBreakdown = {};

    returns.forEach((item) => {
        if(item.returnStatus === "Approved" ||
            item.returnStatus === "Completed"
        ){
            if(!reasonBreakdown[item.reason]){
                reasonBreakdown[item.reason] = 0;
            }

            reasonBreakdown[item.reason] += item.quantity;
        }
    });

    let completedReturnCost = 0;
    returns.forEach((item) => {
        if(item.returnStatus === "Completed"){
            completedReturnCost += item.returnCost;
        }
    });

    return{
        soldQuantity,
        returnedQuantity,
        returnRate : Number(returnRate.toFixed(2)),
        completedReturnCost,
        reasonBreakdown,
    }

}

const getProfitSummary = async(sellerId) => {
    const profit = await calculateProfit(sellerId);

    const productProfit = await calculateProductProfit(sellerId);
    
    const expenses = await calculateExpenseBreakdown(sellerId);

    const returns = await calculateReturnAnalytics(sellerId);

    return {
        overview:{
            revenue: profit.revenue,
            productCost: profit.productCost,
            grossProfit: profit.grossProfit,
            totalExpenses: profit.totalExpenses,
            returnCost: profit.returnCost,
            netProfit: profit.netProfit,
            profitMargin: profit.profitMargin
        },

        orders:{
            deliveredOrders:profit.deliveredOrders
        },

        expenses,

        returns,

        productProfit,
    }
}
module.exports = { calculateProfit,
    calculateExpenseBreakdown,
    calculateProductProfit, 
    calculateReturnAnalytics,
    getProfitSummary };

