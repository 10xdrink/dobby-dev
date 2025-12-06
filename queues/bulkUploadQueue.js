require("dotenv").config();
const { Queue } = require("bullmq");
const redisClient = require("../config/redis");
const logger = require("../config/logger");

const bulkUploadQueue = new Queue("bulkUploadQueue", {
  connection: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep for 7 days
      count: 100,
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed for 30 days
    },
  },
});

bulkUploadQueue.on("error", (err) => {
  logger.error({
    event: "BULK_UPLOAD_QUEUE_ERROR",
    error: err.message,
    stack: err.stack,
  });
});

bulkUploadQueue.on("waiting", (jobId) => {
  logger.debug({
    event: "BULK_UPLOAD_QUEUE_WAITING",
    jobId,
  });
});

bulkUploadQueue.on("active", (job) => {
  logger.info({
    event: "BULK_UPLOAD_QUEUE_ACTIVE",
    jobId: job.id,
    shopId: job.data.shopId,
  });
});

bulkUploadQueue.on("completed", (job, result) => {
  logger.info({
    event: "BULK_UPLOAD_QUEUE_COMPLETED",
    jobId: job.id,
    shopId: job.data.shopId,
    result,
  });
});

bulkUploadQueue.on("failed", (job, err) => {
  logger.error({
    event: "BULK_UPLOAD_QUEUE_FAILED",
    jobId: job?.id,
    shopId: job?.data?.shopId,
    error: err.message,
    attemptsMade: job?.attemptsMade,
  });
});

module.exports = bulkUploadQueue;