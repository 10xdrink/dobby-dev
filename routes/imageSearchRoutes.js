const express = require("express");
const router = express.Router();
const {
  searchProductsByImage,
  analyzeImage,
} = require("../controllers/imageSearchController");

// Search products by image analysis
router.post("/search", searchProductsByImage);

// Analyze image endpoint (optional - for testing)
router.post("/analyze", analyzeImage);

module.exports = router;
