const express = require("express");
const router = express.Router();
const { addShopReview, getShopReviews } = require("../controllers/shopReviewController");


router.post("/add", addShopReview);
router.get("/shop/:shopId", getShopReviews);

module.exports = router;