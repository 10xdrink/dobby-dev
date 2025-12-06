const { Worker } = require("bullmq");
const Redis = require("ioredis");
const UpsApiService = require("../services/upsApiService");
const FedexApiService = require("../services/fedexApiService");
const ShiprocketApiService = require("../services/shiprocketApiService");
const logger = require("../config/logger");

const connection = new Redis(process.env.REDIS_URL);

const worker = new Worker(
  "shipmentQueue",
  async (job) => {
    const { courier, order, shopId, shopItems } = job.data;

    try {
      logger.info(`[ShipmentWorker] Processing ${courier} for order ${order._id}`);

      if (courier === "UPS")
        await UpsApiService.createShipment(order, shopId, shopItems);
      else if (courier === "FEDEX")
        await FedexApiService.createShipment(order, shopId, shopItems);
      else if (courier === "SHIPROCKET")
        await ShiprocketApiService.createShipment(order, shopId, shopItems);

      logger.info(`[ShipmentWorker] Shipment created successfully for ${courier}`);
    } catch (err) {
      logger.error(`[ShipmentWorker] ${courier} failed: ${err.message}`);
      throw err; 
    }
  },
  { connection }
);


worker.on("failed", (job, err) => {
  logger.error(
    `[ShipmentWorker] Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`
  );
});

worker.on("completed", (job) => {
  logger.info(`[ShipmentWorker] Job ${job.id} completed successfully`);
});

module.exports = worker;
