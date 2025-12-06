const express = require("express");
const router = express.Router();
const {
  createSocialMedia,
  getAllSocialMedia,
  getActiveSocialMedia,
  updateSocialMedia,
  deleteSocialMedia,
} = require("../controllers/socialMediaController");

// Active socials - cached
router.get("/active", getActiveSocialMedia);

// All socials - cached
router.get("/", getAllSocialMedia);

// CRUD with cache invalidation - FIXED
router.post("/", 
  createSocialMedia
);

router.put("/:id", 
  updateSocialMedia
);

router.delete("/:id",
  deleteSocialMedia
);

module.exports = router;