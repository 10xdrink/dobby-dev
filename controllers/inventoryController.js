// controllers/inventoryController.js
const inventoryService = require("../services/inventoryService");
const cacheService = require("../services/cacheService");
const logger = require("../config/logger");
const crypto = require("crypto");

/**
 * Get Inventory Status Table
 * GET /api/shopkeeper/inventory/status
 */
exports.getInventoryStatus = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = {
    route: "inventoryController.getInventoryStatus",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
  };

  logger.info({
    ...context,
    event: "INVENTORY_STATUS_REQUEST",
  });

  try {
    if (!req.shop || !req.shop._id) {
      logger.error({
        ...context,
        event: "SHOP_NOT_FOUND",
      });
      return res.status(403).json({
        success: false,
        message: "Active shop required",
      });
    }

    const cacheKey = `shop:${req.shop._id}:inventory:status`;
    const result = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const data = await inventoryService.getInventoryStatus({
        shopId: req.shop._id,
        requestId,
      });

      logger.info({
        ...context,
        event: "INVENTORY_STATUS_SUCCESS",
        dataCount: data.data?.length || 0,
      });

      return data;
    });

    res.json(result);
  } catch (err) {
    logger.error({
      ...context,
      event: "INVENTORY_STATUS_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch inventory status",
    });
  }
};

/**
 * Get Inventory Statistics
 * GET /api/shopkeeper/inventory/stats
 * Query params: startDate, endDate
 */
exports.getInventoryStats = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { startDate, endDate } = req.query;
  
  const context = {
    route: "inventoryController.getInventoryStats",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
    dateRange: { startDate, endDate },
  };

  logger.info({
    ...context,
    event: "INVENTORY_STATS_REQUEST",
  });

  try {
    if (!req.shop || !req.shop._id) {
      logger.error({
        ...context,
        event: "SHOP_NOT_FOUND",
      });
      return res.status(403).json({
        success: false,
        message: "Active shop required",
      });
    }

    const cacheKey = `shop:${req.shop._id}:inventory:stats:${startDate || 'all'}:${endDate || 'all'}`;
    const result = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const data = await inventoryService.getInventoryStats({
        shopId: req.shop._id,
        startDate,
        endDate,
        requestId,
      });

      logger.info({
        ...context,
        event: "INVENTORY_STATS_SUCCESS",
        stats: data.data,
      });

      return data;
    });

    res.json(result);
  } catch (err) {
    logger.error({
      ...context,
      event: "INVENTORY_STATS_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch inventory statistics",
    });
  }
};

/**
 * Get Inventory Turnover
 * GET /api/shopkeeper/inventory/turnover
 * Query params: filterBy (category|product|location), startDate, endDate
 */
exports.getInventoryTurnover = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { filterBy = "category", startDate, endDate } = req.query;
  
  const context = {
    route: "inventoryController.getInventoryTurnover",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
    filterBy,
    dateRange: { startDate, endDate },
  };

  logger.info({
    ...context,
    event: "INVENTORY_TURNOVER_REQUEST",
  });

  try {
    if (!req.shop || !req.shop._id) {
      logger.error({
        ...context,
        event: "SHOP_NOT_FOUND",
      });
      return res.status(403).json({
        success: false,
        message: "Active shop required",
      });
    }

    // Validate filterBy
    const validFilters = ["category", "product", "location"];
    if (!validFilters.includes(filterBy)) {
      logger.warn({
        ...context,
        event: "INVALID_FILTER",
        filterBy,
      });
      return res.status(400).json({
        success: false,
        message: "Invalid filterBy parameter. Use: category, product, or location",
      });
    }

    const cacheKey = `shop:${req.shop._id}:inventory:turnover:${filterBy}:${startDate || 'all'}:${endDate || 'all'}`;
    const result = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const data = await inventoryService.getInventoryTurnover({
        shopId: req.shop._id,
        filterBy,
        startDate,
        endDate,
        requestId,
      });

      logger.info({
        ...context,
        event: "INVENTORY_TURNOVER_SUCCESS",
        dataCount: data.data?.length || 0,
      });

      return data;
    });

    res.json(result);
  } catch (err) {
    logger.error({
      ...context,
      event: "INVENTORY_TURNOVER_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch inventory turnover",
    });
  }
};

