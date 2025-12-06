const ProductSubCategory = require("../models/SubProductCategory");
const ProductCategory = require("../models/ProductCategory");
const logger = require("../config/logger");

//  Create Subcategory
exports.createSubCategory = async (req, res) => {
  try {
    const { name, category } = req.body;

    logger.info({
      route: "subproductCategoryController.createSubCategory",
      event: "SUBCATEGORY_CREATE_REQUEST",
      name,
      category,
      userId: req.user?._id,
    });

    // validate category exists
    const catExists = await ProductCategory.findById(category);
    if (!catExists)
      return res.status(400).json({ message: "Parent category not found" });

    // check duplicate subcategory under same category
    const exists = await ProductSubCategory.findOne({ name, category });
    if (exists)
      return res.status(400).json({ message: "Subcategory already exists for this category" });

    const sub = await ProductSubCategory.create({ name, category });

    logger.info({
      route: "subproductCategoryController.createSubCategory",
      event: "SUBCATEGORY_CREATE_SUCCESS",
      subCategoryId: sub._id,
      category,
    });

    res.status(201).json({ message: "Subcategory created successfully", sub });
  } catch (error) {
    logger.error({
      route: "subproductCategoryController.createSubCategory",
      event: "SUBCATEGORY_CREATE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  Get All Subcategories
exports.getAllSubCategories = async (req, res) => {
  try {
    const subs = await ProductSubCategory.find()
      .populate("category", "name") // populate category name
      .sort({ createdAt: -1 });

    logger.info({
      route: "subproductCategoryController.getAllSubCategories",
      event: "SUBCATEGORY_LIST_SUCCESS",
      count: subs.length,
    });

    res.status(200).json(subs);
  } catch (error) {
    logger.error({
      route: "subproductCategoryController.getAllSubCategories",
      event: "SUBCATEGORY_LIST_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  Update Subcategory
exports.updateSubCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category } = req.body;

    const sub = await ProductSubCategory.findById(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });

    if (name) sub.name = name;
    if (category) {
      const catExists = await ProductCategory.findById(category);
      if (!catExists)
        return res.status(400).json({ message: "Invalid category selected" });
      sub.category = category;
    }

    await sub.save();
    logger.info({
      route: "subproductCategoryController.updateSubCategory",
      event: "SUBCATEGORY_UPDATE_SUCCESS",
      subCategoryId: sub._id,
      name: sub.name,
      category: sub.category,
    });
    res.json({ message: "Subcategory updated successfully", sub });
  } catch (error) {
    logger.error({
      route: "subproductCategoryController.updateSubCategory",
      event: "SUBCATEGORY_UPDATE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  Delete Subcategory
exports.deleteSubCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const sub = await ProductSubCategory.findById(id);
    if (!sub) return res.status(404).json({ message: "Subcategory not found" });

    await sub.deleteOne();
    logger.info({
      route: "subproductCategoryController.deleteSubCategory",
      event: "SUBCATEGORY_DELETE_SUCCESS",
      subCategoryId: id,
    });
    res.json({ message: "Subcategory deleted successfully" });
  } catch (error) {
    logger.error({
      route: "subproductCategoryController.deleteSubCategory",
      event: "SUBCATEGORY_DELETE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

// Get subcategories by category
exports.getSubCategoriesByCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;

    const subs = await ProductSubCategory.find({ category: categoryId })
      .populate("category", "name")
      .sort({ createdAt: -1 });

    if (subs.length === 0) {
      return res.status(200).json({ message: "No subcategories available", subs: [] });
    }

    res.status(200).json({ subs });
  } catch (error) {
    logger.error({
      route: "subproductCategoryController.getSubCategoriesByCategory",
      event: "SUBCATEGORY_BY_CATEGORY_ERROR",
      error: error.message,
      stack: error.stack,
      categoryId: req.params.categoryId,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

