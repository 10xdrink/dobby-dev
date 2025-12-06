const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getAllCategories,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
  createCategory,
} = require("../controllers/productcategorycontroller");

//  Create Category (with image upload)
router.post(
  "/",
  upload.single("logo"),
  createCategory,
);

//  Get All Categories (supports ?status=active)
router.get(
  "/",
  getAllCategories
);

//  Update Category (with optional logo change)
router.put(
  "/:id",
  upload.single("logo"),
  updateCategory,
  
);

//  Delete Category + its Subcategories
router.delete(
  "/:id",
  deleteCategory,
);

//  Toggle Active/Inactive
router.patch(
  "/:id/toggle-status",
  toggleCategoryStatus,
);

module.exports = router;
