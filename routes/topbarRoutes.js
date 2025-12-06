const express = require("express");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");
const { getTopbar, createTopbar } = require("../controllers/topbarController");

const router = express.Router();

router.get(
  "/",
  cacheGlobal(cacheService.TTL.VERY_LONG),
  getTopbar
);

router.post(
  "/",
  createTopbar,
  invalidateCache(() => "topbar:*")
);

module.exports = router;
