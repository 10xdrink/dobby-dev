const mongoose = require("mongoose");
const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    featuredImage: { type: String }, 
    featuredImageId: { type: String }, 
    content: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    slug: { type: String, required: true, unique: true },
    metaTitle: { type: String },
    metaDescription: { type: String },
    metaKeywords: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
