/**
 * Area Model
 * ----------
 * Defines the highest-level organizational grouping in the system.
 *
 * An Area can contain multiple Branches.
 *
 * Collection name in MongoDB: "areas"
 */
const mongoose = require("mongoose"); // Imports Mongoose to define schema and interact with MongoDB.

/**
 * areaSchema
 * ----------
 * Defines the structure and validation rules
 * for Area documents stored in MongoDB.
 */
const areaSchema = new mongoose.Schema(
  {
    /**
     * areaName (String)
     * -----------------
     * Stores the name of the Area.
     *
     * required: true
     *  - Prevents creation of an Area without a name.
     */
    areaName: {
      type: String,
      required: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds:
     *  - createdAt → Date when area was created
     *  - updatedAt → Date when area was last modified
     *
     * These fields are automatically maintained by Mongoose.
     */
  { timestamps: true }
);

module.exports = mongoose.model("Area", areaSchema);
