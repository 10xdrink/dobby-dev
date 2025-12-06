const ProductCategory = require("../models/ProductCategory");
const ProductSubCategory = require("../models/SubProductCategory");
const User = require("../models/User");
const CategorySortSetting = require("../models/CategorySortSetting");
const cloudinary = require("../config/cloudinary");
const { createAndEmitNotification } = require("../helpers/notification");
const logger = require("../config/logger");

//  CREATE PRODUCT CATEGORY
exports.createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const file = req.file;

    logger.info({
      route: "productCategoryController.createCategory",
      event: "CATEGORY_CREATE_REQUEST",
      name,
      hasLogo: !!file,
      userId: req.user?._id,
    });

    const existing = await ProductCategory.findOne({ name });
    if (existing) {
      logger.warn({
        route: "productCategoryController.createCategory",
        event: "CATEGORY_CREATE_DUPLICATE",
        name,
      });
      return res.status(400).json({ message: "Category already exists" });
    }

    let logoUrl = null;
    let logoPublicId = null;

    if (file) {
      logoUrl = file.path;
      logoPublicId = file.filename;
    }

    const category = await ProductCategory.create({
      name,
      logo: logoUrl,
      logoPublicId,
      status:"active",
    });

    // Send notification to all shopkeepers when category is created
    try {
      const shopkeepers = await User.find({ role: "shopkeeper" }).select("_id");
      
      if (shopkeepers.length > 0) {
        const targetUsers = shopkeepers.map(s => ({
          userId: s._id,
          userModel: "User",
        }));

        await createAndEmitNotification({
          title: "New Product Category Added!",
          message: `A new category "${category.name}" has been added and is now available.`,
          event: "PRODUCT_CATEGORY_ADDED",
          targetUsers,
          meta: { 
            categoryId: category._id,
            categoryName: category.name,
            categoryLogo: category.logo,
            status: category.status,
            addedAt: category.createdAt || new Date(),
          },
        });

        logger.info({
          route: "productCategoryController.createCategory",
          event: "CATEGORY_NOTIFICATION_EMITTED",
          categoryId: category._id,
          categoryName: category.name,
          targetCount: targetUsers.length,
        });
      }
    } catch (notifErr) {
      logger.error({
        route: "productCategoryController.createCategory",
        event: "CATEGORY_NOTIFICATION_FAILED",
        categoryId: category._id,
        error: notifErr.message,
        stack: notifErr.stack,
      });
      // Don't fail category creation if notification fails
    }

    logger.info({
      route: "productCategoryController.createCategory",
      event: "CATEGORY_CREATE_SUCCESS",
      categoryId: category._id,
      name: category.name,
      status: category.status,
    });

    res
      .status(201)
      .json({ message: "Category created successfully", category });
  } catch (error) {
    logger.error({
      route: "productCategoryController.createCategory",
      event: "CATEGORY_CREATE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  GET ALL PRODUCT CATEGORIES
exports.getAllCategories = async (req, res) => {
  try {
    const setting = await CategorySortSetting.findOne();
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    let sortCondition = {};

    if (!setting || setting.useDefault) {
      
      sortCondition = { createdAt: -1 };
    } else {
      
      switch (setting.sortOption) {
        case "latestCreated":
          sortCondition = { createdAt: -1 };
          break;
        case "firstCreated":
          sortCondition = { createdAt: 1 };
          break;
        case "AtoZ":
          sortCondition = { name: 1 };
          break;
        case "ZtoA":
          sortCondition = { name: -1 };
          break;
        default:
          sortCondition = { createdAt: -1 };
      }
    }

    const categories = await ProductCategory.find(filter).sort(sortCondition);
    logger.info({
      route: "productCategoryController.getAllCategories",
      event: "CATEGORY_LIST_SUCCESS",
      filter,
      sortCondition,
      count: categories.length,
    });
    res.status(200).json(categories);
  } catch (error) {
    logger.error({
      route: "productCategoryController.getAllCategories",
      event: "CATEGORY_LIST_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  UPDATE PRODUCT CATEGORY
exports.updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;
    const file = req.file;

    const category = await ProductCategory.findById(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    //  If new logo uploaded, delete old one from Cloudinary
    if (file) {
      if (category.logoPublicId) {
        await cloudinary.uploader.destroy(category.logoPublicId);
      }
      category.logo = file.path;
      category.logoPublicId = file.filename;
    }

    if (name) category.name = name;
    if (status) category.status = status;

    await category.save();
    logger.info({
      route: "productCategoryController.updateCategory",
      event: "CATEGORY_UPDATE_SUCCESS",
      categoryId: category._id,
      name: category.name,
      status: category.status,
    });

    res.json({ message: "Category updated successfully", category });
  } catch (error) {
    logger.error({
      route: "productCategoryController.updateCategory",
      event: "CATEGORY_UPDATE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  DELETE PRODUCT CATEGORY (and all its subcategories)
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ProductCategory.findById(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    //  Delete logo from Cloudinary
    if (category.logoPublicId) {
      await cloudinary.uploader.destroy(category.logoPublicId);
    }

    //  Delete all subcategories linked to this category
    await ProductSubCategory.deleteMany({ category: id });

    //  Delete category itself
    await category.deleteOne();
    logger.info({
      route: "productCategoryController.deleteCategory",
      event: "CATEGORY_DELETE_SUCCESS",
      categoryId: id,
      deletedSubCategories: true,
    });

    res.json({
      message: "Category and related subcategories deleted successfully",
    });
  } catch (error) {
    logger.error({
      route: "productCategoryController.deleteCategory",
      event: "CATEGORY_DELETE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};

//  TOGGLE CATEGORY STATUS (Active / Inactive)
exports.toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await ProductCategory.findById(id);
    if (!category)
      return res.status(404).json({ message: "Category not found" });

    const previousStatus = category.status;
    category.status =
      category.status === "active" ? "inactive" : "active";
    await category.save();

     if (previousStatus !== "active" && category.status === "active") {
      const shopkeepers = await User.find({ role: "shopkeeper" }).select("_id");
      const targetUsers = shopkeepers.map(s => ({
        userId: s._id,
        userModel: "User",
      }));

      await createAndEmitNotification({
        title: "Category Activated!",
        message: `The category "${category.name}" is now active.`,
        event: "category-activated",
        targetModels: ["User"],
        targetUsers,
        meta: { categoryId: category._id },
      });

      logger.info({
        route: "productCategoryController.toggleCategoryStatus",
        event: "CATEGORY_ACTIVATED_NOTIFICATION",
        categoryId: category._id,
        targetCount: targetUsers.length,
      });
    }

    logger.info({
      route: "productCategoryController.toggleCategoryStatus",
      event: "CATEGORY_STATUS_TOGGLED",
      categoryId: category._id,
      previousStatus,
      newStatus: category.status,
    });

    res.json({ message: `Category ${category.status}`, category });
  } catch (error) {
    logger.error({
      route: "productCategoryController.toggleCategoryStatus",
      event: "CATEGORY_TOGGLE_ERROR",
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ message: "Server error", error });
  }
};
