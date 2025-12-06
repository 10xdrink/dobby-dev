const express = require("express");
const router = express.Router();

const upload = require("../middleware/upload");
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const {
  cacheMiddleware,
  cacheGlobal,
  invalidateCache,
} = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");
const CacheInvalidation = require("../utils/cacheInvalidation");
const {
  createProduct,
  updateProduct,
  deleteProduct,
  getProducts,
  getInventoryData,
  getPublicProducts,
  getSinglePublicProduct,
  getSearchSuggestions,
  getSimilarProducts,
} = require("../controllers/productController");

//  Create Product
router.post(
  "/create",
  protect(["shopkeeper"]),
  checkActiveShop,
  upload.fields([
    { name: "icon1", maxCount: 1 },
    { name: "icon2", maxCount: 20 },
    { name: "metaImage", maxCount: 1 },
  ]),
  createProduct,
  invalidateCache((req) => "product:*")
);

//  Update Product
router.put(
  "/update/:id",
  protect(["shopkeeper"]),
  checkActiveShop,
  upload.fields([
    { name: "icon1", maxCount: 1 },
    { name: "icon2", maxCount: 20 },
    { name: "metaImage", maxCount: 1 },
  ]),
  updateProduct,
  invalidateCache((req) => `product:${req.params.id}:*`)
);

router.delete(
  "/delete/:id",
  protect(["shopkeeper"]),
  checkActiveShop,
  deleteProduct,
  invalidateCache((req) => `product:${req.params.id}:*`)
);

router.get(
  "/",
  protect(["shopkeeper"]),
  checkActiveShop,
  cacheMiddleware({
    ttl: cacheService.TTL.SHORT,
    keyGenerator: (req) => {
      const shopId = req.shop?._id || "unknown";
      const filter = req.query.filter || "all";
      const search = req.query.search || "";
      return `products:shop:${shopId}:${filter}:${search}`;
    },
  }),
  getProducts
);

router.get(
  "/inventory-data",
  protect(["shopkeeper"]),
  checkActiveShop,
  cacheMiddleware({
    ttl: cacheService.TTL.SHORT,
    keyGenerator: (req) => {
      const shopId = req.shop?._id || "unknown";
      return `inventory:${shopId}`;
    },
  }),
  getInventoryData
);

router.get(
  "/public",
  cacheGlobal(cacheService.TTL.MEDIUM),
  getPublicProducts
);

router.get(
  "/public/:id",
  cacheMiddleware({
    ttl: cacheService.TTL.LONG,
    keyGenerator: (req) => `product:${req.params.id}:public`,
  }),
  getSinglePublicProduct
);

router.get(
  "/search-suggestions",
  cacheMiddleware({
    ttl: cacheService.TTL.SHORT,
    keyGenerator: (req) => `search:suggestions:${req.query.query || ""}`,
  }),
  getSearchSuggestions
);

router.get(
  "/similar-product/:id",
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: (req) => `product:similar:${req.params.id || ""}`,
  }),
  getSimilarProducts
);

module.exports = router;
