const FlashSale = require("../models/FlashSale");
const Product = require("../models/productModel");
const cloudinary = require("../config/cloudinary");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");
const crypto = require("crypto");

// CREATE FLASH SALE
exports.createFlashSale = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.createFlashSale",
    requestId,
    shopId: req.shop._id.toString(),
    userId: req.user.id,
  };

  logger.info({
    ...context,
    event: "CREATE_FLASH_SALE_START",
    body: { ...req.body, banner: req.file ? "provided" : "none" },
  });

  try {
    const {
      name,
      startDate,
      endDate,
      discountType,
      discountValue,
      products,
      description,
    } = req.body;

    // Validation
    if (
      !name ||
      !startDate ||
      !endDate ||
      !discountType ||
      discountValue === undefined
    ) {
      logger.warn({
        ...context,
        event: "VALIDATION_FAILED",
        missing: {
          name: !name,
          startDate: !startDate,
          endDate: !endDate,
          discountType: !discountType,
          discountValue: discountValue === undefined,
        },
      });
      return res.status(400).json({
        success: false,
        message:
          "All fields are required (name, startDate, endDate, discountType, discountValue)",
      });
    }

    // Date validation
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();

    if (end <= start) {
      logger.warn({
        ...context,
        event: "INVALID_DATE_RANGE",
        startDate,
        endDate,
      });
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    if (end <= now) {
      logger.warn({
        ...context,
        event: "END_DATE_IN_PAST",
        endDate,
      });
      return res.status(400).json({
        success: false,
        message: "End date cannot be in the past",
      });
    }

    // Discount validation
    if (
      discountType === "percentage" &&
      (discountValue < 0 || discountValue > 100)
    ) {
      logger.warn({
        ...context,
        event: "INVALID_PERCENTAGE",
        discountValue,
      });
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountType === "flat" && discountValue < 0) {
      logger.warn({
        ...context,
        event: "NEGATIVE_DISCOUNT",
        discountValue,
      });
      return res.status(400).json({
        success: false,
        message: "Discount value cannot be negative",
      });
    }

    // Products validation
    if (!products || !Array.isArray(products) || products.length === 0) {
      logger.warn({
        ...context,
        event: "NO_PRODUCTS_SELECTED",
        products,
      });
      return res.status(400).json({
        success: false,
        message: "At least one product must be selected",
      });
    }

    // Validate products belong to this shop only
    const productDocs = await Product.find({
      _id: { $in: products },
      shop: req.shop._id,
      status: "active",
    });

    if (productDocs.length !== products.length) {
      logger.warn({
        ...context,
        event: "INVALID_PRODUCTS",
        requested: products.length,
        found: productDocs.length,
        shopId: req.shop._id,
      });
      return res.status(400).json({
        success: false,
        message:
          "Some products are invalid, inactive, or don't belong to your shop",
      });
    }

    logger.info({
      ...context,
      event: "PRODUCTS_VALIDATED",
      productCount: productDocs.length,
      products: productDocs.map((p) => ({ id: p._id, name: p.productName })),
    });

    // Upload banner if provided
    let bannerUrl = null;
    let bannerPublicId = null;

    if (req.file) {
      try {
        const uploadResult = await cloudinary.uploader.upload(req.file.path);
        bannerUrl = uploadResult.secure_url;
        bannerPublicId = uploadResult.public_id;

        logger.info({
          ...context,
          event: "BANNER_UPLOADED",
          publicId: bannerPublicId,
        });
      } catch (uploadErr) {
        logger.error({
          ...context,
          event: "BANNER_UPLOAD_FAILED",
          error: uploadErr.message,
        });
        // Continue without banner
      }
    }

    // Create flash sale
    const sale = new FlashSale({
      name,
      startDate: start,
      endDate: end,
      discountType,
      discountValue,
      products,
      description: description || "",
      promotionalBanner: bannerUrl,
      promotionalBannerPublicId: bannerPublicId,
      shop: req.shop._id,
    });

    await sale.save();

    logger.info({
      ...context,
      event: "FLASH_SALE_CREATED",
      flashSaleId: sale._id,
      name: sale.name,
      status: sale.status,
      startDate: sale.startDate,
      endDate: sale.endDate,
      productCount: products.length,
      discountType: sale.discountType,
      discountValue: sale.discountValue,
    });

    res.status(201).json({
      success: true,
      message: "Flash sale created successfully",
      sale,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "CREATE_FLASH_SALE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Server error while creating flash sale",
    });
  }
};

