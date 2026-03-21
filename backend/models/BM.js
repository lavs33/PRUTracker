const mongoose = require("mongoose");

const bmSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Agent",
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BM", bmSchema);
