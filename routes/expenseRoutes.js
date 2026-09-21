const express = require('express');
const router = express.Router();

const Expense = require('../models/Expense');
const protect = require('../middleware/authMiddleware');

router.post('/', protect, async (req, res) => {
    try {
        const { type, amount, description, date } = req.body;

        if (!type || amount === undefined) {
            return res.status(400).json({
                message: "Type and amount are required",
            })
        }

        const expense = await Expense.create({
            seller: req.userId,
            type,
            amount,
            description,
            date,
        });

        res.status(201).json({
            message: "Expense created successfully",
            expense
        })
    } catch (err) {
        res.status(500).json({
            message: "Server error",
            err: err.messagge,
        })
    }
})

router.get('/', protect, async (req, res) => {
    try {
        const expenses = await Expense.find({
            seller: req.userId
        }).sort({ date: -1 });

        res.status(200).json({
            message: "Expenses fetched successfully",
            count: expenses.length,
            expenses,
        })
    }
    catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message,
        })
    }
})

router.get("/:id", protect, async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            seller: req.userId
        })

        if (!expense) {
            return res.status(404).json({
                message: "Expense not found",
            })
        };

        res.status(200).json({
            message: "Expense fetched successfully",
            expense,
        });
    }
    catch (err) {
        res.status(500).json({
            message: "Server failed",
            err: err.message
        })
    }
})

router.put("/:id", protect, async (req, res) => {
    try {
        const expense = await Expense.findOne({
            _id: req.params.id,
            seller: req.userId,
        });

        if (!expense) {
            return res.status(404).json({
                message: "Expense not found",
            });
        }

        const {
            type,
            amount,
            description,
            date,
        } = req.body;

        if (type !== undefined) {
            expense.type = type;
        }

        if (amount !== undefined) {
            expense.amount = amount;
        }

        if (description !== undefined) {
            expense.description = description;
        }

        if (date !== undefined) {
            expense.date = date;
        }

        await expense.save();

        res.status(200).json({
            message: "Expense updated successfully",
            expense,
        });
    } catch (err) {
        res.status(500).json({
            message: "Server failed",
            err:err.message,
        });
    }
})

router.delete("/:id", protect, async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      seller: req.userId,
    });

    if (!expense) {
      return res.status(404).json({
        message: "Expense not found",
      });
    }

    await Expense.deleteOne({
      _id: expense._id,
      seller: req.userId,
    });

    res.status(200).json({
      message: "Expense deleted successfully",
    });
  } catch (err) {
    res.status(500).json({
      message: "Server error",
      err:err.message
    });
  }
});
module.exports = router;