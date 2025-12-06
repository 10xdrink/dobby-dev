const mongoose = require("mongoose");

const AboutSchema = new mongoose.Schema(
  {
    
    description: {
      type: String
    },
    
  },
  { timestamps: true }
);

module.exports = mongoose.model("About", AboutSchema);
