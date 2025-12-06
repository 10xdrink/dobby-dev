const express = require("express");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");
const { getSecondTopbar, createSecondTopbar } = require("../controllers/topbarController");

const router = express.Router();

router.get(
  "/",
  cacheGlobal(cacheService.TTL.VERY_LONG),
  getSecondTopbar
);

router.post(
  "/",
  createSecondTopbar,
  invalidateCache(() => "topbar:*")
);

module.exports = router;
