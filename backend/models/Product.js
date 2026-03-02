const mongoose = require("mongoose");

const PRODUCT_CATEGORIES = ["Protection", "Health", "Investment", "Accident"];

const productSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    productCategory: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
