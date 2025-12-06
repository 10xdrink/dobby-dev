const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getSalesOverTimeGraph, getSalesByCategoryGraph } = require("../controllers/graphanalyticsController");


router.get(
  "/salesGraph",
  protect(["shopkeeper"]),
  checkActiveShop,
  getSalesOverTimeGraph
);
router.get(
  "/categoryGraph",
  protect(["shopkeeper"]),
  checkActiveShop,
  getSalesByCategoryGraph
);

module.exports = router;
