const redisClient = require("../config/redis");
const logger = require("../config/logger");

const DEFAULT_TTL = 300; // 5 minutes in seconds
const SHORT_TTL = 60; // 1 minute
const MEDIUM_TTL = 600; // 10 minutes
const LONG_TTL = 3600; // 1 hour
const VERY_LONG_TTL = 86400; // 24 hours

class CacheService {
  constructor() {
    this.client = redisClient;
    this.prefix = process.env.CACHE_PREFIX || "dobby:";
  }

  getKey(key) {
    return `${this.prefix}${key}`;
  }

  async get(key) {
    try {
      const fullKey = this.getKey(key);
      const data = await this.client.get(fullKey);

      if (data) {
        logger.debug({
          event: "CACHE_HIT",
          key: fullKey,
        });
        return JSON.parse(data);
      }

      logger.debug({
        event: "CACHE_MISS",
        key: fullKey,
      });
      return null;
    } catch (err) {
      logger.error({
        event: "CACHE_GET_ERROR",
        key,
        error: err.message,
      });
      return null;
    }
  }

  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);

      if (ttl > 0) {
        await this.client.setex(fullKey, ttl, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }

      logger.debug({
        event: "CACHE_SET",
        key: fullKey,
        ttl,
        size: serialized.length,
      });

      return true;
    } catch (err) {
      logger.error({
        event: "CACHE_SET_ERROR",
        key,
        error: err.message,
      });
      return false;
    }
  }

  async delete(key) {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.del(fullKey);

      logger.debug({
        event: "CACHE_DELETE",
        key: fullKey,
        deleted: result > 0,
      });

      return result > 0;
    } catch (err) {
      logger.error({
        event: "CACHE_DELETE_ERROR",
        key,
        error: err.message,
      });
      return false;
    }
  }

  async deletePattern(pattern) {
    try {
      const fullPattern = this.getKey(pattern);
      const keys = await this.client.keys(fullPattern);

      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        logger.info({
          event: "CACHE_DELETE_PATTERN",
          pattern: fullPattern,
          deletedCount: result,
        });
        return result;
      }

      return 0;
    } catch (err) {
      logger.error({
        event: "CACHE_DELETE_PATTERN_ERROR",
        pattern,
        error: err.message,
      });
      return 0;
    }
  }

  async exists(key) {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (err) {
      logger.error({
        event: "CACHE_EXISTS_ERROR",
        key,
        error: err.message,
      });
      return false;
    }
  }

  async getTTL(key) {
    try {
      const fullKey = this.getKey(key);
      return await this.client.ttl(fullKey);
    } catch (err) {
      logger.error({
        event: "CACHE_TTL_ERROR",
        key,
        error: err.message,
      });
      return -1;
    }
  }

  async setHash(key, field, value, ttl = DEFAULT_TTL) {
    try {
      const fullKey = this.getKey(key);
      const serialized = JSON.stringify(value);

      await this.client.hset(fullKey, field, serialized);

      if (ttl > 0) {
        await this.client.expire(fullKey, ttl);
      }

      logger.debug({
        event: "CACHE_HASH_SET",
        key: fullKey,
        field,
        ttl,
      });

      return true;
    } catch (err) {
      logger.error({
        event: "CACHE_HASH_SET_ERROR",
        key,
        field,
        error: err.message,
      });
      return false;
    }
  }

  async getHash(key, field) {
    try {
      const fullKey = this.getKey(key);
      const data = await this.client.hget(fullKey, field);

      if (data) {
        logger.debug({
          event: "CACHE_HASH_HIT",
          key: fullKey,
          field,
        });
        return JSON.parse(data);
      }

      logger.debug({
        event: "CACHE_HASH_MISS",
        key: fullKey,
        field,
      });
      return null;
    } catch (err) {
      logger.error({
        event: "CACHE_HASH_GET_ERROR",
        key,
        field,
        error: err.message,
      });
      return null;
    }
  }

  async getAllHash(key) {
    try {
      const fullKey = this.getKey(key);
      const data = await this.client.hgetall(fullKey);

      if (data && Object.keys(data).length > 0) {
        const parsed = {};
        for (const [field, value] of Object.entries(data)) {
          parsed[field] = JSON.parse(value);
        }
        return parsed;
      }

      return null;
    } catch (err) {
      logger.error({
        event: "CACHE_HASH_GETALL_ERROR",
        key,
        error: err.message,
      });
      return null;
    }
  }

  async increment(key, amount = 1, ttl = DEFAULT_TTL) {
    try {
      const fullKey = this.getKey(key);
      const result = await this.client.incrby(fullKey, amount);

      if (ttl > 0) {
        const currentTTL = await this.client.ttl(fullKey);
        if (currentTTL === -1) {
          await this.client.expire(fullKey, ttl);
        }
      }

      return result;
    } catch (err) {
      logger.error({
        event: "CACHE_INCREMENT_ERROR",
        key,
        error: err.message,
      });
      return null;
    }
  }

  async remember(key, ttl, callback) {
    try {
      const cached = await this.get(key);

      if (cached !== null) {
        logger.debug({
          event: "CACHE_REMEMBER_HIT",
          key,
        });
        return cached;
      }

      logger.debug({
        event: "CACHE_REMEMBER_MISS",
        key,
      });

      const fresh = await callback();

      if (fresh !== null && fresh !== undefined) {
        await this.set(key, fresh, ttl);
      }

      return fresh;
    } catch (err) {
      logger.error({
        event: "CACHE_REMEMBER_ERROR",
        key,
        error: err.message,
      });
      return await callback();
    }
  }

  async flush() {
    try {
      const pattern = this.getKey("*");
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        const result = await this.client.del(...keys);
        logger.info({
          event: "CACHE_FLUSH",
          deletedCount: result,
        });
        return result;
      }

      return 0;
    } catch (err) {
      logger.error({
        event: "CACHE_FLUSH_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  async getStats() {
    try {
      const info = await this.client.info("stats");
      const dbSize = await this.client.dbsize();

      return {
        dbSize,
        info: info.split("\r\n").reduce((acc, line) => {
          const [key, value] = line.split(":");
          if (key && value) {
            acc[key] = value;
          }
          return acc;
        }, {}),
      };
    } catch (err) {
      logger.error({
        event: "CACHE_STATS_ERROR",
        error: err.message,
      });
      return null;
    }
  }
}

module.exports = new CacheService();
module.exports.TTL = {
  SHORT: SHORT_TTL,
  MEDIUM: MEDIUM_TTL,
  DEFAULT: DEFAULT_TTL,
  LONG: LONG_TTL,
  VERY_LONG: VERY_LONG_TTL,
};
