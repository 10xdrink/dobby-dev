const express = require("express");
const {
  createSubCategory,
  getAllSubCategories,
  updateSubCategory,
  deleteSubCategory,
  getSubCategoriesByCategory,
} = require("../controllers/subproductcaetgoryController");
const router = express.Router();

// Create Subcategory
router.post(
  "/",
  createSubCategory,
);

//  Get All Subcategories
router.get(
  "/",
  getAllSubCategories
);

//  Update Subcategory
router.put(
  "/:id",
  updateSubCategory,
);

// Delete Subcategory
router.delete(
  "/:id",
  deleteSubCategory,
);

// Get subcategories by category
router.get(
  "/by-category/:categoryId",
  getSubCategoriesByCategory
);

module.exports = router;
