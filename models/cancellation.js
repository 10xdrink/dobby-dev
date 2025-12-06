const mongoose = require("mongoose");

const CancellationSchema = new mongoose.Schema(
  {
    description: {
      type: String,
      required: true,
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cancellation", CancellationSchema);