// GET ALL FLASH SALES FOR SHOPKEEPER
exports.getFlashSales = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.getFlashSales",
    requestId,
    shopId: req.shop._id.toString(),
  };

  logger.info({
    ...context,
    event: "GET_FLASH_SALES_START",
    query: req.query,
  });

  try {
    const { status, search } = req.query;

    const cacheKey = `shop:${req.shop._id}:flashSales:${status || 'all'}:${search || 'none'}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      let query = { shop: req.shop._id };

      // Filter by status if provided
      if (status && status !== "all") {
        query.status = status;
      }

      // Search by name
      if (search) {
        query.name = { $regex: search, $options: "i" };
      }

      const sales = await FlashSale.find(query)
        .populate("products", "productName unitPrice sku icon1 currentStock")
        .sort({ createdAt: -1 })
        .lean();

      // Calculate statistics
      const stats = {
        total: sales.length,
        active: sales.filter((s) => s.status === "active").length,
        scheduled: sales.filter((s) => s.status === "scheduled").length,
        expired: sales.filter((s) => s.status === "expired").length,
        manuallyDeactivated: sales.filter(
          (s) => s.status === "manually_deactivated"
        ).length,
      };

      logger.info({
        ...context,
        event: "FLASH_SALES_RETRIEVED",
        count: sales.length,
        stats,
      });

      return {
        success: true,
        sales,
        stats,
      };
    });

    res.json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_FLASH_SALES_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// UPDATE FLASH SALE
exports.updateFlashSale = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.updateFlashSale",
    requestId,
    shopId: req.shop._id.toString(),
    flashSaleId: req.params.id,
  };

  logger.info({
    ...context,
    event: "UPDATE_FLASH_SALE_START",
    body: { ...req.body, banner: req.file ? "provided" : "none" },
  });

  try {
    const { id } = req.params;

    // Find sale belonging to this shop
    let sale = await FlashSale.findOne({ _id: id, shop: req.shop._id });

    if (!sale) {
      logger.warn({
        ...context,
        event: "FLASH_SALE_NOT_FOUND",
      });
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
      });
    }

    // Cannot update expired or manually deactivated sales
    if (sale.status === "expired" || sale.status === "manually_deactivated") {
      logger.warn({
        ...context,
        event: "CANNOT_UPDATE_INACTIVE_SALE",
        currentStatus: sale.status,
      });
      return res.status(400).json({
        success: false,
        message: `Cannot update ${
          sale.status === "expired" ? "expired" : "deactivated"
        } flash sale`,
      });
    }

    const {
      name,
      startDate,
      endDate,
      discountType,
      discountValue,
      products,
      description,
    } = req.body;

    // Date validation
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (end <= start) {
        logger.warn({
          ...context,
          event: "INVALID_DATE_RANGE",
          startDate,
          endDate,
        });
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    // Discount validation
    if (discountType === "percentage" && discountValue !== undefined) {
      if (discountValue < 0 || discountValue > 100) {
        logger.warn({
          ...context,
          event: "INVALID_PERCENTAGE",
          discountValue,
        });
        return res.status(400).json({
          success: false,
          message: "Percentage must be between 0 and 100",
        });
      }
    }

    if (
      discountType === "flat" &&
      discountValue !== undefined &&
      discountValue < 0
    ) {
      logger.warn({
        ...context,
        event: "NEGATIVE_DISCOUNT",
        discountValue,
      });
      return res.status(400).json({
        success: false,
        message: "Discount value cannot be negative",
      });
    }

    // Validate products if provided
    if (products !== undefined) {
      if (!Array.isArray(products) || products.length === 0) {
        logger.warn({
          ...context,
          event: "INVALID_PRODUCTS_ARRAY",
        });
        return res.status(400).json({
          success: false,
          message: "At least one product must be selected",
        });
      }

      const productDocs = await Product.find({
        _id: { $in: products },
        shop: req.shop._id,
        status: "active",
      });

      if (productDocs.length !== products.length) {
        logger.warn({
          ...context,
          event: "INVALID_PRODUCTS",
          requested: products.length,
          found: productDocs.length,
        });
        return res.status(400).json({
          success: false,
          message:
            "Some products are invalid, inactive, or don't belong to your shop",
        });
      }

      sale.products = products;

      logger.info({
        ...context,
        event: "PRODUCTS_UPDATED",
        productCount: products.length,
      });
    }

    // Replace banner if new one uploaded
    if (req.file) {
      try {
        // Delete old banner
        if (sale.promotionalBannerPublicId) {
          await cloudinary.uploader.destroy(sale.promotionalBannerPublicId);
          logger.info({
            ...context,
            event: "OLD_BANNER_DELETED",
            publicId: sale.promotionalBannerPublicId,
          });
        }

        // Upload new banner
        const uploadResult = await cloudinary.uploader.upload(req.file.path);
        sale.promotionalBanner = uploadResult.secure_url;
        sale.promotionalBannerPublicId = uploadResult.public_id;

        logger.info({
          ...context,
          event: "NEW_BANNER_UPLOADED",
          publicId: uploadResult.public_id,
        });
      } catch (uploadErr) {
        logger.error({
          ...context,
          event: "BANNER_UPDATE_FAILED",
          error: uploadErr.message,
        });
      }
    }

    // Update fields
    if (name !== undefined) sale.name = name;
    if (startDate !== undefined) sale.startDate = new Date(startDate);
    if (endDate !== undefined) sale.endDate = new Date(endDate);
    if (discountType !== undefined) sale.discountType = discountType;
    if (discountValue !== undefined) sale.discountValue = discountValue;
    if (description !== undefined) sale.description = description;

    await sale.save();

    logger.info({
      ...context,
      event: "FLASH_SALE_UPDATED",
      flashSaleId: sale._id,
      updatedFields: Object.keys(req.body),
    });

    res.json({
      success: true,
      message: "Flash sale updated successfully",
      sale,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "UPDATE_FLASH_SALE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Server error while updating flash sale",
    });
  }
};

// DELETE FLASH SALE
exports.deleteFlashSale = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.deleteFlashSale",
    requestId,
    shopId: req.shop._id.toString(),
    flashSaleId: req.params.id,
  };

  logger.info({
    ...context,
    event: "DELETE_FLASH_SALE_START",
  });

  try {
    const { id } = req.params;
    const sale = await FlashSale.findOne({ _id: id, shop: req.shop._id });

    if (!sale) {
      logger.warn({
        ...context,
        event: "FLASH_SALE_NOT_FOUND",
      });
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
      });
    }

    // Delete banner from cloudinary
    if (sale.promotionalBannerPublicId) {
      try {
        await cloudinary.uploader.destroy(sale.promotionalBannerPublicId);
        logger.info({
          ...context,
          event: "BANNER_DELETED",
          publicId: sale.promotionalBannerPublicId,
        });
      } catch (cloudErr) {
        logger.error({
          ...context,
          event: "BANNER_DELETE_FAILED",
          error: cloudErr.message,
        });
      }
    }

    await sale.deleteOne();

    logger.info({
      ...context,
      event: "FLASH_SALE_DELETED",
      flashSaleId: sale._id,
      name: sale.name,
    });

    res.json({
      success: true,
      message: "Flash sale deleted successfully",
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "DELETE_FLASH_SALE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// DEACTIVATE FLASH SALE (Manual)
exports.deactivateFlashSale = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.deactivateFlashSale",
    requestId,
    shopId: req.shop._id.toString(),
    flashSaleId: req.params.id,
    userId: req.user.id,
  };

  logger.info({
    ...context,
    event: "DEACTIVATE_FLASH_SALE_START",
  });

  try {
    const { id } = req.params;
    const sale = await FlashSale.findOne({ _id: id, shop: req.shop._id });

    if (!sale) {
      logger.warn({
        ...context,
        event: "FLASH_SALE_NOT_FOUND",
      });
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
      });
    }

    if (sale.status === "manually_deactivated") {
      logger.warn({
        ...context,
        event: "ALREADY_DEACTIVATED",
        deactivatedAt: sale.deactivatedAt,
      });
      return res.status(400).json({
        success: false,
        message: "Flash sale is already deactivated",
      });
    }

    if (sale.status === "expired") {
      logger.warn({
        ...context,
        event: "ALREADY_EXPIRED",
        endDate: sale.endDate,
      });
      return res.status(400).json({
        success: false,
        message: "Flash sale has already expired",
      });
    }

    // Manually deactivate
    await sale.deactivateManually(req.user.id);

    logger.info({
      ...context,
      event: "FLASH_SALE_DEACTIVATED",
      flashSaleId: sale._id,
      name: sale.name,
      previousStatus: sale.status,
    });

    res.json({
      success: true,
      message: "Flash sale deactivated successfully",
      sale,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "DEACTIVATE_FLASH_SALE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// DUPLICATE FLASH SALE
exports.duplicateFlashSale = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.duplicateFlashSale",
    requestId,
    shopId: req.shop._id.toString(),
    flashSaleId: req.params.id,
  };

  logger.info({
    ...context,
    event: "DUPLICATE_FLASH_SALE_START",
  });

  try {
    const { id } = req.params;
    const old = await FlashSale.findOne({ _id: id, shop: req.shop._id });

    if (!old) {
      logger.warn({
        ...context,
        event: "FLASH_SALE_NOT_FOUND",
      });
      return res.status(404).json({
        success: false,
        message: "Flash sale not found",
      });
    }

    // Create duplicate with modified name and new dates
    const newSale = new FlashSale({
      name: `${old.name} (Copy)`,
      startDate: new Date(),
      endDate: old.endDate,
      discountType: old.discountType,
      discountValue: old.discountValue,
      products: old.products,
      description: old.description,
      promotionalBanner: old.promotionalBanner,
      promotionalBannerPublicId: old.promotionalBannerPublicId,
      shop: req.shop._id,
    });

    await newSale.save();

    logger.info({
      ...context,
      event: "FLASH_SALE_DUPLICATED",
      originalId: old._id,
      newId: newSale._id,
      name: newSale.name,
    });

    res.status(201).json({
      success: true,
      message: "Flash sale duplicated successfully",
      sale: newSale,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "DUPLICATE_FLASH_SALE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};


// GET ACTIVE FLASH SALES (Public)
exports.getActiveFlashSalesPublic = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.getActiveFlashSalesPublic",
    requestId,
  };

  logger.info({
    ...context,
    event: "GET_PUBLIC_FLASH_SALES_START",
    query: req.query,
  });

  try {
    const { shopId } = req.query;

    const now = new Date();
    
    const cacheKey = `flashSales:public:active:${shopId || 'all'}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      let query = {
        status: "active",
        startDate: { $lte: now },
        endDate: { $gte: now },
      };

      // Filter by shop if provided
      if (shopId) {
        const Shop = require("../models/Shop");
        const shop = await Shop.findOne({ _id: shopId, status: "active" });
        if (!shop) {
          logger.warn({
            ...context,
            event: "INVALID_SHOP",
            shopId,
          });
          return { error: 400, message: "Invalid shop" };
        }
        query.shop = shopId;
      }

      const flashSales = await FlashSale.find(query)
        .populate(
          "products",
          "productName unitPrice icon1 discountType discountValue"
        )
        .populate("shop", "shopName")
        .select(
          "name startDate endDate discountType discountValue promotionalBanner description products shop"
        )
        .sort({ endDate: 1 })
        .limit(20)
        .lean();

      // Calculate time remaining for each sale
      const flashSalesWithTime = flashSales.map((sale) => {
        const timeLeft = sale.endDate - now;
        const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
        const minutesLeft = Math.floor(
          (timeLeft % (1000 * 60 * 60)) / (1000 * 60)
        );

        return {
          ...sale,
          timeRemaining: {
            hours: hoursLeft,
            minutes: minutesLeft,
            totalMs: timeLeft,
          },
          isEndingSoon: hoursLeft < 24,
        };
      });

      logger.info({
        ...context,
        event: "PUBLIC_FLASH_SALES_RETRIEVED",
        count: flashSalesWithTime.length,
      });

      return {
        success: true,
        count: flashSalesWithTime.length,
        flashSales: flashSalesWithTime,
      };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({
        success: false,
        message: responseData.message,
      });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_PUBLIC_FLASH_SALES_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// GET FLASH SALE DETAILS (Public)
exports.getFlashSaleDetailsPublic = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.getFlashSaleDetailsPublic",
    requestId,
    flashSaleId: req.params.id,
  };

  logger.info({
    ...context,
    event: "GET_FLASH_SALE_DETAILS_START",
  });

  try {
    const { id } = req.params;

    const cacheKey = `flashSales:public:details:${id}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const now = new Date();
      const flashSale = await FlashSale.findOne({
        _id: id,
        status: "active",
        startDate: { $lte: now },
        endDate: { $gte: now },
      })
        .populate({
          path: "products",
          match: { status: "active" },
          select:
            "productName unitPrice icon1 discountType discountValue currentStock sku",
          populate: { path: "shop", select: "shopName" },
        })
        .populate("shop", "shopName logo")
        .lean();

      if (!flashSale) {
        logger.warn({
          ...context,
          event: "FLASH_SALE_NOT_FOUND_OR_EXPIRED",
        });
        return { error: 404, message: "Flash sale not found or expired" };
      }

      // Calculate pricing for each product
      const productsWithPricing = flashSale.products.map((product) => {
        // Step 1: Product discount
        let priceAfterProductDiscount = product.unitPrice;
        if (product.discountType === "flat") {
          priceAfterProductDiscount = Math.max(
            0,
            product.unitPrice - (product.discountValue || 0)
          );
        } else if (product.discountType === "percentage") {
          priceAfterProductDiscount = Math.max(
            0,
            product.unitPrice -
              (product.unitPrice * (product.discountValue || 0)) / 100
          );
        }

        // Step 2: Flash sale discount
        let flashSaleDiscount = 0;
        let finalPrice = priceAfterProductDiscount;

        if (flashSale.discountType === "flat") {
          flashSaleDiscount = flashSale.discountValue;
          finalPrice = Math.max(0, priceAfterProductDiscount - flashSaleDiscount);
        } else if (flashSale.discountType === "percentage") {
          flashSaleDiscount =
            (priceAfterProductDiscount * flashSale.discountValue) / 100;
          finalPrice = Math.max(0, priceAfterProductDiscount - flashSaleDiscount);
        }

        return {
          ...product,
          pricing: {
            originalPrice: product.unitPrice,
            priceAfterProductDiscount,
            flashSaleDiscount,
            finalPrice,
            savingsAmount: product.unitPrice - finalPrice,
            savingsPercentage: (
              ((product.unitPrice - finalPrice) / product.unitPrice) *
              100
            ).toFixed(0),
          },
        };
      });

      // Time remaining
      const timeLeft = flashSale.endDate - now;
      const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

      logger.info({
        ...context,
        event: "FLASH_SALE_DETAILS_RETRIEVED",
        productCount: productsWithPricing.length,
      });

      return {
        success: true,
        flashSale: {
          ...flashSale,
          products: productsWithPricing,
          timeRemaining: {
            hours: hoursLeft,
            minutes: minutesLeft,
            totalMs: timeLeft,
          },
          isEndingSoon: hoursLeft < 24,
        },
      };
    });

    if (responseData.error) {
      return res.status(responseData.error).json({
        success: false,
        message: responseData.message,
      });
    }

    res.json(responseData);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_FLASH_SALE_DETAILS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// Auto activate/deactivate flash sales based on dates
exports.updateFlashSaleStatuses = async () => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.updateFlashSaleStatuses",
    requestId,
    type: "CRON_JOB",
  };

  logger.info({
    ...context,
    event: "CRON_UPDATE_STATUSES_START",
  });

  try {
    const now = new Date();

    // Activate scheduled sales that have started
    const toActivate = await FlashSale.find({
      status: "scheduled",
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    for (const sale of toActivate) {
      sale.status = "active";
      await sale.save();

      logger.info({
        ...context,
        event: "FLASH_SALE_ACTIVATED",
        flashSaleId: sale._id,
        name: sale.name,
        shopId: sale.shop,
      });
    }

    // Expire active sales that have ended
    const toExpire = await FlashSale.find({
      status: "active",
      endDate: { $lt: now },
    });

    for (const sale of toExpire) {
      sale.status = "expired";
      sale.deactivatedAt = now;
      sale.deactivationReason = "expired";
      await sale.save();

      logger.info({
        ...context,
        event: "FLASH_SALE_EXPIRED",
        flashSaleId: sale._id,
        name: sale.name,
        shopId: sale.shop,
      });
    }

    logger.info({
      ...context,
      event: "CRON_UPDATE_STATUSES_COMPLETE",
      activated: toActivate.length,
      expired: toExpire.length,
    });

    return {
      activated: toActivate.length,
      expired: toExpire.length,
    };
  } catch (err) {
    logger.error({
      ...context,
      event: "CRON_UPDATE_STATUSES_ERROR",
      error: err.message,
      stack: err.stack,
    });
    throw err;
  }
};

// ADD THIS TO YOUR flashsaleController.js

// GET FLASH SALE STATISTICS FOR SHOPKEEPER
exports.getFlashSaleStats = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "flashsaleController.getFlashSaleStats",
    requestId,
    shopId: req.shop._id.toString(),
  };

  logger.info({
    ...context,
    event: "GET_FLASH_SALE_STATS_START",
  });

  try {
    const shopId = req.shop._id;
    const now = new Date();
    
    // Get start of current month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Get start of last month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // Get start of last week
    const startOfLastWeek = new Date(now);
    startOfLastWeek.setDate(now.getDate() - 7);

    // ===== 1. ACTIVE FLASH SALES =====
    const activeFlashSales = await FlashSale.countDocuments({
      shop: shopId,
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
    });

    // Active flash sales this month
    const activeThisMonth = await FlashSale.countDocuments({
      shop: shopId,
      status: "active",
      startDate: { $lte: now },
      endDate: { $gte: now },
      createdAt: { $gte: startOfMonth },
    });

    // Active flash sales last month
    const activeLastMonth = await FlashSale.countDocuments({
      shop: shopId,
      status: "active",
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
    });

    // Calculate percentage change
    const activePercentChange = activeLastMonth > 0
      ? ((activeThisMonth - activeLastMonth) / activeLastMonth) * 100
      : activeThisMonth > 0 ? 100 : 0;

    logger.debug({
      ...context,
      event: "ACTIVE_FLASH_SALES_CALCULATED",
      activeFlashSales,
      activeThisMonth,
      activeLastMonth,
      activePercentChange,
    });

    // ===== 2. TOTAL FLASH SALES =====
    const totalFlashSales = await FlashSale.countDocuments({
      shop: shopId,
    });

    // Total this month
    const totalThisMonth = await FlashSale.countDocuments({
      shop: shopId,
      createdAt: { $gte: startOfMonth },
    });

    // Percentage of all-time
    const totalPercentOfAllTime = totalFlashSales > 0
      ? (totalThisMonth / totalFlashSales) * 100
      : 0;

    logger.debug({
      ...context,
      event: "TOTAL_FLASH_SALES_CALCULATED",
      totalFlashSales,
      totalThisMonth,
      totalPercentOfAllTime,
    });

    // ===== 3. UPCOMING SALES =====
    const upcomingSales = await FlashSale.countDocuments({
      shop: shopId,
      status: "scheduled",
      startDate: { $gt: now },
    });

    // Upcoming sales from last week
    const upcomingLastWeek = await FlashSale.countDocuments({
      shop: shopId,
      status: "scheduled",
      createdAt: { $gte: startOfLastWeek, $lt: now },
    });

    // Calculate percentage change from last week
    const upcomingPercentChange = upcomingLastWeek > 0
      ? ((upcomingSales - upcomingLastWeek) / upcomingLastWeek) * 100
      : upcomingSales > 0 ? 100 : 0;

    logger.debug({
      ...context,
      event: "UPCOMING_SALES_CALCULATED",
      upcomingSales,
      upcomingLastWeek,
      upcomingPercentChange,
    });

    // ===== 4. AVERAGE DISCOUNT =====
    const discountStats = await FlashSale.aggregate([
      {
        $match: {
          shop: shopId,
        },
      },
      {
        $group: {
          _id: null,
          avgDiscount: { $avg: "$discountValue" },
          totalSales: { $sum: 1 },
          flatDiscounts: {
            $sum: {
              $cond: [{ $eq: ["$discountType", "flat"] }, "$discountValue", 0],
            },
          },
          percentageDiscounts: {
            $sum: {
              $cond: [
                { $eq: ["$discountType", "percentage"] },
                "$discountValue",
                0,
              ],
            },
          },
          flatCount: {
            $sum: { $cond: [{ $eq: ["$discountType", "flat"] }, 1, 0] },
          },
          percentageCount: {
            $sum: { $cond: [{ $eq: ["$discountType", "percentage"] }, 1, 0] },
          },
        },
      },
    ]);

    const avgDiscountValue = discountStats.length > 0 
      ? discountStats[0].avgDiscount || 0 
      : 0;

    const flatDiscountAvg = discountStats.length > 0 && discountStats[0].flatCount > 0
      ? discountStats[0].flatDiscounts / discountStats[0].flatCount
      : 0;

    const percentageDiscountAvg = discountStats.length > 0 && discountStats[0].percentageCount > 0
      ? discountStats[0].percentageDiscounts / discountStats[0].percentageCount
      : 0;

    // Calculate discount distribution percentage
    const totalDiscountCount = discountStats.length > 0 ? discountStats[0].totalSales : 0;
    const flatPercentage = totalDiscountCount > 0 && discountStats.length > 0
      ? (discountStats[0].flatCount / totalDiscountCount) * 100
      : 0;
    const percentagePercentage = totalDiscountCount > 0 && discountStats.length > 0
      ? (discountStats[0].percentageCount / totalDiscountCount) * 100
      : 0;

    logger.debug({
      ...context,
      event: "AVERAGE_DISCOUNT_CALCULATED",
      avgDiscountValue,
      flatDiscountAvg,
      percentageDiscountAvg,
      flatPercentage,
      percentagePercentage,
    });

    // ===== ADDITIONAL STATS =====
    const expiredSales = await FlashSale.countDocuments({
      shop: shopId,
      status: "expired",
    });

    const manuallyDeactivatedSales = await FlashSale.countDocuments({
      shop: shopId,
      status: "manually_deactivated",
    });

    // Get most recent flash sales
    const recentFlashSales = await FlashSale.find({
      shop: shopId,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("name status startDate endDate discountType discountValue createdAt")
      .lean();

    logger.info({
      ...context,
      event: "FLASH_SALE_STATS_CALCULATED",
      activeFlashSales,
      totalFlashSales,
      upcomingSales,
      avgDiscountValue,
    });

    res.json({
      success: true,
      stats: {
        activeFlashSales: {
          count: activeFlashSales,
          thisMonth: activeThisMonth,
          lastMonth: activeLastMonth,
          percentChange: Number(activePercentChange.toFixed(2)),
          trend: activePercentChange > 0 ? "up" : activePercentChange < 0 ? "down" : "stable",
        },
        totalFlashSales: {
          count: totalFlashSales,
          thisMonth: totalThisMonth,
          percentOfAllTime: Number(totalPercentOfAllTime.toFixed(2)),
        },
        upcomingSales: {
          count: upcomingSales,
          lastWeek: upcomingLastWeek,
          percentChange: Number(upcomingPercentChange.toFixed(2)),
          trend: upcomingPercentChange > 0 ? "up" : upcomingPercentChange < 0 ? "down" : "stable",
        },
        averageDiscount: {
          overall: Number(avgDiscountValue.toFixed(2)),
          flat: {
            average: Number(flatDiscountAvg.toFixed(2)),
            percentage: Number(flatPercentage.toFixed(2)),
            count: discountStats.length > 0 ? discountStats[0].flatCount : 0,
          },
          percentage: {
            average: Number(percentageDiscountAvg.toFixed(2)),
            percentage: Number(percentagePercentage.toFixed(2)),
            count: discountStats.length > 0 ? discountStats[0].percentageCount : 0,
          },
        },
        statusBreakdown: {
          active: activeFlashSales,
          scheduled: upcomingSales,
          expired: expiredSales,
          manuallyDeactivated: manuallyDeactivatedSales,
        },
        recentFlashSales,
      },
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_FLASH_SALE_STATS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: "Server error while fetching flash sale statistics",
    });
  }
};
