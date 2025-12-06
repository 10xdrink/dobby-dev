const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getDashboardStats, getAnalyticsRange, getTopProducts, getProductAnalytics } = require("../controllers/shopkeeperDashboardController");

// All routes require shopkeeper auth + active shop
// This ensures shopkeepers can only see their own shop's data

/**
 * @route   GET /api/shop-analytics/dashboard
 * @desc    Get real-time dashboard stats for shopkeeper's shop
 * @access  Private (Shopkeeper with active shop)
 */
router.get(
  "/dashboard",
  protect(["shopkeeper"]),
  checkActiveShop,
  getDashboardStats
);

/**
 * @route   GET /api/shop-analytics/range
 * @desc    Get analytics for a date range
 * @query   startDate, endDate (required)
 * @access  Private (Shopkeeper with active shop)
 */
router.get(
  "/range",
  protect(["shopkeeper"]),
  checkActiveShop,
  getAnalyticsRange
);

/**
 * @route   GET /api/shop-analytics/products/top
 * @desc    Get top performing products
 * @query   period (week/month/year), limit (default: 10)
 * @access  Private (Shopkeeper with active shop)
 */
router.get(
  "/products/top",
  protect(["shopkeeper"]),
  checkActiveShop,
  getTopProducts
);

/**
 * @route   GET /api/shop-analytics/products/:productId
 * @desc    Get analytics for specific product
 * @param   productId
 * @query   startDate, endDate (required)
 * @access  Private (Shopkeeper with active shop)
 */
router.get(
  "/products/:productId",
  protect(["shopkeeper"]),
  checkActiveShop,
  getProductAnalytics
);

module.exports = router;