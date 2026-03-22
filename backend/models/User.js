/**
 * User Model
 * ----------
 * Defines the base user account structure in the system.
 * This model stores authentication credentials and personal details
 * for all system roles (Agent, AUM, UM, BM).
 * Admin accounts are intentionally stored in a separate Admin collection.
 *
 * Collection name in MongoDB: "users"
 */
const mongoose = require("mongoose"); // Imports Mongoose library to define schemas and interact with MongoDB

/**
 * userSchema
 * ----------
 * Defines the structure, validation rules, and constraints
 * for User documents stored in MongoDB.
 */
const userSchema = new mongoose.Schema(
  {
    /**
     * role (String)
     * -------------
     * Determines the system access level of the user.
     *
     * enum:
     *  - "AG"  → Agent
     *  - "AUM" → Assistant Unit Manager
     *  - "UM"  → Unit Manager
     *  - "BM"  → Branch Manager
     *
     * NOTE:
     *  - Admin is intentionally NOT part of this enum.
     *  - Admin accounts belong to the standalone Admin model instead.
     *
     * required: true
     *  - Every user must have a defined role.
     *  - Prevents saving incomplete user records.
     */
    role: {
      type: String,
      enum: ["AG", "AUM", "UM", "BM"],
      required: true,
    },

    /**
     * username (String)
     * -----------------
     * Unique login identifier for the user.
     * Represents agent code, AUM code, UM code, BM code
     *
     * required: true
     *  - Cannot create a user without username.
     *
     * unique: true
     *  - Enforces uniqueness at database index level.
     *  - Prevents duplicate accounts with same username.
     */
    username: {
      type: String,
      required: true,
      unique: true,
    },

    /**
     * password (String)
     * -----------------
     * Stores the hashed password of the user.
     *
     * required: true
     *  - User cannot exist without a password.
     *
     * NOTE:
     *  - This should be stored as a hashed value (e.g., bcrypt hash).
     *  - The schema itself does not hash — hashing must happen in controller logic.
     */
    password: {
      type: String,
      required: true,
    },

    /**
     * firstName (String)
     * ------------------
     * Required given name of the user.
     */
    firstName: {
      type: String,
      required: true,
    },

    /**
     * middleName (String)
     * -------------------
     * Optional middle name.
     *
     * default: ""
     *  - If not provided, automatically stored as empty string.
     *  - Prevents undefined/null values.
     */
    middleName: {
      type: String,
      default: "",
    },

    /**
     * lastName (String)
     * -----------------
     * Required surname of the user.
     */
    lastName: {
      type: String,
      required: true,
    },

    /**
     * birthday (Date)
     * ---------------
     * Stores the user's date of birth.
     *
     * required: true
     */
    birthday: {
      type: Date,
      required: true,
    },

    /**
     * sex (String)
     * ------------
     * Biological sex of the user.
     *
     * enum:
     *  - "Male"
     *  - "Female"
     *
     * required: true
     *  - Only allows these two values.
     */
    sex: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
    },

    /**
     * age (Number)
     * ------------
     * Stores computed age.
     *
     * required: true
     *
     * NOTE:
     *  - Birthday and age must be kept synchronized in controller logic.
     */
    age: {
      type: Number,
      required: true,
    },

    /**
     * displayPhoto (String)
     * ---------------------
     * Stores URL or path to profile image.
     *
     * default: ""
     *  - If no image uploaded, empty string is stored.
     */
    displayPhoto: {
      type: String,
      default: "",
    },

    /**
     * dateEmployed (Date)
     * -------------------
     * Date when the user was officially employed.
     *
     * required: true
     */
    dateEmployed: {
      type: Date,
      required: true,
    },
  },
  /**
   * timestamps: true
   * ----------------
   * Automatically adds:
   *  - createdAt → when the user record was created
   *  - updatedAt → when the user record was last modified
   *
   * Managed automatically by Mongoose.
   */
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);