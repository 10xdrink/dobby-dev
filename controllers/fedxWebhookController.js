const crypto = require("crypto");
const Order = require("../models/Order");
const logger = require("../config/logger");

// exports.fedexWebhook = async (req, res) => {
//   const traceId = crypto.randomUUID();

//   logger.info("[FedExWebhook] Incoming webhook received", {
//     traceId,
//     ip: req.ip,
//     headers: Object.keys(req.headers),
//   });

//   try {
    
//     const envHeader = req.headers["x-fedex-environment"];
//     const environment =
//       envHeader && envHeader.toLowerCase() === "sandbox"
//         ? "SANDBOX"
//         : "PRODUCTION";

//     logger.info(`[FedExWebhook] Running in ${environment} mode`, { traceId });

   
//     const signature = req.headers["x-fedex-signature"];
//     const secret = process.env.FEDEX_WEBHOOK_SECRET;
//     const payload = JSON.stringify(req.body);

//     if (!signature) {
//       logger.warn("[FedExWebhook] Missing signature header", { traceId });
//       return res.status(401).send("Unauthorized - Missing signature");
//     }

//     const computed = crypto
//       .createHmac("sha256", secret)
//       .update(payload)
//       .digest("base64");

//     if (computed !== signature) {
//       logger.warn("[FedExWebhook] Invalid HMAC signature", {
//         traceId,
//         computed,
//         received: signature,
//       });
//       return res.status(401).send("Unauthorized - Invalid signature");
//     }

//     logger.info("[FedExWebhook] Signature verified successfully", { traceId });

    
//     const data = req.body;
//     if (!data || typeof data !== "object") {
//       logger.warn("[FedExWebhook] Invalid payload received", {
//         traceId,
//         bodyType: typeof req.body,
//       });
//       return res.status(400).send("Invalid payload");
//     }

//     const trackingNumber = data.trackingNumber?.trim();
//     const status = data.status?.trim()?.toLowerCase();

//     if (!trackingNumber || !status) {
//       logger.warn("[FedExWebhook] Missing tracking number or status", {
//         traceId,
//         receivedData: data,
//       });
//       return res.status(400).send("Invalid payload");
//     }

//     logger.info("[FedExWebhook] Processing event", {
//       traceId,
//       trackingNumber,
//       status,
//     });

   
//     const order = await Order.findOne({
//       "shipments.trackingId": trackingNumber,
//     });

//     if (!order) {
//       logger.warn("[FedExWebhook] Order not found for tracking number", {
//         traceId,
//         trackingNumber,
//       });
//       return res.status(404).send("Order not found");
//     }

    
//     const statusMap = {
//       delivered: "delivered",
//       in_transit: "in_transit",
//       cancelled: "cancelled",
//       returned: "returned",
//       exception: "exception",
//     };

//     const mappedStatus = statusMap[status];
//     if (!mappedStatus) {
//       logger.info("[FedExWebhook] Ignoring unhandled status", {
//         traceId,
//         trackingNumber,
//         fedexStatus: status,
//       });
//       return res.json({ success: true, ignored: true });
//     }

    
//     await Order.updateOne(
//       { _id: order._id, "shipments.trackingId": trackingNumber },
//       {
//         $set: {
//           "shipments.$.status": mappedStatus,
//           "shipments.$.lastUpdated": new Date(),
//         },
//       }
//     );

//     logger.info("[FedExWebhook] Shipment updated successfully", {
//       traceId,
//       orderId: order._id,
//       trackingNumber,
//       mappedStatus,
//     });

    
//     const updatedOrder = await Order.findById(order._id);
//     const allDelivered = updatedOrder.shipments.every(
//       (s) => s.status === "delivered"
//     );

//     if (allDelivered && updatedOrder.status !== "delivered") {
//       updatedOrder.status = "delivered";
//       await updatedOrder.save();
//       logger.info("[FedExWebhook] Entire order marked as delivered", {
//         traceId,
//         orderId: order._id,
//       });
//     }

//     logger.info("[FedExWebhook] Webhook processed successfully", {
//       traceId,
//       trackingNumber,
//       finalStatus: mappedStatus,
//     });

