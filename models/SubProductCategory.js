const mongoose = require("mongoose");


const subCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      required: true,
    },
  },
  { timestamps: true }
);


module.exports = mongoose.model("ProductSubCategory", subCategorySchema);
