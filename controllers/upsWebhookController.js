const crypto = require("crypto");
const logger = require("../config/logger");
const Order = require("../models/Order");

exports.upsWebhook = async (req, res) => {
  logger.info("[UPS:Webhook] Incoming webhook");

  try {
    const signature = req.headers["x-ups-signature"];
    if (!signature) {
      logger.error("[UPS:Webhook] Missing signature header");
      return res.status(400).json({ success: false, message: "Signature missing" });
    }

    
    const rawBody = req.body instanceof Buffer ? req.body.toString("utf8") : JSON.stringify(req.body);

    const computed = crypto
      .createHmac("sha256", process.env.UPS_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (signature !== computed) {
      logger.error("[UPS:Webhook] Signature mismatch");
      return res.status(401).json({ success: false, message: "Invalid signature" });
    }

    const event = JSON.parse(rawBody);
    const { trackingNumber, status, timestamp } = event;

    if (!trackingNumber) {
      logger.error("[UPS:Webhook] Missing tracking number");
      return res.status(400).json({ success: false, message: "Tracking number missing" });
    }

    const validStatuses = [
  "label_created",
  "shipped",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception",
  "return_initiated",
  "returned_to_seller",
  "refund_processed"
];

    if (!validStatuses.includes(status)) {
      logger.warn(`[UPS:Webhook] Ignored unknown status: ${status}`);
      return res.status(200).json({ success: true, message: "Event ignored" });
    }

    const eventId = req.headers["x-ups-event-id"];
    if (!eventId) {
      logger.warn("[UPS:Webhook] Missing event ID, skipping idempotency check");
    }

    const order = await Order.findOne({ "shipments.trackingId": trackingNumber });
    if (!order) {
      logger.warn(`[UPS:Webhook] No order found for ${trackingNumber}`);
      return res.status(200).json({ success: true });
    }

    const shipment = order.shipments.find(s => s.trackingId === trackingNumber);
    if (!shipment) {
      logger.warn(`[UPS:Webhook] No shipment found for tracking ${trackingNumber}`);
      return res.status(200).json({ success: true });
    }

   
    if (shipment.lastWebhookEventId === eventId && shipment.lastStatus === status) {
      logger.info(`[UPS:Webhook] Duplicate event ignored for ${trackingNumber}`);
      return res.status(200).json({ success: true });
    }

   
    
const statusMap = {
  label_created: "confirmed",
  shipped: "shipped",
  in_transit: "in_transit",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  exception: "failed",
  return_initiated: "return_requested",
  returned_to_seller: "returned",
  refund_processed: "refunded",
};

const internalStatus = statusMap[status] || "pending";

// Update shipment
shipment.status = internalStatus;
shipment.lastStatus = internalStatus;
shipment.lastWebhookEventId = eventId;
shipment.lastUpdated = new Date(timestamp || Date.now());

    await order.save();

    logger.info(`[UPS:Webhook] Updated shipment ${trackingNumber} → ${status}`);
    return res.status(200).json({ success: true });
    
  } catch (err) {
    logger.error("[UPS:Webhook] Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};
