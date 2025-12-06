const orderService = require("../services/orderService");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const logger = require("../config/logger");
const crypto = require("crypto");

exports.getOrders = async (req, res) => {
  const requestId = req.requestId || crypto.randomBytes(8).toString("hex");
  const context = { route: "orderController.getOrders", requestId };

  logger.info({
    ...context,
    event: "GET_ORDERS_START",
    userId: req.user?._id,
  });

  try {
    const orders = await orderService.getOrders(req);
    logger.info({
      ...context,
      event: "GET_ORDERS_SUCCESS",
      orderCount: orders?.length || 0,
    });
    successResponse(res, orders);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_ORDERS_ERROR",
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};

exports.getOrderById = async (req, res) => {
  const requestId = req.requestId || crypto.randomBytes(8).toString("hex");
  const context = { route: "orderController.getOrderById", requestId };

  logger.info({
    ...context,
    event: "GET_ORDER_BY_ID_START",
    orderId: req.params.orderId,
    userId: req.user?._id,
  });

  try {
    const order = await orderService.getOrderById(req);
    logger.info({
      ...context,
      event: "GET_ORDER_BY_ID_SUCCESS",
      orderId: order?._id,
    });
    successResponse(res, order);
  } catch (err) {
    logger.error({
      ...context,
      event: "GET_ORDER_BY_ID_ERROR",
      orderId: req.params.orderId,
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};

exports.createOrder = async (req, res) => {
  const requestId = req.requestId || crypto.randomBytes(8).toString("hex");
  const context = { route: "orderController.createOrder", requestId };

  logger.info({
    ...context,
    event: "CREATE_ORDER_START",
    userId: req.user?._id,
    body: { ...req.body, paymentGateway: req.body.paymentGateway },
  });

  try {
    const result = await orderService.createOrder({
      user: req.user,
      body: req.body,
      req,
    });
    logger.info({
      ...context,
      event: "CREATE_ORDER_SUCCESS",
      orderId: result?._id || result?.paymentId,
    });
    
    // For COD orders, result is the order object
    // For online payment, result is the payment gateway response
    if (result._id) {
      // COD order - return order
      res.status(200).json({ 
        success: true, 
        message: "Order placed successfully",
        order: result 
      });
    } else {
      // Online payment - return payment gateway data
      res.status(200).json({ 
        success: true, 
        ...result 
      });
    }
  } catch (err) {
    logger.error({
      ...context,
      event: "CREATE_ORDER_ERROR",
      error: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });
    errorResponse(res, err);
  }
};

exports.updateOrderStatus = async (req, res) => {
  const requestId = req.requestId || crypto.randomBytes(8).toString("hex");
  const context = { route: "orderController.updateOrderStatus", requestId };

  logger.info({
    ...context,
    event: "UPDATE_ORDER_STATUS_START",
    orderId: req.params.orderId,
    newStatus: req.body.status,
    userId: req.user?._id,
  });

  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!status) {
      logger.error({
        ...context,
        event: "UPDATE_ORDER_STATUS_VALIDATION_FAILED",
        error: "Status is required",
      });
      return res.status(400).json({ message: "Status is required" });
    }

    const updatedOrder = await orderService.updateStatus(orderId, status);
    logger.info({
      ...context,
      event: "UPDATE_ORDER_STATUS_SUCCESS",
      orderId: updatedOrder?._id,
      newStatus: status,
    });
    successResponse(res, updatedOrder);
  } catch (err) {
    logger.error({
      ...context,
      event: "UPDATE_ORDER_STATUS_ERROR",
      orderId: req.params.orderId,
      error: err.message,
      stack: err.stack,
    });
    errorResponse(res, err);
  }
};