const Product = require("../models/productModel");
const Shop = require("../models/Shop");
const { generateProductSchema } = require("../utils/productSchema");
const NewArrivalSetting = require("../models/NewArrivalSetting");
const TopRatedSetting = require("../models/TopRatedSettings");
const StockMovement = require("../models/InventoryReport");
const logger = require("../config/logger");
const crypto = require("crypto");
const ProductCategory = require("../models/ProductCategory");
const ProductSubCategory = require("../models/SubProductCategory");

const cloudinary = require("../config/cloudinary");

//  CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const shop = req.shop;

    const {
      productId,
      productName,
      description,
      category,
      subCategory,
      unit,
      sku,
      searchTags,
      unitPrice,
      minOrderQty,
      currentStock,
      minStockQty,
      discountType,
      discountValue,
      taxType,
      shippingCost,
      metaTitle,
      metaDescription,
      status,
    } = req.body;

    logger.info({
      route: "productController.createProduct",
      event: "PRODUCT_CREATE_REQUEST",
      shopId: shop?._id?.toString(),
      shopStatus: shop?.status,
      productName,
      category,
      subCategory,
      status,
    });

    // Validate category & subcategory before creating product
    const cat = await ProductCategory.findOne({
      _id: category,
      status: "active",
    });
    if (!cat) {
      logger.warn({
        route: "productController.createProduct",
        event: "PRODUCT_CREATE_INVALID_CATEGORY",
        category,
        shopId: shop?._id?.toString(),
      });
      return res.status(400).json({ message: "Invalid or inactive category" });
    }

    const sub = await ProductSubCategory.findOne({
      _id: subCategory,
      category,
    });
    if (!sub) {
      logger.warn({
        route: "productController.createProduct",
        event: "PRODUCT_CREATE_INVALID_SUBCATEGORY",
        category,
        subCategory,
        shopId: shop?._id?.toString(),
      });
      return res
        .status(400)
        .json({ message: "Invalid or mismatched subcategory" });
    }

    let icon1 = null,
      icon1PublicId = null,
      metaImageUrl = null,
      metaImagePublicId = null;

    if (req.files && req.files.icon1 && req.files.icon1[0]) {
      const upload1 = await cloudinary.uploader.upload(req.files.icon1[0].path);
      icon1 = upload1.secure_url;
      icon1PublicId = upload1.public_id;
    }

    let icon2 = [];
    let icon2PublicIds = [];

    if (req.files && req.files.icon2 && req.files.icon2.length > 0) {
      for (const file of req.files.icon2) {
        const upload = await cloudinary.uploader.upload(file.path);
        icon2.push(upload.secure_url);
        icon2PublicIds.push(upload.public_id);
      }
    }

    if (req.files && req.files.metaImage && req.files.metaImage[0]) {
      const uploadMeta = await cloudinary.uploader.upload(
        req.files.metaImage[0].path
      );
      metaImageUrl = uploadMeta.secure_url;
      metaImagePublicId = uploadMeta.public_id;
    }

    let formattedTags = [];
    if (searchTags) {
      if (typeof searchTags === "string") {
        formattedTags = searchTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
      } else if (Array.isArray(searchTags)) {
        formattedTags = searchTags.map((t) => t.trim().toLowerCase());
      }
    }

    const sanitizeNumber = (value) => {
      if (typeof value === 'string') {
        return parseFloat(value.replace(/,/g, '')) || 0;
      }
      return value || 0;
    };

    const sanitizedUnitPrice = sanitizeNumber(unitPrice);
    const sanitizedMinOrderQty = sanitizeNumber(minOrderQty);
    const sanitizedCurrentStock = sanitizeNumber(currentStock);
    const sanitizedMinStockQty = sanitizeNumber(minStockQty);
    const sanitizedDiscountValue = sanitizeNumber(discountValue);
    const sanitizedShippingCost = sanitizeNumber(shippingCost);

    if (discountType === "flat" && sanitizedDiscountValue > sanitizedUnitPrice) {
      return res.status(400).json({
        message: "Flat discount cannot exceed unit price",
      });
    }

    if (
      discountType === "percentage" &&
      (sanitizedDiscountValue < 0 || sanitizedDiscountValue > 100)
    ) {
      return res.status(400).json({
        message: "Percentage discount must be between 0 and 100",
      });
    }

    const product = await Product.create({
      shop: shop._id,
      productId,
      productName,
      description,
      category,
      subCategory,
      unit,
      sku,
      searchTags: formattedTags,

      unitPrice: sanitizedUnitPrice,
      minOrderQty: sanitizedMinOrderQty,
      currentStock: sanitizedCurrentStock,
      minStockQty: sanitizedMinStockQty,
      discountType,
      discountValue: sanitizedDiscountValue,
      taxType,
      shippingCost: sanitizedShippingCost,
      metaTitle,
      metaDescription,
      metaImage: metaImageUrl,
      metaImagePublicId,
      icon1,
      icon1PublicId,
      icon2,
      icon2PublicIds,

      status,
    });

    logger.info({
      route: "productController.createProduct",
      event: "PRODUCT_CREATE_SUCCESS",
      productId: product._id,
      shopId: shop._id,
      category,
      subCategory,
      status: product.status,
    });

    res.status(201).json({ success: true, product });
  } catch (err) {
    logger.error({
      route: "productController.createProduct",
      event: "PRODUCT_CREATE_ERROR",
      error: err.message,
      stack: err.stack,
      shopId: req.shop?._id?.toString(),
    });
    res.status(500).json({ message: err.message });
  }
};

