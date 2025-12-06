const XLSX = require("xlsx");
const fs = require("fs-extra");
const path = require("path");
const BulkUpload = require("../models/BulkUpload");
const BulkUploadService = require("../services/bulkUploadService");
const cloudinary = require("../config/cloudinary");
const logger = require("../config/logger");
const ProductCategory = require("../models/ProductCategory");
const ProductSubCategory = require("../models/SubProductCategory");

/**
 * Download bulk upload template
 * GET /api/shopkeeper/bulk-upload/template
 */
exports.downloadTemplate = async (req, res) => {
  try {
    const shop = req.shop;

    logger.info({
      route: "bulkUploadController.downloadTemplate",
      event: "TEMPLATE_DOWNLOAD_REQUEST",
      shopId: shop._id,
      userId: req.user.id,
    });

    // Generate template
    const workbook = BulkUploadService.generateTemplate();

    // Create temp directory if not exists
    const tempDir = path.join(__dirname, "../temp");
    await fs.ensureDir(tempDir);

    // Generate unique filename
    const fileName = `product-upload-template-${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, fileName);

    // Write workbook to file
    XLSX.writeFile(workbook, filePath);

    logger.info({
      route: "bulkUploadController.downloadTemplate",
      event: "TEMPLATE_GENERATED",
      shopId: shop._id,
      fileName,
    });

    // Send file
    res.download(filePath, fileName, async (err) => {
      if (err) {
        logger.error({
          route: "bulkUploadController.downloadTemplate",
          event: "TEMPLATE_DOWNLOAD_ERROR",
          error: err.message,
        });
      }

      // Clean up temp file
      try {
        await fs.remove(filePath);
      } catch (cleanupErr) {
        logger.warn({
          event: "TEMPLATE_CLEANUP_ERROR",
          error: cleanupErr.message,
        });
      }
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.downloadTemplate",
      event: "TEMPLATE_DOWNLOAD_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get categories for template help
 * GET /api/shopkeeper/bulk-upload/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const categories = await ProductCategory.find({ status: "active" })
      .select("_id name")
      .lean();

    const categoryData = await Promise.all(
      categories.map(async (cat) => {
        const subCategories = await ProductSubCategory.find({
          category: cat._id,
        })
          .select("_id name")
          .lean();

        return {
          categoryId: cat._id,
          categoryName: cat.name,
          subCategories: subCategories.map((sub) => ({
            subCategoryId: sub._id,
            subCategoryName: sub.name,
          })),
        };
      })
    );

    res.json({
      success: true,
      categories: categoryData,
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.getCategories",
      event: "GET_CATEGORIES_ERROR",
      error: err.message,
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Upload bulk products file
 * POST /api/shopkeeper/bulk-upload
 */
exports.uploadBulkProducts = async (req, res) => {
  try {
    const shop = req.shop;
    const userId = req.user.id;

    logger.info({
      route: "bulkUploadController.uploadBulkProducts",
      event: "BULK_UPLOAD_REQUEST",
      shopId: shop._id,
      userId,
    });

    // Check if file exists
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel file",
      });
    }

    // Validate file type
    const allowedMimeTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      await fs.remove(req.file.path);
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Please upload an Excel file (.xlsx or .xls)",
      });
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (req.file.size > maxSize) {
      await fs.remove(req.file.path);
      return res.status(400).json({
        success: false,
        message: "File size exceeds 10MB limit",
      });
    }

    // Upload file to Cloudinary for backup
    let cloudinaryUrl = null;
    let cloudinaryPublicId = null;

    try {
      const uploadResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "bulk-uploads",
        resource_type: "raw",
      });
      cloudinaryUrl = uploadResult.secure_url;
      cloudinaryPublicId = uploadResult.public_id;
    } catch (cloudinaryErr) {
      logger.warn({
        event: "CLOUDINARY_UPLOAD_WARNING",
        error: cloudinaryErr.message,
      });
      // Continue even if Cloudinary upload fails
    }

    // Create bulk upload record
    const bulkUpload = await BulkUpload.create({
      shop: shop._id,
      uploadedBy: userId,
      fileName: req.file.originalname,
      fileUrl: cloudinaryUrl || req.file.path,
      filePublicId: cloudinaryPublicId,
      status: "pending",
    });

    logger.info({
      route: "bulkUploadController.uploadBulkProducts",
      event: "BULK_UPLOAD_CREATED",
      bulkUploadId: bulkUpload._id,
      shopId: shop._id,
    });

    // Process bulk upload directly (synchronously)
    try {
      const result = await BulkUploadService.processBulkUpload(
        bulkUpload._id.toString(),
        req.file.path,
        shop._id.toString(),
        userId
      );

      // Fetch updated bulk upload record
      const updatedBulkUpload = await BulkUpload.findById(bulkUpload._id);

      logger.info({
        route: "bulkUploadController.uploadBulkProducts",
        event: "BULK_UPLOAD_COMPLETED",
        bulkUploadId: bulkUpload._id,
        shopId: shop._id,
        result,
      });

      res.status(200).json({
        success: true,
        message: "File uploaded and processed successfully.",
        bulkUpload: {
          _id: updatedBulkUpload._id,
          fileName: updatedBulkUpload.fileName,
          status: updatedBulkUpload.status,
          createdAt: updatedBulkUpload.createdAt,
          totalRows: updatedBulkUpload.totalRows,
          successCount: updatedBulkUpload.successCount,
          failedCount: updatedBulkUpload.failedCount,
        },
        result,
      });
    } catch (processError) {
      // Update bulk upload status to failed
      await BulkUpload.findByIdAndUpdate(bulkUpload._id, {
        status: "failed",
      });

      logger.error({
        route: "bulkUploadController.uploadBulkProducts",
        event: "BULK_UPLOAD_PROCESSING_FAILED",
        bulkUploadId: bulkUpload._id,
        error: processError.message,
        stack: processError.stack,
      });

      throw processError;
    }
  } catch (err) {
    // Clean up uploaded file
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupErr) {
        logger.warn({
          event: "FILE_CLEANUP_ERROR",
          error: cleanupErr.message,
        });
      }
    }

    logger.error({
      route: "bulkUploadController.uploadBulkProducts",
      event: "BULK_UPLOAD_FAILED",
      error: err.message,
      stack: err.stack,
      shopId: req.shop?._id,
    });

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

/**
 * Get bulk upload status
 * GET /api/shopkeeper/bulk-upload/:id
 */
exports.getBulkUploadStatus = async (req, res) => {
  try {
    const shop = req.shop;
    const bulkUploadId = req.params.id;

    const bulkUpload = await BulkUpload.findOne({
      _id: bulkUploadId,
      shop: shop._id,
    })
      .populate("uploadedBy", "firstName lastName email")
      .lean();

    if (!bulkUpload) {
      return res.status(404).json({
        success: false,
        message: "Bulk upload not found",
      });
    }

    // Calculate progress percentage
    let progress = 0;
    if (bulkUpload.totalRows > 0) {
      progress = Math.round(
        (bulkUpload.processedRows / bulkUpload.totalRows) * 100
      );
    }

    res.json({
      success: true,
      bulkUpload: {
        ...bulkUpload,
        progress,
      },
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.getBulkUploadStatus",
      event: "GET_STATUS_ERROR",
      error: err.message,
      bulkUploadId: req.params.id,
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Get all bulk uploads for shop
 * GET /api/shopkeeper/bulk-upload
 */
exports.getBulkUploads = async (req, res) => {
  try {
    const shop = req.shop;
    const { status, page = 1, limit = 20 } = req.query;

    const query = { shop: shop._id };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const bulkUploads = await BulkUpload.find(query)
      .populate("uploadedBy", "firstName lastName email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await BulkUpload.countDocuments(query);

    // Add progress to each upload
    const uploadsWithProgress = bulkUploads.map((upload) => {
      let progress = 0;
      if (upload.totalRows > 0) {
        progress = Math.round((upload.processedRows / upload.totalRows) * 100);
      }
      return {
        ...upload,
        progress,
      };
    });

    res.json({
      success: true,
      bulkUploads: uploadsWithProgress,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.getBulkUploads",
      event: "GET_BULK_UPLOADS_ERROR",
      error: err.message,
      shopId: req.shop?._id,
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Download error report
 * GET /api/shopkeeper/bulk-upload/:id/errors
 */
exports.downloadErrorReport = async (req, res) => {
  try {
    const shop = req.shop;
    const bulkUploadId = req.params.id;

    const bulkUpload = await BulkUpload.findOne({
      _id: bulkUploadId,
      shop: shop._id,
    });

    if (!bulkUpload) {
      return res.status(404).json({
        success: false,
        message: "Bulk upload not found",
      });
    }

    if (!bulkUpload.errors || bulkUpload.errors.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No errors found for this upload",
      });
    }

    // Create error report
    const errorData = bulkUpload.errors.map((err) => ({
      Row: err.row,
      Field: err.field,
      Error: err.message,
      "Product Name": err.data?.["productName*"] || "",
      SKU: err.data?.["sku*"] || "",
    }));

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(errorData);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 10 }, // Row
      { wch: 20 }, // Field
      { wch: 50 }, // Error
      { wch: 30 }, // Product Name
      { wch: 20 }, // SKU
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, "Errors");

    // Create temp file
    const tempDir = path.join(__dirname, "../temp");
    await fs.ensureDir(tempDir);

    const fileName = `error-report-${bulkUploadId}-${Date.now()}.xlsx`;
    const filePath = path.join(tempDir, fileName);

    XLSX.writeFile(workbook, filePath);

    logger.info({
      route: "bulkUploadController.downloadErrorReport",
      event: "ERROR_REPORT_GENERATED",
      bulkUploadId,
      errorCount: bulkUpload.errors.length,
    });

    // Send file
    res.download(filePath, fileName, async (err) => {
      if (err) {
        logger.error({
          event: "ERROR_REPORT_DOWNLOAD_ERROR",
          error: err.message,
        });
      }

      // Clean up
      try {
        await fs.remove(filePath);
      } catch (cleanupErr) {
        logger.warn({
          event: "ERROR_REPORT_CLEANUP_ERROR",
          error: cleanupErr.message,
        });
      }
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.downloadErrorReport",
      event: "DOWNLOAD_ERROR_REPORT_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ message: err.message });
  }
};

/**
 * Delete bulk upload record
 * DELETE /api/shopkeeper/bulk-upload/:id
 */
exports.deleteBulkUpload = async (req, res) => {
  try {
    const shop = req.shop;
    const bulkUploadId = req.params.id;

    const bulkUpload = await BulkUpload.findOne({
      _id: bulkUploadId,
      shop: shop._id,
    });

    if (!bulkUpload) {
      return res.status(404).json({
        success: false,
        message: "Bulk upload not found",
      });
    }

    // Don't allow deletion of processing uploads
    if (bulkUpload.status === "processing") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete upload while processing",
      });
    }

    // Delete from Cloudinary if exists
    if (bulkUpload.filePublicId) {
      try {
        await cloudinary.uploader.destroy(bulkUpload.filePublicId, {
          resource_type: "raw",
        });
      } catch (cloudinaryErr) {
        logger.warn({
          event: "CLOUDINARY_DELETE_WARNING",
          error: cloudinaryErr.message,
        });
      }
    }

    await bulkUpload.deleteOne();

    logger.info({
      route: "bulkUploadController.deleteBulkUpload",
      event: "BULK_UPLOAD_DELETED",
      bulkUploadId,
      shopId: shop._id,
    });

    res.json({
      success: true,
      message: "Bulk upload deleted successfully",
    });
  } catch (err) {
    logger.error({
      route: "bulkUploadController.deleteBulkUpload",
      event: "DELETE_BULK_UPLOAD_ERROR",
      error: err.message,
      bulkUploadId: req.params.id,
    });
    res.status(500).json({ message: err.message });
  }
};