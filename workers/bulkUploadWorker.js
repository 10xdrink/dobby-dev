require("dotenv").config();
const { Worker } = require("bullmq");
const redisClient = require("../config/redis");
const logger = require("../config/logger");
const BulkUploadService = require("../services/bulkUploadService");
const mongoose = require("mongoose");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => logger.info("Worker: MongoDB connected"))
  .catch((err) =>
    logger.error("Worker: MongoDB connection error:", err.message)
  );

const bulkUploadWorker = new Worker(
  "bulkUploadQueue",
  async (job) => {
    const { bulkUploadId, filePath, shopId, userId } = job.data;

    logger.info({
      event: "BULK_UPLOAD_JOB_STARTED",
      jobId: job.id,
      bulkUploadId,
      shopId,
    });

    try {
      const result = await BulkUploadService.processBulkUpload(
        bulkUploadId,
        filePath,
        shopId,
        userId
      );

      logger.info({
        event: "BULK_UPLOAD_JOB_COMPLETED",
        jobId: job.id,
        bulkUploadId,
        result,
      });

      return result;
    } catch (error) {
      logger.error({
        event: "BULK_UPLOAD_JOB_FAILED",
        jobId: job.id,
        bulkUploadId,
        error: error.message,
        stack: error.stack,
      });

      throw error;
    }
  },
  {
    connection: redisClient,
    concurrency: 2, // Process 2 uploads simultaneously
    limiter: {
      max: 5, // Max 5 jobs
      duration: 60000, // per minute
    },
  }
);

bulkUploadWorker.on("completed", (job, result) => {
  logger.info({
    event: "WORKER_JOB_COMPLETED",
    jobId: job.id,
    result,
  });
});

bulkUploadWorker.on("failed", (job, err) => {
  logger.error({
    event: "WORKER_JOB_FAILED",
    jobId: job?.id,
    error: err.message,
  });
});

bulkUploadWorker.on("error", (err) => {
  logger.error({
    event: "WORKER_ERROR",
    error: err.message,
  });
});

logger.info("Bulk Upload Worker started successfully");

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received, closing worker...");
  await bulkUploadWorker.close();
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received, closing worker...");
  await bulkUploadWorker.close();
  await mongoose.connection.close();
  process.exit(0);
});