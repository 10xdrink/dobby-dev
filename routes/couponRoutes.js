const express = require("express");
const {
  createCoupon,
  getCoupons,
  updateCoupon,
  deleteCoupon,
  deactivateCoupon,
  duplicateCoupon,
  getCouponStats,
  getAvailableCoupons,
} = require("../controllers/couponController");
const { protect } = require("../middleware/authMiddleware");
const checkActiveShop = require("../middleware/checkActiveShop");

const router = express.Router();

// Public route - Get available coupons for customers
router.get("/available", getAvailableCoupons);

// All routes below require shopkeeper auth and active shop
router.use(protect(["shopkeeper"]));
router.use(checkActiveShop);

router.post("/create", createCoupon);
router.get("/", getCoupons);
router.put("/update/:id", updateCoupon);
router.delete("/delete/:id", deleteCoupon);
router.put("/deactivate/:id", deactivateCoupon);
router.post("/duplicate/:id", duplicateCoupon);
router.get("/stats", getCouponStats);

module.exports = router;
