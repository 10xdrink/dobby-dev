const XLSX = require("xlsx");
const fs = require("fs-extra");
const path = require("path");
const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
const ProductSubCategory = require("../models/SubProductCategory");
const BulkUpload = require("../models/BulkUpload");
const StockMovement = require("../models/InventoryReport");
const logger = require("../config/logger");
const cloudinary = require("../config/cloudinary");
const CacheInvalidation = require("../utils/cacheInvalidation");
const axios = require("axios");

class BulkUploadService {
  // Generate Excel template for bulk upload
  static generateTemplate() {
    const headers = [
      "productId*",
      "productName*",
      "description",
      "categoryId*",
      "subCategoryId*",
      "unit*",
      "sku*",
      "searchTags",
      "unitPrice*",
      "minOrderQty",
      "currentStock*",
      "minStockQty",
      "discountType",
      "discountValue",
      "taxType",
      "shippingCost",
      "metaTitle",
      "metaDescription",
      "status",
      "icon1Url", // Main product image
      "icon2Urls", // Additional images (comma-separated)
      "metaImageUrl", // SEO image
    ];

    const sampleData = [
      [
        "PROD001",
        "Sample Product",
        "This is a sample product description",
        "673a1b2c3d4e5f6a7b8c9d0e",
        "673a1b2c3d4e5f6a7b8c9d0f",
        "piece",
        "SKU001",
        "electronics, gadgets, smartphone",
        "25000",
        "1",
        "100",
        "10",
        "percentage",
        "10",
        "inclusive",
        "50",
        "Best Smartphone 2024",
        "Buy the best smartphone with amazing features",
        "active",
        "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/products/main.jpg",
        "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/products/img1.jpg,https://res.cloudinary.com/your-cloud/image/upload/v1234567890/products/img2.jpg",
        "https://res.cloudinary.com/your-cloud/image/upload/v1234567890/products/meta.jpg",
      ],
    ];

    const instructions = [
      ["BULK PRODUCT UPLOAD TEMPLATE - WITH IMAGE SUPPORT"],
      [""],
      ["INSTRUCTIONS:"],
      ["1. Fields marked with * are mandatory"],
      ["2. Do not modify the header row"],
      [
        "3. categoryId and subCategoryId must be valid MongoDB ObjectIds from your system",
      ],
      ["4. unit: piece, kilogram, meter, or kg"],
      ["5. discountType: flat or percentage"],
      ["6. taxType: inclusive or exclusive"],
      ["7. status: active, inactive, or draft"],
      [
        "8. searchTags: comma-separated values (e.g., electronics, phone, mobile)",
      ],
      ["9. Numeric fields should contain only numbers (no commas)"],
      ["10. SKU must be unique across all products"],
      [""],
      ["IMAGE UPLOAD INSTRUCTIONS:"],
      ["11. icon1Url: Main product image (single URL)"],
      ["12. icon2Urls: Additional images (comma-separated URLs, max 5)"],
      ["13. metaImageUrl: SEO/meta image (single URL)"],
      ["14. All image URLs must be publicly accessible"],
      ["15. Supported formats: jpg, jpeg, png, webp"],
      [
        "16. Images should be uploaded to Cloudinary or any image hosting service first",
      ],
      [
        "17. Example URL: https://res.cloudinary.com/your-cloud/image/upload/v123/product.jpg",
      ],
      [""],
      ["VALID VALUES:"],
      ["- unit: piece, kilogram, meter, kg"],
      ["- discountType: flat, percentage"],
      ["- taxType: inclusive, exclusive"],
      ["- status: active, inactive, draft"],
      [""],
    ];

    const workbook = XLSX.utils.book_new();

    // Instructions sheet
    const instructionsSheet = XLSX.utils.aoa_to_sheet(instructions);
    XLSX.utils.book_append_sheet(workbook, instructionsSheet, "Instructions");

    // Template sheet
    const templateSheet = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);

    // Set column widths
    const columnWidths = headers.map(() => ({ wch: 20 }));
    templateSheet["!cols"] = columnWidths;

    XLSX.utils.book_append_sheet(workbook, templateSheet, "Products");

