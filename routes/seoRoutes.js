// routes/seoRoutes.js
const express = require("express");
const router = express.Router();
const seoController = require("../controllers/seoController");

router.get("/:slug", seoController.getSeoData);
router.post("/:slug", seoController.saveSeoData);

module.exports = router;
