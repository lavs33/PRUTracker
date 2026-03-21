const mongoose = require("mongoose");

const umSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UM", umSchema);
