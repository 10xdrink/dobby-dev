const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");
const { getMyShopAbandonedStats, getShopAbandonedCarts } = require("../controllers/abandonedcartController");

router.get("/shop", protect(["shopkeeper"]), checkActiveShop, getShopAbandonedCarts );
router.get("/my-shop/stats", protect(["shopkeeper"]), checkActiveShop , getMyShopAbandonedStats );

module.exports = router;
