const express = require("express");
const router = express.Router();
const customerAnalyticsController = require("../controllers/customeranalyticsController");
const { protect } = require("../middleware/adminMiddleware");
const { employeeMiddleware } = require("../middleware/employeeMiddleware");
const { cacheByRole } = require("../middleware/cacheMiddleware");


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

// Customer retention rate by group
router.get(
  "/retention",
  allowAdminOrEmployee,
  cacheByRole(),
  customerAnalyticsController.getCustomerRetentionByGroup
);

// Purchase frequency by group
router.get(
  "/purchase-frequency",
  allowAdminOrEmployee,
  cacheByRole(),
  customerAnalyticsController.getPurchaseFrequencyByGroup
);

// Customer activity status (list with pagination)
router.get(
  "/activity",
  allowAdminOrEmployee,
  cacheByRole(),
  customerAnalyticsController.getCustomerActivityStatus
);

// Send email to customer
router.post(
  "/send-email",
  allowAdminOrEmployee,
  customerAnalyticsController.sendCustomerEmail
);

module.exports = router;