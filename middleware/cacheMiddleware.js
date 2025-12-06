const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

function generateCacheKey(req) {
  const userId = req.user?._id || req.employee?._id || "guest";
  const role = req.user?.role || req.employee?.role || "guest";
  const path = req.baseUrl + req.path;
  const query = JSON.stringify(req.query);

  return `api:${role}:${userId}:${path}:${query}`;
}

const cacheMiddleware = (options = {}) => {
  const {
    ttl = cacheService.TTL.DEFAULT,
    keyGenerator = generateCacheKey,
    condition = () => true,
    skipCache = false,
  } = options;

  return async (req, res, next) => {
    if (skipCache || req.method !== "GET") {
      return next();
    }

    if (!condition(req)) {
      return next();
    }

    const cacheKey = keyGenerator(req);

    try {
      const cached = await cacheService.get(cacheKey);

      if (cached) {
        logger.debug({
          event: "CACHE_MIDDLEWARE_HIT",
          key: cacheKey,
          path: req.path,
        });

        return res.json({
          ...cached,
          _cached: true,
          _cachedAt: new Date().toISOString(),
        });
      }

      logger.debug({
        event: "CACHE_MIDDLEWARE_MISS",
        key: cacheKey,
        path: req.path,
      });

      const originalJson = res.json.bind(res);
      res.json = function (data) {
        if (res.statusCode === 200 && data.success !== false) {
          cacheService.set(cacheKey, data, ttl).catch((err) => {
            logger.error({
              event: "CACHE_MIDDLEWARE_SET_ERROR",
              key: cacheKey,
              error: err.message,
            });
          });
        }

        return originalJson(data);
      };

      next();
    } catch (err) {
      logger.error({
        event: "CACHE_MIDDLEWARE_ERROR",
        key: cacheKey,
        error: err.message,
      });
      next();
    }
  };
};

const invalidateCache = (pattern) => {
  return async (req, res, next) => {
    res.on("finish", async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          let cachePattern;

          if (typeof pattern === "function") {
            cachePattern = pattern(req);
          } else {
            cachePattern = pattern;
          }

          if (cachePattern) {
            const deleted = await cacheService.deletePattern(cachePattern);
            logger.info({
              event: "CACHE_INVALIDATED",
              pattern: cachePattern,
              deletedCount: deleted,
              method: req.method,
              path: req.path,
            });
          }
        } catch (err) {
          logger.error({
            event: "CACHE_INVALIDATION_ERROR",
            error: err.message,
          });
        }
      }
    });

    next();
  };
};

const cacheByUser = (ttl = cacheService.TTL.MEDIUM) => {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req) => {
      const userId = req.user?._id || req.employee?._id || "guest";
      const path = req.baseUrl + req.path;
      const query = JSON.stringify(req.query);
      return `user:${userId}:${path}:${query}`;
    },
  });
};

const cacheByRole = (ttl = cacheService.TTL.LONG) => {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req) => {
      const role = req.user?.role || req.employee?.role || "guest";
      const path = req.baseUrl + req.path;
      const query = JSON.stringify(req.query);
      return `role:${role}:${path}:${query}`;
    },
  });
};

const cacheGlobal = (ttl = cacheService.TTL.VERY_LONG) => {
  return cacheMiddleware({
    ttl,
    keyGenerator: (req) => {
      const path = req.baseUrl + req.path;
      const query = JSON.stringify(req.query);
      return `global:${path}:${query}`;
    },
  });
};

const noCache = (req, res, next) => {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, private",
    Pragma: "no-cache",
    Expires: "0",
  });
  next();
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  cacheByUser,
  cacheByRole,
  cacheGlobal,
  noCache,
  generateCacheKey,
};