/**
 * Agent Model
 * ----------
 * This schema defines an "Agent" entity in the system.
 * It extends a base "User" account by attaching agent-specific fields
 * (employment type + assigned unit).
 *
 * Storage: MongoDB collection "agents" (Mongoose pluralizes "Agent" by default)
 */
const mongoose = require("mongoose"); // Imports Mongoose to define schemas/models

/**
 * agentSchema
 * -----------
 * Creates a schema that describes how Agent documents are structured and validated.
 *
 * new mongoose.Schema(fields, options)
 * - fields: key/value definitions for each field in the MongoDB document
 * - options: schema behavior config (e.g., timestamps)
 */
const agentSchema = new mongoose.Schema(
  {
    /**
     * userId (ObjectId reference to User)
     * ----------------------------------
     * Links this Agent record to exactly ONE User record.
     *
     * type: ObjectId
     *   - MongoDB identifier type used to reference another document.
     *
     * ref: "User"
     *   - Tells Mongoose this ObjectId points to the "User" model.
     *   - Enables populate() (e.g., Agent.find().populate("userId")).
     *
     * required: true
     *   - Prevents saving an Agent without a linked User.
     *
     * unique: true
     *   - Enforces a one-to-one relationship:
     *     a given userId can appear only once in the Agent collection.
     *   - Meaning: a single User cannot be linked to multiple Agent records.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    /**
     * agentType (String)
     * ------------------
     * Employment classification of the agent.
     *
     * enum: ["Full-Time", "Part-Time"]
     *   - Restricts the field to only these values.
     *   - Any other value will fail validation and won't be saved.
     *
     * required: true
     *   - Prevents saving an Agent without specifying agentType.
     */
    agentType: {
      type: String,
      enum: ["Full-Time", "Part-Time"],
      required: true,
    },

    /**
     * unitId (ObjectId reference to Unit)
     * -----------------------------------
     * Associates this agent with one organizational Unit.
     *
     * type: ObjectId
     * ref: "Unit"
     *   - Enables populate("unitId") to pull unit details.
     *
     * required: true
     *   - Ensures every Agent is assigned to a Unit.
     */
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },

    isPromoted: {
      type: Boolean,
      default: false,
    },

    promotedToRole: {
      type: String,
      enum: ["AUM", "UM", "BM", null],
      default: null,
    },

    datePromoted: {
      type: Date,
      default: null,
    },

    promotionHistory: {
      type: [
        {
          role: {
            type: String,
            enum: ["AUM", "UM", "BM"],
            required: true,
          },
          datePromoted: {
            type: Date,
            required: true,
          },
          previousRole: {
            type: String,
            enum: ["AG", "AUM", "UM", "BM", null],
            default: null,
          },
          managerUsername: {
            type: String,
            default: "",
          },
          previousUsername: {
            type: String,
            default: "",
          },
          previousDateEmployed: {
            type: Date,
            default: null,
          },
          managerDateEmployed: {
            type: Date,
            default: null,
          },
          branchId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Branch",
            default: null,
          },
          unitId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Unit",
            default: null,
          },
        },
      ],
      default: [],
    },
  },
    /**
     * timestamps: true
     * ---------------
     * Automatically adds and maintains:
     * - createdAt: Date when document was first created
     * - updatedAt: Date when document was last updated
     */
  { timestamps: true }
);

module.exports = mongoose.model("Agent", agentSchema);