//  UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const productId = req.params.id;

    const shop = req.shop;

    let product = await Product.findOne({ _id: productId, shop: shop._id });
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    //  Handle new image uploads + delete old from Cloudinary
    if (req.files && req.files.icon1 && req.files.icon1[0]) {
      if (product.icon1PublicId)
        await cloudinary.uploader.destroy(product.icon1PublicId);
      const upload1 = await cloudinary.uploader.upload(req.files.icon1[0].path);
      product.icon1 = upload1.secure_url;
      product.icon1PublicId = upload1.public_id;
    }

    if (req.files && req.files.icon2 && req.files.icon2.length > 0) {
      if (product.icon2PublicIds && product.icon2PublicIds.length > 0) {
        for (const id of product.icon2PublicIds) {
          await cloudinary.uploader.destroy(id);
        }
      }

      let newIcons = [];
      let newIconPublicIds = [];

      for (const file of req.files.icon2) {
        const upload = await cloudinary.uploader.upload(file.path);
        newIcons.push(upload.secure_url);
        newIconPublicIds.push(upload.public_id);
      }

      product.icon2 = newIcons;
      product.icon2PublicIds = newIconPublicIds;
    }

    if (req.files && req.files.metaImage && req.files.metaImage[0]) {
      if (product.metaImagePublicId)
        await cloudinary.uploader.destroy(product.metaImagePublicId);
      const uploadMeta = await cloudinary.uploader.upload(
        req.files.metaImage[0].path
      );
      product.metaImage = uploadMeta.secure_url;
      product.metaImagePublicId = uploadMeta.public_id;
    }

    if (req.body.searchTags) {
      if (typeof req.body.searchTags === "string") {
        req.body.searchTags = req.body.searchTags
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean);
      } else if (Array.isArray(req.body.searchTags)) {
        req.body.searchTags = req.body.searchTags.map((t) =>
          t.trim().toLowerCase()
        );
      }
    }

    const sanitizeNumber = (value) => {
      if (typeof value === 'string') {
        return parseFloat(value.replace(/,/g, '')) || 0;
      }
      return value || 0;
    };

    if (req.body.unitPrice) req.body.unitPrice = sanitizeNumber(req.body.unitPrice);
    if (req.body.minOrderQty) req.body.minOrderQty = sanitizeNumber(req.body.minOrderQty);
    if (req.body.currentStock) req.body.currentStock = sanitizeNumber(req.body.currentStock);
    if (req.body.minStockQty) req.body.minStockQty = sanitizeNumber(req.body.minStockQty);
    if (req.body.discountValue) req.body.discountValue = sanitizeNumber(req.body.discountValue);
    if (req.body.shippingCost) req.body.shippingCost = sanitizeNumber(req.body.shippingCost);

    if (
      req.body.discountType === "flat" &&
      req.body.discountValue > (req.body.unitPrice || product.unitPrice)
    ) {
      return res
        .status(400)
        .json({ message: "Flat discount cannot exceed unit price" });
    }
    if (
      req.body.discountType === "percentage" &&
      (req.body.discountValue < 0 || req.body.discountValue > 100)
    ) {
      return res
        .status(400)
        .json({ message: "Percentage discount must be between 0 and 100" });
    }

    //  Update remaining fields
    Object.assign(product, req.body);
    await product.save();

    res.status(200).json({ success: true, product });
  } catch (err) {
    console.error("updateProduct error:", err);
    res.status(500).json({ message: err.message });
  }
};

// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const shop = req.shop;

    const product = await Product.findOne({
      _id: req.params.id,
      shop: shop._id,
    });

    if (!product) return res.status(404).json({ message: "Product not found" });

    //  Delete images from Cloudinary
    if (product.icon1PublicId)
      await cloudinary.uploader.destroy(product.icon1PublicId);
    if (product.icon2PublicId)
      await cloudinary.uploader.destroy(product.icon2PublicId);
    if (product.metaImagePublicId)
      await cloudinary.uploader.destroy(product.metaImagePublicId);

    await product.deleteOne();
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("deleteProduct error:", err);
    res.status(500).json({ message: err.message });
  }
};

// GET PRODUCTS
exports.getProducts = async (req, res) => {
  try {
    const shop = req.shop;

    const { filter, search } = req.query;
    let query = { shop: shop._id };

    //  Filter options
    if (filter === "draft") query.status = "draft";
    if (filter === "active") query.status = "active";
    if (filter === "inactive") query.status = "inactive";
    if (filter === "low_stock") query.currentStock = { $lt: 10 };
    if (filter === "out_of_stock") query.currentStock = 0;

    //  Search by name, sku, or tags
    if (search) {
      query.$or = [
        { productName: { $regex: search, $options: "i" } },
        { sku: { $regex: search, $options: "i" } },
        { searchTags: { $regex: search, $options: "i" } },
      ];
    }

    const products = await Product.find(query)
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Only calculate discount, not tax
    products.forEach((p) => {
      let finalPrice = p.unitPrice;
      if (p.discountType === "flat") {
        finalPrice = Math.max(0, p.unitPrice - p.discountValue);
      } else if (p.discountType === "percentage") {
        finalPrice = Math.max(
          0,
          p.unitPrice - (p.unitPrice * p.discountValue) / 100
        );
      }

      p.finalPrice = finalPrice;
      // priceWithTax will be calculated at cart level based on customer's region
    });

    logger.info({
      route: "productController.getProducts",
      event: "SHOP_PRODUCTS_FETCHED",
      shopId: shop._id,
      filter,
      search,
      resultCount: products.length,
    });

    res.json({ success: true, products });
  } catch (err) {
    logger.error({
      route: "productController.getProducts",
      event: "SHOP_PRODUCTS_ERROR",
      error: err.message,
      stack: err.stack,
      shopId: req.shop?._id?.toString(),
    });
    res.status(500).json({ message: err.message });
  }
};