/**
 * Get Stock Movement Report
 * GET /api/shopkeeper/inventory/stock-movement
 * Query params: period (7days|30days|thisMonth), startDate, endDate
 */
exports.getStockMovement = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { period = "7days", startDate, endDate } = req.query;
  
  const context = {
    route: "inventoryController.getStockMovement",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
    period,
    dateRange: { startDate, endDate },
  };

  logger.info({
    ...context,
    event: "STOCK_MOVEMENT_REQUEST",
  });

  try {
    if (!req.shop || !req.shop._id) {
      logger.error({
        ...context,
        event: "SHOP_NOT_FOUND",
      });
      return res.status(403).json({
        success: false,
        message: "Active shop required",
      });
    }

    const cacheKey = `shop:${req.shop._id}:inventory:movement:${period}:${startDate || 'all'}:${endDate || 'all'}`;
    const result = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const data = await inventoryService.getStockMovement({
        shopId: req.shop._id,
        period,
        startDate,
        endDate,
        requestId,
      });

      logger.info({
        ...context,
        event: "STOCK_MOVEMENT_SUCCESS",
        dataCount: data.data?.length || 0,
      });

      return data;
    });

    res.json(result);
  } catch (err) {
    logger.error({
      ...context,
      event: "STOCK_MOVEMENT_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch stock movement",
    });
  }
};

/**
 * Get Complete Inventory Report
 * GET /api/shopkeeper/inventory/report
 * Query params: startDate, endDate, filterBy, period
 */
exports.getCompleteInventoryReport = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const { 
    startDate, 
    endDate, 
    filterBy = "category",
    period = "7days" 
  } = req.query;
  
  const context = {
    route: "inventoryController.getCompleteInventoryReport",
    requestId,
    shopId: req.shop?._id?.toString(),
    userId: req.user?.id,
    params: { startDate, endDate, filterBy, period },
  };

  logger.info({
    ...context,
    event: "COMPLETE_REPORT_REQUEST",
  });

  try {
    if (!req.shop || !req.shop._id) {
      logger.error({
        ...context,
        event: "SHOP_NOT_FOUND",
      });
      return res.status(403).json({
        success: false,
        message: "Active shop required",
      });
    }

    const cacheKey = `shop:${req.shop._id}:inventory:report:${period}:${filterBy}:${startDate || 'all'}:${endDate || 'all'}`;
    const completeReport = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      // Fetch all data in parallel
      const [statusResult, statsResult, turnoverResult, movementResult] = 
        await Promise.all([
          inventoryService.getInventoryStatus({
            shopId: req.shop._id,
            requestId,
          }),
          inventoryService.getInventoryStats({
            shopId: req.shop._id,
            startDate,
            endDate,
            requestId,
          }),
          inventoryService.getInventoryTurnover({
            shopId: req.shop._id,
            filterBy,
            startDate,
            endDate,
            requestId,
          }),
          inventoryService.getStockMovement({
            shopId: req.shop._id,
            period,
            startDate,
            endDate,
            requestId,
          }),
        ]);

      const report = {
        success: true,
        data: {
          inventoryStatus: statusResult.data,
          stats: statsResult.data,
          turnover: turnoverResult.data,
          stockMovement: movementResult.data,
        },
      };

      logger.info({
        ...context,
        event: "COMPLETE_REPORT_SUCCESS",
        statusCount: statusResult.data?.length || 0,
        turnoverCount: turnoverResult.data?.length || 0,
        movementCount: movementResult.data?.length || 0,
      });

      return report;
    });

    res.json(completeReport);
  } catch (err) {
    logger.error({
      ...context,
      event: "COMPLETE_REPORT_FAILED",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch complete inventory report",
    });
  }
};