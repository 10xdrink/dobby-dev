const express = require("express")
const { updateWhatsAppNumber, getWhatsAppNumber } = require("../controllers/socialmediachatController")
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

const router = express.Router()

router.put("/", updateWhatsAppNumber, invalidateCache("whatsapp:*"))
router.get("/", cacheGlobal(cacheService.TTL.VERY_LONG), getWhatsAppNumber)

module.exports = router