exports.getInventoryData = async (req, res) => {
  try {
    const shop = req.shop;

    const products = await Product.find({ shop: shop._id })
      .populate("category", "name")
      .populate("subCategory", "name")
      .sort({ createdAt: -1 });

    const totalValue = products.reduce(
      (sum, p) => sum + p.unitPrice * p.currentStock,
      0
    );
    const itemsInStock = products.reduce(
      (sum, p) => sum + (p.currentStock || 0),
      0
    );

    const lowStockItems = products.filter(
      (p) => p.currentStock > 0 && p.currentStock <= p.minStockQty
    );
    const outOfStockItems = products.filter((p) => p.currentStock === 0);

    const inventoryAlerts = [
      ...lowStockItems.map((p) => ({
        _id: p._id,
        productName: p.productName,
        currentStock: p.currentStock,
        minStockQty: p.minStockQty,
        actionType: "Reorder",
        status: "low_stock",
      })),
      ...outOfStockItems.map((p) => ({
        _id: p._id,
        productName: p.productName,
        currentStock: p.currentStock,
        minStockQty: p.minStockQty,
        actionType: "Restock",
        status: "out_of_stock",
      })),
    ];

    const inventoryManagement = products.map((p) => ({
      _id: p._id,
      productName: p.productName,
      category: p.category?.name,
      subCategory: p.subCategory?.name,
      currentStock: p.currentStock,
      unitPrice: p.unitPrice,
      sku: p.sku,
      status: p.status,
      minStockQty: p.minStockQty,
    }));

    logger.info({
      route: "productController.getInventoryData",
      event: "INVENTORY_DATA_READY",
      shopId: shop._id,
      productCount: products.length,
      totalValue,
      itemsInStock,
      lowStockCount: lowStockItems.length,
      outOfStockCount: outOfStockItems.length,
    });

    res.json({
      success: true,
      summary: {
        totalValue,
        itemsInStock,
        lowStockCount: lowStockItems.length,
        outOfStockCount: outOfStockItems.length,
      },
      inventoryAlerts,
      inventoryManagement,
    });
  } catch (err) {
    logger.error({
      route: "productController.getInventoryData",
      event: "INVENTORY_DATA_ERROR",
      error: err.message,
      stack: err.stack,
      shopId: req.shop?._id?.toString(),
    });
    res.status(500).json({ message: err.message });
  }
};

