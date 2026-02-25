/**
 * Unit Model
 * ----------
 * Defines an organizational Unit within the system.
 *
 * A Unit belongs to one Branch and can have multiple Agents.
 *
 * Collection name in MongoDB: "units"
 */
const mongoose = require("mongoose"); // Imports Mongoose to define schema structure and interact with MongoDB

/**
 * unitSchema
 * ----------
 * Defines the structure and validation rules
 * for Unit documents stored in MongoDB.
 */
const unitSchema = new mongoose.Schema(
  {
    /**
     * unitName (String)
     * -----------------
     * Stores the name of the organizational unit.
     *
     * required: true
     *  - Prevents creation of a Unit without a name.
     */
    unitName: {
      type: String,
      required: true,
    },

    /**
     * branchId (ObjectId reference to Branch)
     * ---------------------------------------
     * Links this Unit to a specific Branch.
     *
     * type: mongoose.Schema.Types.ObjectId
     *  - Stores MongoDB ObjectId.
     *
     * ref: "Branch"
     *  - Establishes relationship with the Branch model.
     *  - Enables populate("branchId") to retrieve branch details.
     *
     * required: true
     *  - Every Unit must belong to a Branch.
     */
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
  },
    /**
     * timestamps: true
     * ----------------
     * Automatically adds:
     *  - createdAt → when the unit was created
     *  - updatedAt → when the unit was last updated
     *
     * These fields are maintained automatically by Mongoose.
     */
  { timestamps: true }
);

module.exports = mongoose.model("Unit", unitSchema);
