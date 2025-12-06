const express = require("express");
const sitemapController = require("../controllers/sitemapController");

const router = express.Router();




router.get("/sitemap.xml", sitemapController.getSitemap.bind(sitemapController));


router.get(
  "/sitemap-index.xml",
  sitemapController.getSitemapIndex.bind(sitemapController)
);


router.get(
  "/sitemap-:index.xml",
  sitemapController.getPaginatedSitemap.bind(sitemapController)
);


router.get(
  "/sitemap/stats",
  sitemapController.getSitemapStats.bind(sitemapController)
);

module.exports = router;