// GET PUBLIC PRODUCTS
exports.getPublicProducts = async (req, res) => {
  try {
    const { search, category, subCategory, shop, isNewArrival, isTopRated } =
      req.query;

    logger.info({
      route: "productController.getPublicProducts",
      event: "PUBLIC_PRODUCTS_REQUEST",
      search,
      category,
      subCategory,
      shop,
      isNewArrival,
      isTopRated,
    });

    let query = { status: "active" };
    let projection = {};
    let sort = { createdAt: -1 };
    let products = [];

    if (shop) {
      const shopDoc = await Shop.findOne({ _id: shop, status: "active" });
      if (!shopDoc) {
        logger.warn({
          route: "productController.getPublicProducts",
          event: "PUBLIC_PRODUCTS_INVALID_SHOP",
          shop,
        });
        return res.status(400).json({ message: "Invalid shop" });
      }
      query.shop = shopDoc._id;
    } else {
      const activeShops = await Shop.find({ status: "active" }).select("_id");
      query.shop = { $in: activeShops.map((s) => s._id) };
      logger.info({
        route: "productController.getPublicProducts",
        event: "PUBLIC_PRODUCTS_ACTIVE_SHOPS",
        activeShopCount: activeShops.length,
      });
    }

    if (category) query.category = category;
    if (subCategory) query.subCategory = subCategory;

    if (search && search.trim() !== "") {
      try {
        const textQuery = { ...query, $text: { $search: search } };
        projection = { score: { $meta: "textScore" } };
        sort = { score: { $meta: "textScore" }, createdAt: -1 };

        products = await Product.find(textQuery, projection)
          .populate("shop", "shopName logo")
          .populate("category", "name")
          .populate("subCategory", "name")
          .sort(sort)
          .limit(50)
          .lean();
      } catch (err) {
        logger.warn({
          route: "productController.getPublicProducts",
          event: "PUBLIC_PRODUCTS_TEXT_SEARCH_UNSUPPORTED",
          error: err.message,
        });
      }

      if (!products.length) {
        const regexQuery = {
          ...query,
          $or: [
            { productName: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            { searchTags: { $regex: search, $options: "i" } },
          ],
        };

        projection = {};
        sort = { createdAt: -1 };

        products = await Product.find(regexQuery, projection)
          .populate("shop", "shopName logo")
          .populate("category", "name")
          .populate("subCategory", "name")
          .sort(sort)
          .limit(50)
          .lean();
      }
    } else {
      products = await Product.find(query, projection)
        .populate("shop", "shopName logo")
        .populate("category", "name")
        .populate("subCategory", "name")
        .sort(sort)
        .limit(50)
        .lean();
    }

    if (isNewArrival === "true") {
      const setting = (await NewArrivalSetting.findOne()) || {
        durationType: "7days",
        sortingMode: "default",
        customSortOption: "latest_created",
      };

      const now = new Date();
      let durationDays = 7;

      switch (setting.durationType) {
        case "15days":
          durationDays = 15;
          break;
        case "30days":
        case "1month":
          durationDays = 30;
          break;
        case "3months":
          durationDays = 90;
          break;
        case "6months":
          durationDays = 180;
          break;
      }

      const dateThreshold = new Date(now - durationDays * 24 * 60 * 60 * 1000);
        products = products.filter((p) => new Date(p.createdAt) >= dateThreshold);

      if (setting.sortingMode === "custom") {
        switch (setting.customSortOption) {
          case "first_created":
            products.sort(
              (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
            );
            break;
          case "A_to_Z":
            products.sort((a, b) => a.productName.localeCompare(b.productName));
            break;
          case "Z_to_A":
            products.sort((a, b) => b.productName.localeCompare(a.productName));
            break;
          case "most_reviews":
            products.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
          case "best_rating":
            products.sort((a, b) => b.averageRating - a.averageRating);
            break;
          default:
            break;
        }
      }
    }

    if (isTopRated === "true") {
      const setting = (await TopRatedSetting.findOne()) || {
        sortingMode: "default",
        filterOption: "4plus",
        customSortOption: "average_rating",
      };

      let minRating = 4;
      if (setting.filterOption === "3plus") minRating = 3;
      if (setting.filterOption === "all") minRating = 0;

      products = products.filter((p) => p.averageRating >= minRating);

      if (setting.sortingMode === "custom") {
        switch (setting.customSortOption) {
          case "most_reviews":
            products.sort((a, b) => b.reviewCount - a.reviewCount);
            break;
          case "average_rating":
            products.sort((a, b) => b.averageRating - a.averageRating);
            break;
          case "most_orders":
            products.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
            break;
          default:
            break;
        }
      } else {
        products.sort((a, b) => b.averageRating - a.averageRating);
      }
    }

    // Only calculate discount, not tax
    products.forEach((p) => {
      let finalPrice = p.unitPrice;
      if (p.discountType === "flat") {
        finalPrice = Math.max(0, p.unitPrice - p.discountValue);
      } else if (p.discountType === "percentage") {
        finalPrice = Math.max(
          0,
          p.unitPrice - (p.unitPrice * p.discountValue) / 100
        );
      }

      p.finalPrice = finalPrice;
      // priceWithTax will be calculated at cart level based on customer's region
    });
    logger.info({
      route: "productController.getPublicProducts",
      event: "PUBLIC_PRODUCTS_SUCCESS",
      search,
      category,
      subCategory,
      shop,
      isNewArrival,
      isTopRated,
      count: products.length,
    });

    res.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (err) {
    logger.error({
      route: "productController.getPublicProducts",
      event: "PUBLIC_PRODUCTS_ERROR",
      error: err.message,
      stack: err.stack,
      search: req.query?.search,
      category: req.query?.category,
      subCategory: req.query?.subCategory,
      shop: req.query?.shop,
    });
    res.status(500).json({ message: err.message });
  }
};

// exports.getPublicProducts = async (req, res) => {
//   try {
//     const { search, category, subCategory, shop, isNewArrival, isTopRated } =
//       req.query;

//     let query = { status: "active" };
//     let projection = {};
//     let sort = { createdAt: -1 };

//     if (shop) {
//       const shopDoc = await Shop.findOne({ _id: shop, status: "active" });
//       if (!shopDoc) return res.status(400).json({ message: "Invalid shop" });
//       query.shop = shopDoc._id;
//     } else {
//       const activeShops = await Shop.find({ status: "active" }).select("_id");
//       query.shop = { $in: activeShops.map((s) => s._id) };
//     }

//     if (category) query.category = category;
//     if (subCategory) query.subCategory = subCategory;

//     if (search && search.trim() !== "") {
//       query.$or = [
//         { $text: { $search: search } },
//         { productName: { $regex: search, $options: "i" } },
//         { description: { $regex: search, $options: "i" } },
//         { searchTags: { $regex: search, $options: "i" } },
//       ];

//       projection = { score: { $meta: "textScore" } };
//       sort = { score: { $meta: "textScore" }, createdAt: -1 };
//     }

//     if (isNewArrival === "true") {
//       const setting = (await NewArrivalSetting.findOne()) || {
//         durationType: "7days",
//         sortingMode: "default",
//         customSortOption: "latest_created",
//       };

//       const now = new Date();
//       let durationDays = 7;

//       switch (setting.durationType) {
//         case "15days":
//           durationDays = 15;
//           break;
//         case "30days":
//         case "1month":
//           durationDays = 30;
//           break;
//         case "3months":
//           durationDays = 90;
//           break;
//         case "6months":
//           durationDays = 180;
//           break;
//       }

//       const dateThreshold = new Date(now - durationDays * 24 * 60 * 60 * 1000);
//       query.createdAt = { $gte: dateThreshold };

//       if (setting.sortingMode === "custom") {
//         switch (setting.customSortOption) {
//           case "first_created":
//             sort = { createdAt: 1 };
//             break;
//           case "A_to_Z":
//             sort = { productName: 1 };
//             break;
//           case "Z_to_A":
//             sort = { productName: -1 };
//             break;
//           case "most_reviews":
//             sort = { reviewCount: -1 };
//             break;
//           case "best_rating":
//             sort = { averageRating: -1 };
//             break;
//           default:
//             sort = { createdAt: -1 };
//         }
//       } else {
//         sort = { createdAt: -1 };
//       }
//     }

//     if (isTopRated === "true") {
//       const setting = (await TopRatedSetting.findOne()) || {
//         sortingMode: "default",
//         filterOption: "4plus",
//         customSortOption: "average_rating",
//       };

//       let queryFilter = { averageRating: { $gte: 4 } };
//       sort = { averageRating: -1, reviewCount: -1 };

//       if (setting.sortingMode === "custom") {
//         if (setting.filterOption === "3plus")
//           queryFilter = { averageRating: { $gte: 3 } };
//         else if (setting.filterOption === "4plus")
//           queryFilter = { averageRating: { $gte: 4 } };
//         else queryFilter = {};

//         switch (setting.customSortOption) {
//           case "most_reviews":
//             sort = { reviewCount: -1 };
//             break;
//           case "average_rating":
//             sort = { averageRating: -1 };
//             break;
//           case "most_orders":
//             sort = { orderCount: -1 };
//             break;
//           default:
//             sort = { averageRating: -1 };
//         }
//       }

//       Object.assign(query, queryFilter);
//     }

//     const products = await Product.find(query, projection)
//       .populate("shop", "shopName logo")
//       .populate("category", "name")
//       .populate("subCategory", "name")
//       .sort(sort)
//       .limit(50)
//       .lean();

//     products.forEach((p) => {
//       let finalPrice = p.unitPrice;
//       if (p.discountType === "flat") {
//         finalPrice = Math.max(0, p.unitPrice - p.discountValue);
//       } else if (p.discountType === "percentage") {
//         finalPrice = Math.max(
//           0,
//           p.unitPrice - (p.unitPrice * p.discountValue) / 100
//         );
//       }

//       const taxAmount = (finalPrice * (p.taxPercentage || 18)) / 100;
//       const priceWithTax =
//         p.taxType === "inclusive" ? finalPrice : finalPrice + taxAmount;

//       p.finalPrice = finalPrice;
//       p.priceWithTax = priceWithTax;
//     });

//     const schemas = products.map((p) => generateProductSchema(p));

//     res.json({
//       success: true,
//       count: products.length,
//       products,
//     });
//   } catch (err) {
//     console.error("getPublicProducts error:", err);
//     res.status(500).json({ message: err.message });
//   }
// };

exports.getSinglePublicProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, status: "active" })
      .populate("shop", "shopName logo")
      .populate("category", "name")
      .populate("subCategory", "name");

    if (!product) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    const shopDoc = await Shop.findOne({
      _id: product.shop._id,
      status: "active",
    });
    if (!shopDoc) {
      return res.status(400).json({ message: "Shop inactive" });
    }

    // Only calculate discount, not tax
    let finalPrice = product.unitPrice;
    if (product.discountType === "flat") {
      finalPrice = Math.max(0, product.unitPrice - product.discountValue);
    } else if (product.discountType === "percentage") {
      finalPrice = Math.max(
        0,
        product.unitPrice - (product.unitPrice * product.discountValue) / 100
      );
    }

    product.finalPrice = finalPrice;
    // Tax will be calculated at cart level based on customer's region

    const productPayload = product.toObject({ virtuals: true });
    productPayload.finalPrice = finalPrice;

    const schemaMarkup = generateProductSchema(productPayload);

    res.json({
      success: true,
      product: productPayload,
      schemaMarkup,
      schemaMarkupJson: JSON.stringify(schemaMarkup),
    });
  } catch (err) {
    console.error("getSinglePublicProduct error:", err);
    res.status(500).json({ message: err.message });
  }
};
// search suggestions for customer

