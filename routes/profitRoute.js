const express = require("express");
const router = express.Router();

const protect = require("../middleware/authMiddleware");
const {
    calculateProfit,
    calculateProductProfit,
    calculateExpenseBreakdown,
    calculateReturnAnalytics,
    getProfitSummary } = require("../services/profitService");

// GET PROFIT
router.get("/", protect, async (req, res) => {
    try {
        const profitData = await calculateProfit(req.userId);

        res.status(200).json({
            message: "Profit calculated successfully",
            profit: profitData,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Server failed",
            err: err.message,
        });
    }
});

router.get("/products", protect, async (req, res) => {
    try {
        const productProfit = await calculateProductProfit(req.userId);

        res.status(200).json({
            message: "Product-wise profit calculated successfully",
            productProfit,
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.get("/expenses", protect, async (req, res) => {
    try {
        const expenseBreakdown = await calculateExpenseBreakdown(req.userId);

        res.status(200).json({
            message: "Expense breakdown calculated successfully",
            expenses: expenseBreakdown
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.get("/returns", protect, async (req, res) => {
    try {
        const returnAnalytics = await calculateReturnAnalytics(req.userId);

        res.status(200).json({
            message: "Return analytics calculated successfully",
            returns: returnAnalytics
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})


router.get("/summary", protect, async (req, res) => {
  try {
    const summary = await getProfitSummary(req.userId);

    return res.status(200).json({
      message: "Profit summary calculated successfully",
      summary,
    });
  } catch (err) {
    console.error("GET /api/profit/summary failed:", err);

    return res.status(500).json({
      message: "Failed to calculate profit summary",
      error: err.message,
    });
  }
});

module.exports = router;