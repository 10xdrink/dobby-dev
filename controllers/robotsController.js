const redisClient = require("../config/redis");
const logger = require("../config/logger");

const CACHE_KEY = "robots:txt";
const CACHE_TTL = 3600; // 1 hour

class RobotsController {
  constructor() {
    this.baseUrl =
      process.env.FRONTEND_PROD ||
      process.env.FRONTEND_LOCAL ||
      "https://test-dobby.vercel.app";

    this.defaultDisallow = [
      "/api/",
      "/admin",
      "/admin/",
      "/auth",
      "/cart",
      "/checkout",
      "/customer",
      "/dashboard",
      "/orders",
      "/profile",
      "/shopkeeper",
    ];

    this.searchEngineBots = [
      "Googlebot",
      "Googlebot-Image",
      "Googlebot-News",
      "AdsBot-Google",
      "Bingbot",
      "Slurp",
      "DuckDuckBot",
      "Baiduspider",
    ];
  }

  buildRobotsContent() {
    const timestamp = new Date().toISOString();
    const lines = [
      `# Enterprise robots.txt`,
      `# Generated: ${timestamp}`,
      `# Environment: ${process.env.NODE_ENV || "development"}`,
      "",
    ];

    // Primary section for all bots
    lines.push("User-agent: *");
    lines.push("Allow: /$");
    lines.push("Allow: /blog/");
    lines.push("Allow: /category/");
    lines.push("Allow: /product/");
    this.defaultDisallow.forEach((path) => lines.push(`Disallow: ${path}`));
    lines.push("");

    // Specific guidance for major crawlers
    this.searchEngineBots.forEach((bot) => {
      lines.push(`User-agent: ${bot}`);
      lines.push("Crawl-delay: 5");
      lines.push("Allow: /");
      this.defaultDisallow.forEach((path) => lines.push(`Disallow: ${path}`));
      lines.push("");
    });

    // Site-specific directives
    lines.push(`Sitemap: ${this.baseUrl}/sitemap.xml`);
    lines.push(`Sitemap: ${this.baseUrl}/sitemap-index.xml`);
    lines.push(`Host: ${this.baseUrl.replace(/https?:\/\//, "")}`);

    return lines.join("\n");
  }

  async getRobotsTxt(req, res) {
    try {
      let content = await redisClient.get(CACHE_KEY);

      if (!content) {
        logger.info({ event: "ROBOTS_CACHE_MISS" });
        content = this.buildRobotsContent();
        await redisClient.setex(CACHE_KEY, CACHE_TTL, content);
        logger.info({ event: "ROBOTS_CACHE_SET", ttl: CACHE_TTL });
      } else {
        logger.debug({ event: "ROBOTS_CACHE_HIT" });
      }

      res.set("Content-Type", "text/plain; charset=utf-8");
      res.set("Cache-Control", "public, max-age=3600");
      return res.send(content);
    } catch (error) {
      logger.error({
        event: "ROBOTS_GENERATION_ERROR",
        error: error.message,
        stack: error.stack,
      });

      return res.status(500).send("User-agent: *\nDisallow:");
    }
  }

  async invalidateCache() {
    try {
      await redisClient.del(CACHE_KEY);
      logger.info({ event: "ROBOTS_CACHE_INVALIDATED" });
    } catch (error) {
      logger.error({
        event: "ROBOTS_CACHE_INVALIDATION_ERROR",
        error: error.message,
      });
    }
  }
}

module.exports = new RobotsController();

