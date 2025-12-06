const CacheInvalidation = require("../utils/cacheInvalidation");
const logger = require("../config/logger");

class OrderHooks {
  static async onOrderCreated(order) {
    try {
      logger.info({
        event: "ORDER_CREATED_HOOK",
        orderId: order._id,
      });

      await CacheInvalidation.invalidateSalesReports();
      await CacheInvalidation.invalidateOrders();

      if (order.customer) {
        await CacheInvalidation.invalidateCustomer(order.customer);
      }

      logger.debug({
        event: "ORDER_CREATED_CACHE_INVALIDATED",
        orderId: order._id,
      });
    } catch (err) {
      logger.error({
        event: "ORDER_CREATED_HOOK_ERROR",
        orderId: order._id,
        error: err.message,
      });
    }
  }

  static async onOrderUpdated(order) {
    try {
      logger.info({
        event: "ORDER_UPDATED_HOOK",
        orderId: order._id,
        status: order.status,
      });

      await CacheInvalidation.invalidateSalesReports();
      await CacheInvalidation.invalidateOrders(order._id);

      if (order.customer) {
        await CacheInvalidation.invalidateCustomer(order.customer);
      }

      logger.debug({
        event: "ORDER_UPDATED_CACHE_INVALIDATED",
        orderId: order._id,
      });
    } catch (err) {
      logger.error({
        event: "ORDER_UPDATED_HOOK_ERROR",
        orderId: order._id,
        error: err.message,
      });
    }
  }

  static async onOrderStatusChanged(order, oldStatus, newStatus) {
    try {
      logger.info({
        event: "ORDER_STATUS_CHANGED_HOOK",
        orderId: order._id,
        oldStatus,
        newStatus,
      });

      const statusesAffectingSales = [
        "completed",
        "cancelled",
        "refunded",
        "delivered",
      ];

      if (
        statusesAffectingSales.includes(oldStatus) ||
        statusesAffectingSales.includes(newStatus)
      ) {
        await CacheInvalidation.invalidateSalesReports();
        logger.info({
          event: "SALES_REPORTS_INVALIDATED_DUE_TO_STATUS_CHANGE",
          orderId: order._id,
          oldStatus,
          newStatus,
        });
      }

      await CacheInvalidation.invalidateOrders(order._id);

      if (order.customer) {
        await CacheInvalidation.invalidateCustomer(order.customer);
      }

      if (newStatus === "shipped" || newStatus === "delivered") {
        await CacheInvalidation.invalidateShipments();
      }
    } catch (err) {
      logger.error({
        event: "ORDER_STATUS_CHANGED_HOOK_ERROR",
        orderId: order._id,
        error: err.message,
      });
    }
  }

  static async onOrderCancelled(order) {
    try {
      logger.info({
        event: "ORDER_CANCELLED_HOOK",
        orderId: order._id,
      });

      await CacheInvalidation.invalidateSalesReports();
      await CacheInvalidation.invalidateOrders(order._id);

      if (order.customer) {
        await CacheInvalidation.invalidateCustomer(order.customer);
      }

      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          if (item.product) {
            await CacheInvalidation.invalidateProducts(item.product);
          }
        }
      }
    } catch (err) {
      logger.error({
        event: "ORDER_CANCELLED_HOOK_ERROR",
        orderId: order._id,
        error: err.message,
      });
    }
  }
}

module.exports = OrderHooks;
