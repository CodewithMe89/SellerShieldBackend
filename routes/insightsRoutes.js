const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const { generateInsights } = require("../services/insightServices");

//Gett business insights
router.get("/", protect, async (req, res) => {
    try {
        const insights = await generateInsights(req.userId);

        res.status(200).json({
            message: "Business insights generated successfully",
            count: insights.length,
            insights
        })
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }

})

module.exports = router;