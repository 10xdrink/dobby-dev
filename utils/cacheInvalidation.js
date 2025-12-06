const cacheService = require("../services/cacheService");
const logger = require("../config/logger");

class CacheInvalidation {
  static async invalidateOrders(orderId = null) {
    try {
      const patterns = ["api:*:/orders*", "user:*:/orders*", "role:*:/orders*"];

      if (orderId) {
        patterns.push(`order:${orderId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_ORDERS",
        orderId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_ORDERS_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateSalesReports() {
    try {
      const patterns = [
        "api:*:/sales-report*",
        "user:*:/sales-report*",
        "role:*:/sales-report*",
        "salesreport:*",
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_SALES_REPORTS",
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_SALES_REPORTS_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateProducts(productId = null) {
    try {
      const patterns = [
        "api:*:/products*",
        "user:*:/products*",
        "role:*:/products*",
        "global:*:/products*",
      ];

      if (productId) {
        patterns.push(`product:${productId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_PRODUCTS",
        productId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_PRODUCTS_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateCategories(categoryId = null) {
    try {
      const patterns = [
        "api:*:/categories*",
        "global:*:/categories*",
        "category:*",
      ];

      if (categoryId) {
        patterns.push(`category:${categoryId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_CATEGORIES",
        categoryId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_CATEGORIES_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateCustomer(customerId) {
    try {
      const patterns = [`user:${customerId}:*`, `customer:${customerId}:*`];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_CUSTOMER",
        customerId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_CUSTOMER_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateShipments(shipmentId = null) {
    try {
      const patterns = ["shipment:*", "api:*:/shipment*"];

      if (shipmentId) {
        patterns.push(`shipment:${shipmentId}:*`);
      }

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_SHIPMENTS",
        shipmentId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_SHIPMENTS_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateAll() {
    try {
      const deleted = await cacheService.flush();

      logger.warn({
        event: "CACHE_FLUSH_ALL",
        deletedCount: deleted,
      });

      return deleted;
    } catch (err) {
      logger.error({
        event: "CACHE_FLUSH_ALL_ERROR",
        error: err.message,
      });
      return 0;
    }
  }
  static async invalidateStudent(studentId) {
    try {
      const patterns = [
        `user:${studentId}:*`,
        `student:${studentId}:*`,
        "api:*:/students*",
        "role:*:/students*",
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_STUDENT",
        studentId,
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_STUDENT_ERROR",
        error: err.message,
      });
      return 0;
    }
  }

  static async invalidateStudentLists() {
    try {
      const patterns = [
        "api:*:/students/admin*",
        "role:*:/students/admin*",
        "api:*:/students", 
      ];

      let totalDeleted = 0;
      for (const pattern of patterns) {
        const deleted = await cacheService.deletePattern(pattern);
        totalDeleted += deleted;
      }

      logger.info({
        event: "CACHE_INVALIDATE_STUDENT_LISTS",
        deletedCount: totalDeleted,
      });

      return totalDeleted;
    } catch (err) {
      logger.error({
        event: "CACHE_INVALIDATE_STUDENT_LISTS_ERROR",
        error: err.message,
      });
      return 0;
    }
  }
}

module.exports = CacheInvalidation;
