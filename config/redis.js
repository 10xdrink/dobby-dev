require("dotenv").config();
const Redis = require("ioredis");
const logger = require("./logger");

let redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

if (redisUrl.includes("red-") && process.env.NODE_ENV !== "production") {
  logger.warn("Render Redis not accessible locally, switching to localhost Redis");
  redisUrl = "redis://127.0.0.1:6379";
}

// Base config for Redis operations
const redisConfig = {
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.debug(`Redis retry attempt ${times}, waiting ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
  enableOfflineQueue: true,
  lazyConnect: false,
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      logger.warn("Redis READONLY error, reconnecting...");
      return true;
    }
    return false;
  },
};

// Add TLS configuration for Redis Cloud (rediss:// protocol)
if (redisUrl.startsWith("rediss://")) {
  redisConfig.tls = {
    rejectUnauthorized: true, // Set to false if using self-signed certificates
  };
  logger.info("Redis Cloud TLS connection enabled");
}



const redisClient = new Redis(redisUrl, redisConfig);

redisClient.on("error", (err) => {
  logger.error({
    event: "REDIS_ERROR",
    error: err.message,
    stack: err.stack,
  });
});

redisClient.on("connect", () => {
  logger.info({
    event: "REDIS_CONNECTED",
    url: redisUrl.replace(/:[^:]*@/, ":***@"), // Hide password in logs
  });
});

redisClient.on("ready", () => {
  logger.info({ event: "REDIS_READY" });
});

redisClient.on("reconnecting", (delay) => {
  logger.warn({
    event: "REDIS_RECONNECTING",
    delay,
  });
});

redisClient.on("close", () => {
  logger.warn({ event: "REDIS_CONNECTION_CLOSED" });
});

process.on("SIGINT", async () => {
  logger.info("Closing Redis connection...");
  await redisClient.quit();
  process.exit(0);
});

module.exports = redisClient;
