const express = require("express");
const router = express.Router();


const { getCookieBanner, getCookieSettings, updateCookieSettings } = require("../controllers/cookieSettingsController");
const { protect } = require("../middleware/adminMiddleware");

// Public route - for frontend cookie banner
router.get("/cookie", getCookieBanner);

// Admin routes - protected
router.get("/", protect(), getCookieSettings);
router.put("/", protect(), updateCookieSettings);

module.exports = router;