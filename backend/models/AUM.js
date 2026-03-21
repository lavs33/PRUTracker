const mongoose = require("mongoose");

const aumSchema = new mongoose.Schema(
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

module.exports = mongoose.model("AUM", aumSchema);