exports.getSearchSuggestions = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json({ success: true, suggestions: [] });

    const suggestions = await Product.aggregate([
      {
        $match: {
          status: "active",
          $or: [
            { productName: { $regex: query, $options: "i" } },
            { searchTags: { $regex: query, $options: "i" } },
          ],
        },
      },
      {
        $project: {
          _id: 1,
          productName: 1,
          searchTags: 1,
          icon1: 1,
        },
      },
      { $limit: 10 },
    ]);

    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("getSearchSuggestions error:", err);
    res.status(500).json({ message: err.message });
  }
};

// similar products for customer

exports.getSimilarProducts = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate("shop");
    if (!product) return res.status(404).json({ message: "Not found" });

    // Get active shops to ensure we only show products from active shops
    const activeShops = await Shop.find({ status: "active" }).select("_id");
    const activeShopIds = activeShops.map((s) => s._id);

    
    let similar = await Product.find({
      _id: { $ne: product._id },
      status: "active",
      shop: { $in: activeShopIds },
      searchTags: { $in: product.searchTags },
    })
      .populate("shop", "shopName logo")
      .limit(10);

    
    if (similar.length < 10) {
      const moreProducts = await Product.find({
        _id: { $ne: product._id, $nin: similar.map((p) => p._id) },
        status: "active",
        shop: { $in: activeShopIds },
        subCategory: product.subCategory,
      })
        .populate("shop", "shopName logo")
        .limit(10 - similar.length);

      similar = [...similar, ...moreProducts];
    }

    
    if (similar.length < 10) {
      const moreCategoryProducts = await Product.find({
        _id: { $ne: product._id, $nin: similar.map((p) => p._id) },
        status: "active",
        shop: { $in: activeShopIds },
        category: product.category,
      })
        .populate("shop", "shopName logo")
        .limit(10 - similar.length);

      similar = [...similar, ...moreCategoryProducts];
    }

    
    similar.forEach((p) => {
      let finalPrice = p.unitPrice;
      if (p.discountType === "flat") {
        finalPrice = Math.max(0, p.unitPrice - p.discountValue);
      } else if (p.discountType === "percentage") {
        finalPrice = Math.max(
          0,
          p.unitPrice - (p.unitPrice * p.discountValue) / 100
        );
      }
      p.finalPrice = finalPrice;
    });

    res.json({ success: true, similar });
  } catch (err) {
    console.error("getSimilarProducts error:", err);
    res.status(500).json({ message: err.message });
  }
};

