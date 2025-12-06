const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs-extra");
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const bulkUploadController = require("../controllers/bulkUploadController");

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../uploads/bulk");
    await fs.ensureDir(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed")
      );
    }
  },
});

// All routes require authentication and active shop
router.use(protect(["shopkeeper"]), checkActiveShop);

/**
 * @route   GET /api/shopkeeper/bulk-upload/template
 * @desc    Download bulk upload template
 * @access  Private (Shopkeeper)
 */
router.get("/template", bulkUploadController.downloadTemplate);

/**
 * @route   GET /api/shopkeeper/bulk-upload/categories
 * @desc    Get categories and subcategories for template
 * @access  Private (Shopkeeper)
 */
router.get("/categories", bulkUploadController.getCategories);

/**
 * @route   POST /api/shopkeeper/bulk-upload
 * @desc    Upload bulk products file
 * @access  Private (Shopkeeper)
 */
router.post(
  "/",
  upload.single("file"),
  bulkUploadController.uploadBulkProducts
);

/**
 * @route   GET /api/shopkeeper/bulk-upload
 * @desc    Get all bulk uploads for shop
 * @access  Private (Shopkeeper)
 */
router.get("/", bulkUploadController.getBulkUploads);

/**
 * @route   GET /api/shopkeeper/bulk-upload/:id
 * @desc    Get bulk upload status
 * @access  Private (Shopkeeper)
 */
router.get("/:id", bulkUploadController.getBulkUploadStatus);

/**
 * @route   GET /api/shopkeeper/bulk-upload/:id/errors
 * @desc    Download error report
 * @access  Private (Shopkeeper)
 */
router.get("/:id/errors", bulkUploadController.downloadErrorReport);

/**
 * @route   DELETE /api/shopkeeper/bulk-upload/:id
 * @desc    Delete bulk upload record
 * @access  Private (Shopkeeper)
 */
router.delete("/:id", bulkUploadController.deleteBulkUpload);

module.exports = router;