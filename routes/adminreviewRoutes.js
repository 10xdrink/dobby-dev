const express = require("express")
const { getAllReviews, updateReviewStatus, deleteReview } = require("../controllers/adminreviewController")
const router = express.Router()

router.get("/admin", getAllReviews )
router.put("/admin/:reviewId", updateReviewStatus);
router.delete("/admin/:reviewId", deleteReview);


module.exports = router