/**
 * Manual Stock Update
 * PUT /api/shopkeeper/products/:id/stock
 */
exports.updateProductStock = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "productController.updateProductStock",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
    productId: req.params.id,
  };

  logger.info({
    ...context,
    event: "STOCK_UPDATE_REQUEST",
    body: req.body,
  });

  try {
    const productId = req.params.id;
    const { quantity, reason, notes } = req.body;

    // Validate input
    if (!quantity || isNaN(quantity)) {
      logger.warn({
        ...context,
        event: "INVALID_QUANTITY",
        quantity,
      });
      return res.status(400).json({
        success: false,
        message: "Valid quantity required",
      });
    }

    if (!reason) {
      logger.warn({
        ...context,
        event: "REASON_MISSING",
      });
      return res.status(400).json({
        success: false,
        message: "Reason required",
      });
    }

    const validReasons = [
      "purchase",
      "return_from_customer",
      "return_to_supplier",
      "damage",
      "theft",
      "adjustment",
      "restock",
    ];

    if (!validReasons.includes(reason)) {
      logger.warn({
        ...context,
        event: "INVALID_REASON",
        reason,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid reason. Must be one of: " + validReasons.join(", "),
      });
    }

    const shop = req.shop;
    const product = await Product.findOne({ _id: productId, shop: shop._id });

    if (!product) {
      logger.error({
        ...context,
        event: "PRODUCT_NOT_FOUND",
      });
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const previousStock = product.currentStock;
    const quantityNum = parseInt(quantity);

    // Determine movement type
    let movementType = "in";
    let newStock = previousStock + quantityNum;

    // Negative quantity means stock out
    if (quantityNum < 0) {
      movementType = "out";
      newStock = previousStock + quantityNum; // Adding negative number

      if (newStock < 0) {
        logger.error({
          ...context,
          event: "INSUFFICIENT_STOCK",
          previousStock,
          requestedChange: quantityNum,
        });
        return res.status(400).json({
          success: false,
          message: "Insufficient stock",
        });
      }
    }

    // Update product stock
    product.currentStock = newStock;
    await product.save();

    logger.info({
      ...context,
      event: "STOCK_UPDATED",
      previousStock,
      newStock,
      quantity: quantityNum,
    });

    // Record stock movement
    try {
      await StockMovement.recordMovement({
        shop: shop._id,
        product: productId,
        type: movementType,
        quantity: Math.abs(quantityNum),
        reason,
        previousStock,
        newStock,
        notes: notes || `Manual ${reason}`,
        performedBy: req.user.id,
      });

      logger.info({
        ...context,
        event: "STOCK_MOVEMENT_RECORDED",
        type: movementType,
        quantity: Math.abs(quantityNum),
      });
    } catch (movementErr) {
      logger.error({
        ...context,
        event: "STOCK_MOVEMENT_RECORD_FAILED",
        error: movementErr.message,
      });
      // Don't fail the stock update if movement recording fails
    }

    res.json({
      success: true,
      message: "Stock updated successfully",
      product: {
        _id: product._id,
        productName: product.productName,
        previousStock,
        currentStock: newStock,
        change: quantityNum,
      },
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "STOCK_UPDATE_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