    return workbook;
  }

  /**
   * Parse uploaded Excel file
   */
  static async parseExcelFile(filePath) {
    try {
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames.find((name) =>
        name.toLowerCase().includes("product")
      );

      if (!sheetName) {
        throw new Error(
          "Invalid template: 'Products' sheet not found. Please use the official template."
        );
      }

      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: "",
      });

      logger.info({
        event: "EXCEL_FILE_PARSED",
        rowCount: data.length,
        sheetName,
      });

      return data;
    } catch (error) {
      logger.error({
        event: "EXCEL_PARSE_ERROR",
        error: error.message,
        filePath,
      });
      throw error;
    }
  }

  /**
   * Validate image URL
   */
  static async validateImageUrl(url) {
    if (!url || url.trim() === "") return { valid: true, url: null };

    try {
      // Check if URL is valid format
      new URL(url);

      // Optional: Verify URL is accessible (can be slow, enable if needed)
      // const response = await axios.head(url, { timeout: 5000 });
      // if (response.status !== 200) {
      //   return { valid: false, error: "Image URL not accessible" };
      // }

      return { valid: true, url: url.trim() };
    } catch (err) {
      return { valid: false, error: "Invalid image URL format" };
    }
  }

  /**
   * Upload image from URL to Cloudinary
   */
  static async uploadImageFromUrl(imageUrl) {
    if (!imageUrl || imageUrl.trim() === "") return null;

    try {
      const result = await cloudinary.uploader.upload(imageUrl, {
        folder: "bulk-uploads/products",
        resource_type: "image",
      });

      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      logger.error({
        event: "IMAGE_UPLOAD_FROM_URL_ERROR",
        imageUrl,
        error: error.message,
      });
      throw new Error(`Failed to upload image from URL: ${error.message}`);
    }
  }

  /**
   * Validate a single product row WITH IMAGE VALIDATION
   */
  static async validateProductRow(row, index, shopId) {
    const errors = [];

    // Required field validation
    const requiredFields = [
      "productId*",
      "productName*",
      "categoryId*",
      "subCategoryId*",
      "unit*",
      "sku*",
      "unitPrice*",
      "currentStock*",
    ];

    for (const field of requiredFields) {
      if (!row[field] || row[field].toString().trim() === "") {
        errors.push({
          row: index + 2,
          field: field.replace("*", ""),
          message: `${field} is required`,
          data: row,
        });
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    // Validate unit
    const validUnits = ["piece", "kilogram", "meter", "kg"];
    if (!validUnits.includes(row["unit*"]?.toLowerCase())) {
      errors.push({
        row: index + 2,
        field: "unit",
        message: `Invalid unit. Must be one of: ${validUnits.join(", ")}`,
        data: row,
      });
    }

    // Validate discount type
    if (row["discountType"]) {
      const validDiscountTypes = ["flat", "percentage"];
      if (!validDiscountTypes.includes(row["discountType"]?.toLowerCase())) {
        errors.push({
          row: index + 2,
          field: "discountType",
          message: `Invalid discountType. Must be one of: ${validDiscountTypes.join(
            ", "
          )}`,
          data: row,
        });
      }
    }

    // Validate tax type
    if (row["taxType"]) {
      const validTaxTypes = ["inclusive", "exclusive"];
      if (!validTaxTypes.includes(row["taxType"]?.toLowerCase())) {
        errors.push({
          row: index + 2,
          field: "taxType",
          message: `Invalid taxType. Must be one of: ${validTaxTypes.join(
            ", "
          )}`,
          data: row,
        });
      }
    }

    // Validate status
    if (row["status"]) {
      const validStatuses = ["active", "inactive", "draft"];
      if (!validStatuses.includes(row["status"]?.toLowerCase())) {
        errors.push({
          row: index + 2,
          field: "status",
          message: `Invalid status. Must be one of: ${validStatuses.join(
            ", "
          )}`,
          data: row,
        });
      }
    }

    // Validate numeric fields
    const numericFields = [
      "unitPrice*",
      "minOrderQty",
      "currentStock*",
      "minStockQty",
      "discountValue",
      "shippingCost",
    ];

    for (const field of numericFields) {
      if (row[field] && isNaN(parseFloat(row[field]))) {
        errors.push({
          row: index + 2,
          field: field.replace("*", ""),
          message: `${field} must be a valid number`,
          data: row,
        });
      }
    }

    // Validate discount value based on type
    const discountValue = parseFloat(row["discountValue"] || 0);
    const unitPrice = parseFloat(row["unitPrice*"] || 0);

    if (row["discountType"] === "flat" && discountValue > unitPrice) {
      errors.push({
        row: index + 2,
        field: "discountValue",
        message: "Flat discount cannot exceed unit price",
        data: row,
      });
    }

    if (
      row["discountType"] === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      errors.push({
        row: index + 2,
        field: "discountValue",
        message: "Percentage discount must be between 0 and 100",
        data: row,
      });
    }

    // Validate image URLs
    if (row["icon1Url"]) {
      const icon1Validation = await this.validateImageUrl(row["icon1Url"]);
      if (!icon1Validation.valid) {
        errors.push({
          row: index + 2,
          field: "icon1Url",
          message: icon1Validation.error,
          data: row,
        });
      }
    }

    if (row["icon2Urls"]) {
      const icon2Urls = row["icon2Urls"]
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean);

      if (icon2Urls.length > 5) {
        errors.push({
          row: index + 2,
          field: "icon2Urls",
          message: "Maximum 5 additional images allowed",
          data: row,
        });
      }

      for (const url of icon2Urls) {
        const urlValidation = await this.validateImageUrl(url);
        if (!urlValidation.valid) {
          errors.push({
            row: index + 2,
            field: "icon2Urls",
            message: `Invalid URL: ${url} - ${urlValidation.error}`,
            data: row,
          });
        }
      }
    }

    if (row["metaImageUrl"]) {
      const metaValidation = await this.validateImageUrl(row["metaImageUrl"]);
      if (!metaValidation.valid) {
        errors.push({
          row: index + 2,
          field: "metaImageUrl",
          message: metaValidation.error,
          data: row,
        });
      }
    }

    // Validate category exists and is active
    try {
      const category = await ProductCategory.findOne({
        _id: row["categoryId*"],
        status: "active",
      });

      if (!category) {
        errors.push({
          row: index + 2,
          field: "categoryId",
          message: "Invalid or inactive category",
          data: row,
        });
      }
    } catch (err) {
      errors.push({
        row: index + 2,
        field: "categoryId",
        message: "Invalid category ID format",
        data: row,
      });
    }

    // Validate subcategory exists and belongs to category
    try {
      const subCategory = await ProductSubCategory.findOne({
        _id: row["subCategoryId*"],
        category: row["categoryId*"],
      });

      if (!subCategory) {
        errors.push({
          row: index + 2,
          field: "subCategoryId",
          message:
            "Invalid subcategory or does not belong to specified category",
          data: row,
        });
      }
    } catch (err) {
      errors.push({
        row: index + 2,
        field: "subCategoryId",
        message: "Invalid subcategory ID format",
        data: row,
      });
    }

    // Check SKU uniqueness
    const existingSKU = await Product.findOne({
      sku: row["sku*"],
    });

    if (existingSKU) {
      errors.push({
        row: index + 2,
        field: "sku",
        message: `SKU '${row["sku*"]}' already exists`,
        data: row,
      });
    }

    // Check productId uniqueness
    const existingProductId = await Product.findOne({
      productId: row["productId*"],
    });

    if (existingProductId) {
      errors.push({
        row: index + 2,
        field: "productId",
        message: `Product ID '${row["productId*"]}' already exists`,
        data: row,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process bulk upload WITH IMAGE SUPPORT
   */
  static async processBulkUpload(bulkUploadId, filePath, shopId, userId) {
    const startTime = Date.now();
    let successCount = 0;
    let failedCount = 0;
    const allErrors = [];
    const processedSKUs = new Set();
    const processedProductIds = new Set();

    try {
      await BulkUpload.findByIdAndUpdate(bulkUploadId, {
        status: "processing",
        startedAt: new Date(),
      });

      const rows = await this.parseExcelFile(filePath);

      await BulkUpload.findByIdAndUpdate(bulkUploadId, {
        totalRows: rows.length,
      });

      logger.info({
        event: "BULK_UPLOAD_STARTED",
        bulkUploadId,
        shopId,
        totalRows: rows.length,
      });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];

        try {
          const currentSKU = row["sku*"]?.toString().trim();
          const currentProductId = row["productId*"]?.toString().trim();

          if (currentSKU && processedSKUs.has(currentSKU)) {
            failedCount++;
            allErrors.push({
              row: i + 2,
              field: "sku",
              message: `Duplicate SKU '${currentSKU}' found in this upload batch`,
              data: row,
            });
            continue;
          }

          if (currentProductId && processedProductIds.has(currentProductId)) {
            failedCount++;
            allErrors.push({
              row: i + 2,
              field: "productId",
              message: `Duplicate Product ID '${currentProductId}' found in this upload batch`,
              data: row,
            });
            continue;
          }

          const validation = await this.validateProductRow(row, i, shopId);

          if (!validation.valid) {
            failedCount++;
            allErrors.push(...validation.errors);
            logger.warn({
              event: "BULK_UPLOAD_ROW_VALIDATION_FAILED",
              bulkUploadId,
              row: i + 2,
              errors: validation.errors,
            });
            continue;
          }

          if (currentSKU) processedSKUs.add(currentSKU);
          if (currentProductId) processedProductIds.add(currentProductId);

          const sanitizeNumber = (value) => {
            if (typeof value === "string") {
              return parseFloat(value.replace(/,/g, "")) || 0;
            }
            return value || 0;
          };

          let formattedTags = [];
          if (row["searchTags"]) {
            formattedTags = row["searchTags"]
              .split(",")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean);
          }

          // Process main image (icon1)
          let icon1 = null;
          let icon1PublicId = null;

          if (row["icon1Url"] && row["icon1Url"].trim() !== "") {
            try {
              const uploadResult = await this.uploadImageFromUrl(
                row["icon1Url"]
              );
              if (uploadResult) {
                icon1 = uploadResult.url;
                icon1PublicId = uploadResult.publicId;
              }
            } catch (imgErr) {
              logger.warn({
                event: "IMAGE_UPLOAD_WARNING",
                row: i + 2,
                field: "icon1Url",
                error: imgErr.message,
              });
            }
          }

          // Process additional images (icon2)
          let icon2 = [];
          let icon2PublicIds = [];

          if (row["icon2Urls"] && row["icon2Urls"].trim() !== "") {
            const icon2Urls = row["icon2Urls"]
              .split(",")
              .map((url) => url.trim())
              .filter(Boolean)
              .slice(0, 5); // Max 5 images

            for (const url of icon2Urls) {
              try {
                const uploadResult = await this.uploadImageFromUrl(url);
                if (uploadResult) {
                  icon2.push(uploadResult.url);
                  icon2PublicIds.push(uploadResult.publicId);
                }
              } catch (imgErr) {
                logger.warn({
                  event: "IMAGE_UPLOAD_WARNING",
                  row: i + 2,
                  field: "icon2Urls",
                  url,
                  error: imgErr.message,
                });
              }
            }
          }

          // Process meta image
          let metaImageUrl = null;
          let metaImagePublicId = null;

          if (row["metaImageUrl"] && row["metaImageUrl"].trim() !== "") {
            try {
              const uploadResult = await this.uploadImageFromUrl(
                row["metaImageUrl"]
              );
              if (uploadResult) {
                metaImageUrl = uploadResult.url;
                metaImagePublicId = uploadResult.publicId;
              }
            } catch (imgErr) {
              logger.warn({
                event: "IMAGE_UPLOAD_WARNING",
                row: i + 2,
                field: "metaImageUrl",
                error: imgErr.message,
              });
            }
          }

          const productData = {
            shop: shopId,
            productId: row["productId*"],
            productName: row["productName*"],
            description: row["description"] || "",
            category: row["categoryId*"],
            subCategory: row["subCategoryId*"],
            unit: row["unit*"].toLowerCase(),
            sku: row["sku*"],
            searchTags: formattedTags,
            unitPrice: sanitizeNumber(row["unitPrice*"]),
            minOrderQty: sanitizeNumber(row["minOrderQty"] || 1),
            currentStock: sanitizeNumber(row["currentStock*"]),
            minStockQty: sanitizeNumber(row["minStockQty"] || 0),
            discountType: row["discountType"]?.toLowerCase() || "flat",
            discountValue: sanitizeNumber(row["discountValue"] || 0),
            taxType: row["taxType"]?.toLowerCase() || "inclusive",
            shippingCost: sanitizeNumber(row["shippingCost"] || 0),
            metaTitle: row["metaTitle"] || "",
            metaDescription: row["metaDescription"] || "",
            status: row["status"]?.toLowerCase() || "draft",
            // Add images
            icon1,
            icon1PublicId,
            icon2,
            icon2PublicIds,
            metaImage: metaImageUrl,
            metaImagePublicId,
          };

          const product = await Product.create(productData);

          await StockMovement.recordMovement({
            shop: shopId,
            product: product._id,
            type: "in",
            quantity: product.currentStock,
            reason: "bulk_upload",
            previousStock: 0,
            newStock: product.currentStock,
            notes: `Bulk upload - Initial stock`,
            performedBy: userId,
          });

          successCount++;

          await BulkUpload.findByIdAndUpdate(bulkUploadId, {
            processedRows: i + 1,
            successCount,
            failedCount,
          });

          logger.info({
            event: "BULK_UPLOAD_ROW_SUCCESS",
            bulkUploadId,
            row: i + 2,
            productId: product._id,
            hasImages: {
              icon1: !!icon1,
              icon2Count: icon2.length,
              metaImage: !!metaImageUrl,
            },
          });
        } catch (error) {
          failedCount++;
          allErrors.push({
            row: i + 2,
            field: "general",
            message: error.message,
            data: row,
          });

          logger.error({
            event: "BULK_UPLOAD_ROW_ERROR",
            bulkUploadId,
            row: i + 2,
            error: error.message,
          });
        }
      }

      let finalStatus = "completed";
      if (failedCount > 0 && successCount > 0) {
        finalStatus = "partial";
      } else if (failedCount === rows.length) {
        finalStatus = "failed";
      }

      const processingTime = Math.floor((Date.now() - startTime) / 1000);

      if (successCount > 0) {
        try {
          await CacheInvalidation.invalidateProducts();
          await CacheInvalidation.invalidateSalesReports();
          logger.info({
            event: "BULK_UPLOAD_CACHE_INVALIDATED",
            bulkUploadId,
            shopId,
          });
        } catch (cacheErr) {
          logger.warn({
            event: "BULK_UPLOAD_CACHE_INVALIDATION_FAILED",
            bulkUploadId,
            error: cacheErr.message,
          });
        }
      }

      await BulkUpload.findByIdAndUpdate(bulkUploadId, {
        status: finalStatus,
        successCount,
        failedCount,
        errors: allErrors,
        completedAt: new Date(),
        processingTime,
      });

      await fs.remove(filePath);

      logger.info({
        event: "BULK_UPLOAD_COMPLETED",
        bulkUploadId,
        shopId,
        totalRows: rows.length,
        successCount,
        failedCount,
        processingTime,
        finalStatus,
      });

      return {
        success: true,
        totalRows: rows.length,
        successCount,
        failedCount,
        errors: allErrors,
        processingTime,
      };
    } catch (error) {
      await BulkUpload.findByIdAndUpdate(bulkUploadId, {
        status: "failed",
        errors: [
          {
            row: 0,
            field: "system",
            message: error.message,
          },
        ],
        completedAt: new Date(),
        processingTime: Math.floor((Date.now() - startTime) / 1000),
      });

      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
      }

      logger.error({
        event: "BULK_UPLOAD_FAILED",
        bulkUploadId,
        shopId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  }
}

module.exports = BulkUploadService;