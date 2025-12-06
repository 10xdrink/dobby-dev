// controllers/seoController.js
const SeoPage = require("../models/SeoPage");

// Get SEO data by slug
exports.getSeoData = async (req, res) => {
  try {
    const { slug } = req.params;
    const seoData = await SeoPage.findOne({ slug });
    if (!seoData) return res.status(404).json({ message: "Page not found" });
    res.json(seoData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Save or update SEO data
exports.saveSeoData = async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, description, keywords, content } = req.body;

    const seoData = await SeoPage.findOneAndUpdate(
      { slug },
      { title, description, keywords, content },
      { upsert: true, new: true }
    );

    res.json(seoData);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
