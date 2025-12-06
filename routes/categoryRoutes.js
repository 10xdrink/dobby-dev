const express = require("express");
const router = express.Router();
const { createCategory, getCategories, updateCategory, deleteCategory } = require("../controllers/categoryController");
const { cacheGlobal, invalidateCache } = require("../middleware/cacheMiddleware");
const cacheService = require("../services/cacheService");

router.post("/", createCategory, invalidateCache("categories:*"));

router.get("/", cacheGlobal(cacheService.TTL.LONG), getCategories);

router.put("/:id", updateCategory, invalidateCache("categories:*"));

router.delete("/:id", deleteCategory, invalidateCache("categories:*"));

module.exports = router;