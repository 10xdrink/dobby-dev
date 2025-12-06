const express = require("express");
const {
  createCompanyInfo,
  getCompanyInfo,
  updateCompanyInfo,
  deleteCompanyInfo
} = require("../controllers/companyInfoController");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

const router = express.Router();

router.post("/", createCompanyInfo, invalidateCache("companyInfo:*"));
router.get("/", cacheGlobal(cacheService.TTL.LONG), getCompanyInfo);
router.put("/:id", updateCompanyInfo, invalidateCache("companyInfo:*"));
router.delete("/:id", deleteCompanyInfo, invalidateCache("companyInfo:*"));

module.exports = router;
