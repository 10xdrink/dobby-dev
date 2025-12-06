const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const {
  getMyShopAnalytics,
  getMyShopAnalyticsByDateRange,
  getMyTopSellingProducts,
} = require("../controllers/shopkeeperanalyticsController");

router.get("/", protect(["shopkeeper"]), checkActiveShop, getMyShopAnalytics);

router.get(
  "/range",
  protect(["shopkeeper"]),
  checkActiveShop,
  getMyShopAnalyticsByDateRange
);

router.get(
  "/top-products",
  protect(["shopkeeper"]),
  checkActiveShop,
  getMyTopSellingProducts
);

module.exports = router;
