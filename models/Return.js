const mongoose = require("mongoose");

const returnSchema = new mongoose.Schema(
  {
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: "Return quantity must be a positive integer",
      },
    },

    reason: {
      type: String,
      enum: [
        "Damaged Product",
        "Wrong Product",
        "Size Issue",
        "Quality Issue",
        "Customer Changed Mind",
        "Other",
      ],
      required: true,
    },

    returnStatus: {
      type: String,
      enum: [
        "Requested",
        "Approved",
        "Pending",
        "Rejected",
        "Completed",
      ],
      default: "Requested",
    },

    returnCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },

    returnDate: {
      type: Date,
      default: Date.now,
    },

    stockRestored: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Return = mongoose.model("Return", returnSchema);

module.exports = Return;
