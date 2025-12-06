require("dotenv").config();
const { Queue } = require("bullmq");
const redisClient = require("../config/redis");
const logger = require("../config/logger");

const shipmentQueue = new Queue("shipmentQueue", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 1000, // Keep max 1000 completed jobs
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

shipmentQueue.on("error", (err) => {
  logger.error({
    event: "SHIPMENT_QUEUE_ERROR",
    error: err.message,
    stack: err.stack,
  });
});

shipmentQueue.on("waiting", (jobId) => {
  logger.debug({
    event: "SHIPMENT_QUEUE_WAITING",
    jobId,
  });
});

shipmentQueue.on("active", (job) => {
  logger.info({
    event: "SHIPMENT_QUEUE_ACTIVE",
    jobId: job.id,
    name: job.name,
  });
});

shipmentQueue.on("completed", (job, result) => {
  logger.info({
    event: "SHIPMENT_QUEUE_COMPLETED",
    jobId: job.id,
    name: job.name,
    result,
  });
});

shipmentQueue.on("failed", (job, err) => {
  logger.error({
    event: "SHIPMENT_QUEUE_FAILED",
    jobId: job?.id,
    name: job?.name,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
});

module.exports = shipmentQueue;
