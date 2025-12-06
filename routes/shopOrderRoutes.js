const express = require("express");
const router = express.Router();


const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getShopOrders, getOrderStats, getOrderById, printInvoice } = require("../controllers/shoporderController");

// Apply protection to all routes
router.use(protect(["shopkeeper"]));
router.use(checkActiveShop);

// GET /api/shop/orders - Get all orders with filters and stats
router.get("/orders", getShopOrders);

// GET /api/shop/orders/stats - Get order statistics for dashboard
router.get("/orders/stats", getOrderStats);

// GET /api/shop/orders/:orderId - Get single order details
router.get("/orders/:orderId", getOrderById);

// PATCH /api/shop/orders/:orderId/status - Update order shipment status

// router.patch("/orders/:orderId/status", updateOrderStatus);

// GET /api/shop/orders/:orderId/invoice - Get invoice data for printing
router.get("/orders/:orderId/invoice", printInvoice);

module.exports = router;