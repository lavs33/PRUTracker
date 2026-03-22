/**
 * Product Model
 * -------------
 * Stores product-catalog metadata used throughout needs assessment,
 * proposal generation, application, and policy issuance flows.
 */
const mongoose = require("mongoose");

/** Shared enums for product payment/coverage term rules. */
const PRODUCT_CATEGORIES = ["Protection", "Health", "Investment"];
const TERM_TYPES = ["FIXED_YEARS", "RANGE_TO_AGE", "UNTIL_AGE", "MIXED"];

/**
 * productSchema
 * -------------
 * Captures display metadata plus structured term rules used by the UI.
 */
const productSchema = new mongoose.Schema(
  {
    /** Human-readable product name shown in product selectors and documents. */
    productName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    /** High-level product bucket used to match needs priorities. */
    productCategory: {
      type: String,
      enum: PRODUCT_CATEGORIES,
      required: true,
      trim: true,
    },

    /** Marketing / explainer description shown in the UI. */
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    /** Structured payment term options the UI can render/select from. */
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

    /** Optional flattened label used in quick displays/reports. */
    paymentTermLabel: {
      type: String,
      default: "",
      trim: true,
      maxlength: 150,
    },

    /** Structured rule for how long the product coverage lasts. */
    coverageDurationRule: {
      label: { type: String, trim: true, default: "" },
      type: { type: String, enum: TERM_TYPES, default: "FIXED_YEARS" },
      years: { type: Number, default: null },
      minYears: { type: Number, default: null },
      untilAge: { type: Number, default: null },
    },

    /** Optional flattened coverage-duration label for UI convenience. */
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
