const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { 
  createBlog, 
  getBlogs, 
  getBlogBySlug, 
  updateBlog, 
  deleteBlog, 
  getBlogsByCategory 
} = require("../controllers/blogController");
// const { cacheGlobal, invalidateCache, cacheMiddleware } = require("../middleware/cacheMiddleware");
// const cacheService = require("../services/cacheService");

// router.post("/", upload.single("featuredImage"), createBlog, invalidateCache("blogs:*"));

// router.get(
//   "/", 
//   cacheMiddleware({
//     ttl: cacheService.TTL.LONG,
//     keyGenerator: (req) => {
//       const page = req.query.page || 1;
//       const category = req.query.category || "all";
//       return `blogs:list:${category}:${page}`;
//     },
//   }), 
//   getBlogs
// );

// router.get(
//   "/:slug", 
//   cacheMiddleware({
//     ttl: cacheService.TTL.LONG,
//     keyGenerator: (req) => `blogs:detail:${req.params.slug}`,
//   }), 
//   getBlogBySlug
// );

// router.put("/:id", upload.single("featuredImage"), updateBlog, invalidateCache("blogs:*"));

// router.delete("/:id", deleteBlog, invalidateCache("blogs:*"));

// router.get(
//   "/category/:categoryId", 
//   cacheMiddleware({
//     ttl: cacheService.TTL.LONG,
//     keyGenerator: (req) => `blogs:category:${req.params.categoryId}:${req.query.page || 1}`,
//   }), 
//   getBlogsByCategory
// );

router.post("/", upload.single("featuredImage"), createBlog);

router.get(
  "/", 
  getBlogs
);

router.get(
  "/:slug", 
  getBlogBySlug
);

router.put("/:id", upload.single("featuredImage"), updateBlog);

router.delete("/:id", deleteBlog);

router.get(
  "/category/:categoryId", 
  
  getBlogsByCategory
);

module.exports = router;
