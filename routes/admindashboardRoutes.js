const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/adminMiddleware");
const { employeeMiddleware } = require("../middleware/employeeMiddleware");
const { cacheByRole } = require("../middleware/cacheMiddleware");

const {
  getAdminDashboardStats,
  getSalesAnalyticsByCategory,
  getRevenueByCustomerGroup,
  getCompletedOrders,
  getReturnRequests,
  getNewReviews,
} = require("../controllers/admindashboardController");

// Middleware to allow both admin and employee access
const allowAdminOrEmployee = (req, res, next) => {
  const adminToken =
    req.cookies?.adminToken ||
    (req.headers.authorization?.startsWith("Bearer ") &&
      req.headers.authorization.split(" ")[1]);

  if (adminToken) {
    return protect()(req, res, next);
  }

  return employeeMiddleware(req, res, next);
};

// Existing routes
router.get("/stats", allowAdminOrEmployee, cacheByRole(), getAdminDashboardStats);

router.get(
  "/sales-analytics",
  allowAdminOrEmployee,
  cacheByRole(),
  getSalesAnalyticsByCategory
);

router.get(
  "/revenue-distribution",
  allowAdminOrEmployee,
  cacheByRole(),
  getRevenueByCustomerGroup
);

// NEW: Detailed data routes
router.get(
  "/completed-orders",
  allowAdminOrEmployee,
  cacheByRole(),
  getCompletedOrders
);

router.get(
  "/return-requests",
  allowAdminOrEmployee,
  cacheByRole(),
  getReturnRequests
);

router.get(
  "/new-reviews",
  allowAdminOrEmployee,
  cacheByRole(),
  getNewReviews
);

module.exports = router;