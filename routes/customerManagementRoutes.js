const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerManagementController");
const { protect } = require("../middleware/adminMiddleware");
const { employeeMiddleware } = require("../middleware/employeeMiddleware");
const { cacheByRole } = require("../middleware/cacheMiddleware");
const {
  getCustomerGrowth,
  getGroupDistribution,
  getGroupDetails,
  getDashboardAnalytics,
} = require("../controllers/customergrowthController");
const {
  getAllCustomerOrders,
  getCustomerOrders,
  getOrderDetails,
  getOrderStats,
  getMonthlyOrderTrends,
  getOrderStatusDistribution,
} = require("../controllers/customerorderController");


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

// get all customers


router.get("/", allowAdminOrEmployee, customerController.getAllCustomers);

// get vip customers 


router.get("/vip", allowAdminOrEmployee, customerController.getVIPCustomers);

// get blocked customers


router.get(
  "/blocked",
  allowAdminOrEmployee,
  customerController.getBlockedCustomers
);

// export customers to csv


router.get("/export", allowAdminOrEmployee, customerController.exportCustomers);

router.get("/stats", allowAdminOrEmployee, cacheByRole(), customerController.getCustomerStats);

router.get(
  "/stats/detailed",
  allowAdminOrEmployee,
  cacheByRole(),
  customerController.getDetailedStats
);

router.get(
  "/stats/growth",
  allowAdminOrEmployee,
  cacheByRole(),
  customerController.getGrowthAnalytics
);

router.get("/analytics/growth", allowAdminOrEmployee, cacheByRole(), getCustomerGrowth);

router.get(
  "/analytics/distribution",
  allowAdminOrEmployee,
  cacheByRole(),
  getGroupDistribution
);

router.get("/analytics/groups", allowAdminOrEmployee, cacheByRole(), getGroupDetails);

router.get("/analytics/dashboard", allowAdminOrEmployee, cacheByRole(), getDashboardAnalytics);

router.get("/orders/stats", allowAdminOrEmployee, cacheByRole(), getOrderStats);

router.get("/orders/all", allowAdminOrEmployee, cacheByRole(), getAllCustomerOrders);

router.get("/monthly-trends", allowAdminOrEmployee, cacheByRole(), getMonthlyOrderTrends);

router.get(
  "/status-distribution",
  allowAdminOrEmployee,
  cacheByRole(),
  getOrderStatusDistribution
);

// get customer details by id


router.get(
  "/:customerId",
  allowAdminOrEmployee,
  cacheByRole(),
  customerController.getCustomerById
);

// block customer


router.post(
  "/:customerId/block",
  allowAdminOrEmployee,
  customerController.blockCustomer
);

// unblock customer


router.post(
  "/:customerId/unblock",
  allowAdminOrEmployee,
  customerController.unblockCustomer
);

router.get("/:customerId/orders", allowAdminOrEmployee, cacheByRole(), getCustomerOrders);

router.get(
  "/:customerId/orders/:orderId",
  allowAdminOrEmployee,
  cacheByRole(),
  getOrderDetails
);

module.exports = router;
