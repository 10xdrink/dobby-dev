const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { updateLogo, getLogo } = require("../controllers/logoController");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

router.put(
  "/update",
  upload.fields([
    { name: "headerLogo", maxCount: 1 },
    { name: "footerLogo", maxCount: 1 },
    { name: "favicon", maxCount: 1 },
    { name: "loadingGif", maxCount: 1 },
  ]),
  updateLogo,
  invalidateCache("logo:global")
);

router.get("/", cacheGlobal(cacheService.TTL.VERY_LONG), getLogo);

module.exports = router;
