const express = require("express");
const {
  createFlashSale,
  getFlashSales,
  updateFlashSale,
  deleteFlashSale,
  duplicateFlashSale,
  deactivateFlashSale,
  getActiveFlashSalesPublic,
  getFlashSaleDetailsPublic,
  getFlashSaleStats,
} = require("../controllers/flashsaleController");
const upload = require("../middleware/upload");
const checkActiveShop = require("../middleware/checkActiveShop");
const { protect } = require("../middleware/authMiddleware");
const router = express.Router();

router.post(
  "/",
  protect(["shopkeeper"]),
  checkActiveShop,
  upload.single("banner"),
  createFlashSale
);

router.get("/", protect(["shopkeeper"]), checkActiveShop, getFlashSales);

router.put(
  "/:id",
  protect(["shopkeeper"]),
  checkActiveShop,
  upload.single("banner"),
  updateFlashSale
);

router.delete(
  "/:id",
  protect(["shopkeeper"]),
  checkActiveShop,
  deleteFlashSale
);

router.post(
  "/:id/duplicate",
  protect(["shopkeeper"]),
  checkActiveShop,
  duplicateFlashSale
);

router.post(
  "/:id/deactivate",
  protect(["shopkeeper"]),
  checkActiveShop,
  deactivateFlashSale
);

// public customer
router.get("/public/active", getActiveFlashSalesPublic);
router.get("/public/:id", getFlashSaleDetailsPublic);

router.get(
  "/stats",
  protect(["shopkeeper"]),
  checkActiveShop,
  getFlashSaleStats
);

module.exports = router;
