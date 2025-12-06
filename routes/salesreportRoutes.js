const express = require("express");
const router = express.Router();
const salesReportController = require("../controllers/salesreportController");
const { protect } = require("../middleware/adminMiddleware");
const { employeeMiddleware } = require("../middleware/employeeMiddleware");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

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

const salesReportCacheKey = (req) => {
  const role = req.user?.role || req.employee?.role || "guest";
  const path = req.path;
  const query = JSON.stringify(req.query);
  return `salesreport:${role}:${path}:${query}`;
};

router.get(
  "/revenue-trend",
  allowAdminOrEmployee,
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: salesReportCacheKey,
  }),
  salesReportController.getRevenueTrend
);

router.get(
  "/by-category",
  allowAdminOrEmployee,
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: salesReportCacheKey,
  }),
  salesReportController.getSalesByCategory
);

router.get(
  "/products",
  allowAdminOrEmployee,
  cacheMiddleware({
    ttl: cacheService.TTL.MEDIUM,
    keyGenerator: salesReportCacheKey,
  }),
  salesReportController.getProductSalesReport
);

module.exports = router;