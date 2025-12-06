const CacheInvalidation = require("../utils/cacheInvalidation");
const logger = require("../config/logger");

class ProductHooks {
  static async onProductCreated(product) {
    try {
      logger.info({
        event: "PRODUCT_CREATED_HOOK",
        productId: product._id,
      });

      await CacheInvalidation.invalidateProducts();

      if (product.category) {
        await CacheInvalidation.invalidateCategories(product.category);
      }

      logger.debug({
        event: "PRODUCT_CREATED_CACHE_INVALIDATED",
        productId: product._id,
      });
    } catch (err) {
      logger.error({
        event: "PRODUCT_CREATED_HOOK_ERROR",
        productId: product._id,
        error: err.message,
      });
    }
  }

  static async onProductUpdated(product) {
    try {
      logger.info({
        event: "PRODUCT_UPDATED_HOOK",
        productId: product._id,
      });

      await CacheInvalidation.invalidateProducts(product._id);
      await CacheInvalidation.invalidateSalesReports();

      if (product.category) {
        await CacheInvalidation.invalidateCategories(product.category);
      }

      logger.debug({
        event: "PRODUCT_UPDATED_CACHE_INVALIDATED",
        productId: product._id,
      });
    } catch (err) {
      logger.error({
        event: "PRODUCT_UPDATED_HOOK_ERROR",
        productId: product._id,
        error: err.message,
      });
    }
  }

  static async onProductDeleted(productId) {
    try {
      logger.info({
        event: "PRODUCT_DELETED_HOOK",
        productId,
      });

      await CacheInvalidation.invalidateProducts(productId);
      await CacheInvalidation.invalidateSalesReports();

      logger.debug({
        event: "PRODUCT_DELETED_CACHE_INVALIDATED",
        productId,
      });
    } catch (err) {
      logger.error({
        event: "PRODUCT_DELETED_HOOK_ERROR",
        productId,
        error: err.message,
      });
    }
  }

  static async onProductStockChanged(product, oldStock, newStock) {
    try {
      logger.info({
        event: "PRODUCT_STOCK_CHANGED_HOOK",
        productId: product._id,
        oldStock,
        newStock,
      });

      await CacheInvalidation.invalidateProducts(product._id);

      logger.debug({
        event: "PRODUCT_STOCK_CHANGED_CACHE_INVALIDATED",
        productId: product._id,
      });
    } catch (err) {
      logger.error({
        event: "PRODUCT_STOCK_CHANGED_HOOK_ERROR",
        productId: product._id,
        error: err.message,
      });
    }
  }
}

module.exports = ProductHooks;