//     res.json({ success: true });
//   } catch (err) {
//     logger.error("[FedExWebhook] Error processing webhook", {
//       traceId,
//       error: err.message,
//       stack: err.stack,
//       body: req.body,
//     });
//     res.status(500).send("Error processing webhook");
//   }
// };

exports.fedexWebhook = async (req, res) => {

  const traceId = crypto.randomUUID();

  logger.info("[FedExWebhook] Incoming webhook received", {
    traceId,
    ip: req.ip,
    headers: Object.keys(req.headers),
  });

    try {
    const signature = req.headers["x-fedex-signature"];
    const secret = process.env.FEDEX_WEBHOOK_SECRET;

    if (!signature || !secret) {
      logger.warn("[FedExWebhook] Missing signature or secret", { traceId });
      return res.status(401).send("Unauthorized");
    }

    
    const payload = req.body; 
    const expectedBase64 = crypto.createHmac("sha256", secret).update(payload).digest("base64");
    const expectedHex = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (signature !== expectedBase64 && signature !== expectedHex) {
      logger.warn("[FedExWebhook] Invalid signature", {
        traceId,
        receivedSignature: signature.slice(0, 10) + "...",
      });
      return res.status(401).send("Invalid signature");
    }

    
    const data = JSON.parse(payload.toString());

    if (!data || typeof data !== "object") {
      logger.warn("[FedExWebhook] Invalid payload received", {
        traceId,
        bodyType: typeof data,
      });
      return res.status(400).send("Invalid payload");
    }

    const trackingNumber = data.trackingNumber?.trim();
    const status = data.status?.trim()?.toLowerCase();

    if (!trackingNumber || !status) {
      logger.warn("[FedExWebhook] Missing tracking number or status", {
        traceId,
        receivedData: data,
      });
      return res.status(400).send("Invalid payload");
    }

    logger.info("[FedExWebhook] Processing event", {
      traceId,
      trackingNumber,
      status,
    });

    
    const order = await Order.findOne({ "shipments.trackingId": trackingNumber });
    if (!order) {
      logger.warn("[FedExWebhook] Order not found for tracking number", {
        traceId,
        trackingNumber,
      });
      return res.status(404).send("Order not found");
    }

    
    const statusMap = {
  pending: "pending",
  created: "pending",
  label_created: "packed",          // label generated
  picked_up: "shipped",             // picked up from seller
  in_transit: "in_transit",         // moving between hubs
  out_for_delivery: "out_for_delivery", // vehicle loaded
  delivered: "delivered",           // delivered successfully
  cancelled: "cancelled",           // shipment cancelled
  return_initiated: "return_requested",
  returned: "returned",
  exception: "failed",              // damaged/lost/failed
  failed: "failed",
};


    const mappedStatus = statusMap[status];
    if (!mappedStatus) {
      logger.info("[FedExWebhook] Ignoring unhandled status", {
        traceId,
        trackingNumber,
        fedexStatus: status,
      });
      return res.json({ success: true, ignored: true });
    }

   
    await Order.updateOne(
      { _id: order._id, "shipments.trackingId": trackingNumber },
      {
        $set: {
          "shipments.$.status": mappedStatus,
          "shipments.$.lastUpdated": new Date(),
        },
      }
    );

    logger.info("[FedExWebhook] Shipment updated successfully", {
      traceId,
      orderId: order._id,
      trackingNumber,
      mappedStatus,
    });

    
    const updatedOrder = await Order.findById(order._id);
    const allDelivered = updatedOrder.shipments.every(
      (s) => s.status === "delivered"
    );

    if (allDelivered && updatedOrder.status !== "delivered") {
      updatedOrder.status = "delivered";
      await updatedOrder.save();
      logger.info("[FedExWebhook] Entire order marked as delivered", {
        traceId,
        orderId: order._id,
      });
    }

    
    logger.info("[FedExWebhook] Webhook processed successfully", {
      traceId,
      trackingNumber,
      finalStatus: mappedStatus,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error("[FedExWebhook] Error processing webhook", {
      traceId,
      error: err.message,
      stack: err.stack,
      body: req.body,
    });
    res.status(500).send("Error processing webhook");
  }
};
