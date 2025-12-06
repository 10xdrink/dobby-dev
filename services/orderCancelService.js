const Order = require("../models/Order");
const Product = require("../models/productModel");
const UpsApiService = require("../services/upsApiService");
const FedexApiService = require("../services/fedxapiService");
const logger = require("../config/logger");
const mongoose = require("mongoose");

class OrderCancelService {
  async cancelOrder({ user, body }) {
    const { orderId } = body;
    if (!orderId) throw new Error("Order ID is required");

    const order = await Order.findOne({ _id: orderId, customer: user.id })
      .populate({ path: "shipments.shop", populate: { path: "owner" } });

    if (!order) throw new Error("Order not found or unauthorized");

    const disallowedStatuses = ["cancelled", "delivered", "returned"];
    if (disallowedStatuses.includes(order.status)) {
      throw new Error(`Order cannot be cancelled in '${order.status}' state`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      
      if (["pending", "processing"].includes(order.status)) {
        order.status = "cancelled";
        order.cancelledAt = new Date();
        order.cancelledBy = user.id;
        await order.save({ session });
      } else if (order.shipments && order.shipments.length > 0) {
        
        for (const shipment of order.shipments) {
          if (!shipment.trackingId) continue;

          const courier = shipment.courierName?.toUpperCase();
          try {
            if (courier === "UPS") {
              const cancelRes = await UpsApiService.cancelShipment(shipment.trackingId);
              logger.info(`[UPS] Cancel result: ${cancelRes.status || "unknown"}`);
            } else if (courier === "FEDEX") {
              const cancelRes = await FedexApiService.cancelShipment(shipment.trackingId);
              logger.info(`[FedEx] Cancel result: ${cancelRes.status || "unknown"}`);
            } else {
              logger.warn(`[OrderCancel] Unsupported courier for shipment ${shipment._id}`);
            }

            shipment.status = "cancelled";
            shipment.lastUpdated = new Date();
          } catch (shipErr) {
            logger.error(`[OrderCancel] Shipment ${shipment._id} cancel failed: ${shipErr.message}`);
            // continue to next shipment — don't break entire order cancel
          }
        }

        order.status = "cancelled";
        order.cancelledAt = new Date();
        order.cancelledBy = user.id;
        await order.save({ session });
      } else {
        throw new Error("No valid shipments found to cancel");
      }

      // --- restore product stock ---
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { currentStock: item.quantity } },
          { session }
        );
      }

      // --- notify all shops involved ---
      const affectedShops = order.shipments.map((s) => s.shop);
      for (const shop of affectedShops) {
        if (shop) {
          logger.info(
            `[OrderCancel] Shop ${shop._id} (${shop.shopName}) notified: Order ${order._id} cancelled`
          );
        }
      }

      await session.commitTransaction();
      logger.info(`[OrderCancel] Order ${order._id} cancelled by customer ${user.id}`);

      return { success: true, message: "Order cancelled successfully", order };
    } catch (err) {
      await session.abortTransaction();
      logger.error(`[OrderCancel] Failed: ${err.message}`);
      throw err;
    } finally {
      session.endSession();
    }
  }
}

module.exports = new OrderCancelService();
