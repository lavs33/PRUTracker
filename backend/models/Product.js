const mongoose = require("mongoose");

const PRODUCT_CATEGORIES = ["Protection", "Health", "Investment"];
const TERM_TYPES = ["FIXED_YEARS", "RANGE_TO_AGE", "UNTIL_AGE", "MIXED"];

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

    paymentTermOptions: {
      type: [
        {
          label: { type: String, trim: true, default: "" },
          type: { type: String, enum: TERM_TYPES, default: "FIXED_YEARS" },
          years: { type: Number, default: null },
          minYears: { type: Number, default: null },
          untilAge: { type: Number, default: null },
        },
      ],
      default: [],
    },
    paymentTermLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },
    coverageDurationRule: {
      label: { type: String, trim: true, default: "" },
      type: { type: String, enum: TERM_TYPES, default: "FIXED_YEARS" },
      years: { type: Number, default: null },
      minYears: { type: Number, default: null },
      untilAge: { type: Number, default: null },
    },
    coverageDurationLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);