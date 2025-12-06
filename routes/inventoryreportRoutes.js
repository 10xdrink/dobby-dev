const express = require("express");
const router = express.Router();
const inventoryReportController = require("../controllers/inventoryreportController");
const { protect } = require("../middleware/adminMiddleware");
const { employeeMiddleware } = require("../middleware/employeeMiddleware");

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

router.get(
  "/stocklevels",
  allowAdminOrEmployee,
  inventoryReportController.getStockLevelsByCategory
);

router.get(
  "/turnover",
  allowAdminOrEmployee,
  inventoryReportController.getInventoryTurnover
);

module.exports = router;
