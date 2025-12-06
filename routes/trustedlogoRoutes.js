const express = require("express");
const upload = require("../middleware/upload");
const { createLogo, getAllLogos, updateLogo, togglePublish, deleteLogo, getPublishedLogos } = require("../controllers/trustedLogoController");
const router = express.Router();



// Create
router.post("/",  upload.single("image"), createLogo);

// Get all
router.get("/", getAllLogos);

// Update logo (replace image)
router.put("/:id",  upload.single("image"), updateLogo);

// Toggle publish/unpublish
router.patch("/:id/toggle", togglePublish);

// Delete
router.delete("/:id", deleteLogo);

// Public endpoint for homepage
router.get("/published", getPublishedLogos);

module.exports = router;
