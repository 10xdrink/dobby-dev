const express = require("express");
const { protect } = require("../middleware/authMiddleware");
const { getOrders, getOrderById, createOrder, updateOrderStatus } = require("../controllers/orderController");
const { cacheByUser, invalidateCache } = require("../middleware/cacheMiddleware");

const router = express.Router();

const invalidateUserCache = (req) => `user:${req.user._id}:*`;

router.post("/", protect(["customer", "student"]), invalidateCache(invalidateUserCache), createOrder);

router.get("/", protect(["customer", "student"]), cacheByUser(), getOrders);
router.get("/:orderId", protect(["customer", "student"]), cacheByUser(), getOrderById);
router.patch("/:orderId/status", protect(["customer", "student"]), invalidateCache(invalidateUserCache), updateOrderStatus);

module.exports = router;
