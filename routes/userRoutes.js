const express = require('express');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.get("/profile", protect, (req,res) => {
    res.json({
        message:"You accessed a protected route",
        userId: req.userId,
    });
});

module.exports = router;