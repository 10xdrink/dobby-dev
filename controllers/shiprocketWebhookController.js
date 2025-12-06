const Order = require("../models/Order");
const logger = require("../config/logger");

exports.shiprocketWebhook = async (req, res) => {
  try {
    
    const receivedToken = req.headers["x-shiprocket-token"];
    const validToken = process.env.SHIPROCKET_WEBHOOK_SECRET;

    if (!receivedToken || receivedToken !== validToken) {
      logger.warn("Unauthorized Shiprocket webhook attempt", {
        ip: req.ip,
        receivedToken,
      });
      return res.status(401).send("Unauthorized");
    }

    
    const data = req.body;
    if (!data || typeof data !== "object") {
      logger.warn("Invalid webhook payload: not JSON", { body: req.body });
      return res.status(400).send("Invalid payload");
    }

    const awb = data.awb?.trim();
    const status = data.current_status?.trim()?.toUpperCase();

    if (!awb || !status) {
      logger.warn("Invalid webhook payload: missing awb or status", { data });
      return res.status(400).send("Invalid payload");
    }

    
    const order = await Order.findOne({ "shipments.trackingId": awb });
    if (!order) {
      logger.warn("Shiprocket webhook: Order not found for AWB", { awb });
      return res.status(404).send("Order not found");
    }

    
    const statusMap = {
      PICKUP_SCHEDULED: "confirmed",
      PICKUP_GENERATED: "packed",
      OUT_FOR_DELIVERY: "in_transit",
      IN_TRANSIT: "in_transit",
      SHIPPED: "shipped",
      DELIVERED: "delivered",
      RETURNED: "returned",
      CANCELLED: "cancelled",
    };

    const mappedStatus = statusMap[status];

    if (!mappedStatus) {
      logger.info("Ignoring unknown Shiprocket status", { awb, status });
      return res.json({ success: true, ignored: true });
    }

    
    const updateResult = await Order.updateOne(
      { _id: order._id, "shipments.trackingId": awb },
      {
        $set: {
          "shipments.$.status": mappedStatus,
          "shipments.$.lastUpdated": new Date(),
        },
      }
    );

    if (updateResult.modifiedCount === 0) {
      logger.warn("No shipment updated for AWB", { awb });
      return res.status(404).send("Shipment not found");
    }

    
    const updatedOrder = await Order.findById(order._id);
    const allDelivered = updatedOrder.shipments.every(
      (s) => s.status === "delivered"
    );

    if (allDelivered && updatedOrder.status !== "delivered") {
      updatedOrder.status = "delivered";
      await updatedOrder.save();
      logger.info(`Order ${order._id} marked delivered (all shipments)`);
    }

    logger.info(`Shiprocket webhook updated ${awb} → ${mappedStatus}`);
    res.json({ success: true });
  } catch (err) {
    logger.error("Shiprocket webhook error", { error: err.message, stack: err.stack });
    res.status(500).send("Error processing webhook");
  }
};
