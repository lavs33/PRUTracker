/**
 * Admin Model
 * -----------
 * Defines standalone administrator accounts that are intentionally stored
 * outside the end-user User/role system.
 *
 * Collection name in MongoDB: "admins"
 */
const mongoose = require("mongoose");

/**
 * adminSchema
 * -----------
 * Stores credentials and profile details for admin-only accounts.
 *
 * IMPORTANT:
 * - This model does NOT reuse the User schema.
 * - Admins are not represented as a User.role value.
 * - This keeps admin authentication fully separate from agent/manager login.
 */
const adminSchema = new mongoose.Schema(
  {
    /**
     * username (String)
     * -----------------
     * Unique login identifier for an administrator.
     */
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    /**
     * passwordHash (String)
     * ---------------------
     * Secure bcrypt hash of the admin password.
     */
    passwordHash: {
      type: String,
      required: true,
    },

    /**
     * firstName (String)
     * ------------------
     * Required given name for the admin profile.
     */
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * lastName (String)
     * -----------------
     * Required surname for the admin profile.
     */
    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    /**
     * email (String)
     * --------------
     * Optional unique admin email address.
     */
    email: {
      type: String,
      default: "",
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },

    /**
     * isActive (Boolean)
     * ------------------
     * Allows future admin access control without deleting the account.
     */
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Admin", adminSchema);