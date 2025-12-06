const sitemapService = require("../services/sitemapService");
const logger = require("../config/logger");
const redisClient = require("../config/redis");


const CACHE_TTL = 3600;


class SitemapController {
  
  async getSitemap(req, res) {
    try {
      const cacheKey = "sitemap:main";
      let sitemapXml = await redisClient.get(cacheKey);

      if (!sitemapXml) {
        logger.info({ event: "SITEMAP_CACHE_MISS", cacheKey });
        sitemapXml = await sitemapService.generateSitemapXml();
        await redisClient.setex(cacheKey, CACHE_TTL, sitemapXml);
        logger.info({ event: "SITEMAP_CACHED", cacheKey });
      } else {
        logger.debug({ event: "SITEMAP_CACHE_HIT", cacheKey });
      }

      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(sitemapXml);
    } catch (error) {
      logger.error({
        event: "SITEMAP_GENERATION_ERROR",
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate sitemap",
      });
    }
  }

  
  async getPaginatedSitemap(req, res) {
    try {
      const { index } = req.params;
      const pageIndex = parseInt(index, 10);

      if (isNaN(pageIndex) || pageIndex < 1) {
        return res.status(400).json({
          success: false,
          message: "Invalid sitemap index",
        });
      }

      const cacheKey = `sitemap:page:${pageIndex}`;
      let sitemapXml = await redisClient.get(cacheKey);

      if (!sitemapXml) {
        logger.info({ event: "SITEMAP_PAGINATED_CACHE_MISS", pageIndex });
        const sitemaps = await sitemapService.generatePaginatedSitemaps();

        if (pageIndex > sitemaps.length) {
          return res.status(404).json({
            success: false,
            message: "Sitemap page not found",
          });
        }

        sitemapXml = sitemaps[pageIndex - 1].xml;
        await redisClient.setex(cacheKey, CACHE_TTL, sitemapXml);
        logger.info({ event: "SITEMAP_PAGINATED_CACHED", pageIndex });
      } else {
        logger.debug({ event: "SITEMAP_PAGINATED_CACHE_HIT", pageIndex });
      }

      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(sitemapXml);
    } catch (error) {
      logger.error({
        event: "SITEMAP_PAGINATED_ERROR",
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate paginated sitemap",
      });
    }
  }

  
  async getSitemapIndex(req, res) {
    try {
      const cacheKey = "sitemap:index";
      let indexXml = await redisClient.get(cacheKey);

      if (!indexXml) {
        logger.info({ event: "SITEMAP_INDEX_CACHE_MISS" });
        const sitemaps = await sitemapService.generatePaginatedSitemaps();
        const sitemapFiles = sitemaps.map((_, i) => i + 1);
        indexXml = await sitemapService.generateSitemapIndex(sitemapFiles);
        await redisClient.setex(cacheKey, CACHE_TTL, indexXml);
        logger.info({ event: "SITEMAP_INDEX_CACHED" });
      } else {
        logger.debug({ event: "SITEMAP_INDEX_CACHE_HIT" });
      }

      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(indexXml);
    } catch (error) {
      logger.error({
        event: "SITEMAP_INDEX_ERROR",
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to generate sitemap index",
      });
    }
  }

  
  async invalidateCache() {
    try {
      const keys = await redisClient.keys("sitemap:*");
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      logger.info({ event: "SITEMAP_CACHE_INVALIDATED", keysDeleted: keys.length });
    } catch (error) {
      logger.error({
        event: "SITEMAP_CACHE_INVALIDATION_ERROR",
        error: error.message,
      });
    }
  }

  
  async getSitemapStats(req, res) {
    try {
      const urls = await sitemapService.generateSitemap();
      const stats = {
        totalUrls: urls.length,
        byType: {
          products: urls.filter((u) => u.loc.includes("/product/")).length,
          categories: urls.filter((u) => u.loc.includes("/category/")).length,
          blogs: urls.filter((u) => u.loc.includes("/blog/")).length,
          static: urls.filter(
            (u) =>
              !u.loc.includes("/product/") &&
              !u.loc.includes("/category/") &&
              !u.loc.includes("/blog/")
          ).length,
        },
        cacheStatus: {
          main: !!(await redisClient.exists("sitemap:main")),
          index: !!(await redisClient.exists("sitemap:index")),
          totalKeys: (await redisClient.keys("sitemap:*")).length,
        },
      };

      return res.json({
        success: true,
        stats,
      });
    } catch (error) {
      logger.error({
        event: "SITEMAP_STATS_ERROR",
        error: error.message,
      });

      return res.status(500).json({
        success: false,
        message: "Failed to get sitemap statistics",
      });
    }
  }
}

module.exports = new SitemapController();

