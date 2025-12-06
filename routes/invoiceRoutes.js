const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoiceController");
const { protect } = require("../middleware/authMiddleware");

// Get invoice data for an order
router.get("/:orderId", protect(["customer"]), invoiceController.getInvoice);

// Download invoice as PDF
router.get(
  "/:orderId/download",
  protect(["customer"]),
  invoiceController.downloadInvoicePDF
);

module.exports = router;