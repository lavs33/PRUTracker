/**
 * Branch Model
 * ------------
 * Defines a Branch within the organizational hierarchy.
 *
 * A Branch belongs to one Area.
 * A Branch can contain multiple Units.
 *
 * Collection name in MongoDB: "branches"
 */
const mongoose = require("mongoose"); // Imports Mongoose to define schema structure and manage MongoDB interaction.

/**
 * branchSchema
 * ------------
 * Defines the structure and validation rules
 * for Branch documents stored in MongoDB.
 */
const branchSchema = new mongoose.Schema(
  {
    /**
     * branchName (String)
     * -------------------
     * Stores the name of the branch.
     *
     * required: true
     *  - Prevents saving a Branch document without a name.
     */
    branchName: {
      type: String,
      required: true,
    },

    /**
     * areaId (ObjectId reference to Area)
     * -----------------------------------
     * Links this Branch to a specific Area.
     *
     * type: mongoose.Schema.Types.ObjectId
     *  - Stores a MongoDB ObjectId.
     *
     * ref: "Area"
     *  - Establishes a reference to the Area model.
     *  - Enables populate("areaId") to retrieve related area data.
     *
     * required: true
     *  - Ensures every Branch is assigned to an Area.
     */
    areaId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Area",
      required: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds:
     *  - createdAt → Date when branch was created
     *  - updatedAt → Date when branch was last modified
     *
     * Managed automatically by Mongoose.
     */
  { timestamps: true }
);

module.exports = mongoose.model("Branch", branchSchema);
