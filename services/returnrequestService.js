// services/returnRequestService.js
const ReturnRequest = require("../models/ReturnRequest");
const Order = require("../models/Order");
const UpsApiService = require("../services/upsApiService");
const FedexApiService = require("../services/fedxapiService");
const Product = require("../models/productModel");
const Shop = require("../models/Shop");
const Customer = require("../models/Customer");
const logger = require("../config/logger");
const mongoose = require("mongoose");

class ReturnRequestService {
  // Customer creates return request (Only logged-in customers)
  async createReturnRequest({ user, body }) {
    const customerId = user.id;
    const { orderId, productId, reason, queryType, description } = body;

    // Validation
    if (!orderId || !productId || !reason || !queryType || !description) {
      throw new Error("All fields are required");
    }

    if (
      !["damaged", "defective", "better_price", "not_perfect"].includes(reason)
    ) {
      throw new Error("Invalid reason");
    }

    if (!["replacement", "refund"].includes(queryType)) {
      throw new Error("Invalid query type");
    }

    // Find order and verify it belongs to this customer
    const order = await Order.findOne({
      _id: orderId,
      customer: customerId,
    }).populate("items.product");

    if (!order) {
      throw new Error("Order not found or unauthorized");
    }

    // Check order status - only delivered/confirmed orders can be returned
    if (!["delivered", "confirmed", "shipped"].includes(order.status)) {
      throw new Error("Order cannot be returned at this stage");
    }

    // Find the specific product in order items
    const orderItem = order.items.find(
      (item) => item.product._id.toString() === productId
    );

    if (!orderItem) {
      throw new Error("Product not found in this order");
    }

    // Verify product belongs to an active shop
    const shop = await Shop.findOne({
      _id: orderItem.shop,
      status: "active",
    });

    if (!shop) {
      throw new Error("Shop is not active. Cannot process return request");
    }

    // Check if return request already exists for this product in this order
    const existingRequest = await ReturnRequest.findOne({
      order: orderId,
      product: productId,
      customer: customerId,
      status: { $in: ["processing", "completed"] },
    });

    if (existingRequest) {
      throw new Error("Return request already exists for this product");
    }

    // Calculate amount
    const itemAmount = orderItem.price * orderItem.quantity;

    // Create return request
    const returnRequest = await ReturnRequest.create({
      order: orderId,
      customer: customerId,
      shop: orderItem.shop,
      product: productId,
      productName: orderItem.name,
      reason,
      queryType,
      description: description.trim(),
      amount: itemAmount,
      quantity: orderItem.quantity,
      status: "processing",
    });

    logger.info(
      `Return request created: ${returnRequest._id} by customer ${customerId} for order ${orderId}`
    );

    // Populate before returning
    await returnRequest.populate([
      { path: "product", select: "productName icon1 sku" },
      { path: "shop", select: "shopName" },
      { path: "order", select: "orderNumber" },
    ]);

    return returnRequest;
  }

  // Get customer's return requests (Only logged-in customers)
  async getCustomerReturnRequests({ user, query }) {
    const customerId = user.id;
    const { status, page = 1, limit = 10 } = query;

    const filter = { customer: customerId };

    if (status && ["processing", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("order", "orderNumber createdAt status")
        .populate("product", "productName icon1 sku")
        .populate("shop", "shopName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // Shopkeeper gets return requests for their ACTIVE shop only
  async getShopReturnRequests({ user, shop, query }) {
    const shopId = shop._id;
    const { status, page = 1, limit = 20 } = query;

    // Verify shop is active
    if (shop.status !== "active") {
      throw new Error("Your shop must be active to view return requests");
    }

    const filter = { shop: shopId };

    if (status && ["processing", "completed", "rejected"].includes(status)) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [requests, total] = await Promise.all([
      ReturnRequest.find(filter)
        .populate("customer", "firstName lastName email phone")
        .populate("order", "orderNumber createdAt status")
        .populate("product", "productName icon1 sku")
        .sort({ status: 1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      ReturnRequest.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // Shopkeeper approves/rejects return request (Only for their active shop's products)
  // --- enterprise-safe version with structured logging ---
async updateReturnRequestStatus({ user, shop, body }) {
  const { requestId, status, comment } = body;

  if (shop.status !== "active") throw new Error("Your shop must be active");
  if (!["completed", "rejected"].includes(status))
    throw new Error("Invalid status");

  const returnRequest = await ReturnRequest.findOne({
    _id: requestId,
    shop: shop._id,
  }).populate({
    path: "order",
    populate: { path: "items.product" },
  });

  if (!returnRequest) throw new Error("Return request not found");
  if (returnRequest.status !== "processing")
    throw new Error(`Return request already ${returnRequest.status}`);

  const session = await mongoose.startSession();
  session.startTransaction();

  let order = null;
  let shipment = null;

  // structured context for consistent log tracing
  const logContext = {
    requestId,
    shopId: shop._id.toString(),
    shopkeeperId: user.id,
    orderId: returnRequest?.order?._id?.toString(),
    customerId: returnRequest?.customer?.toString(),
  };

  try {
    // DB writes only within transaction
    returnRequest.status = status;
    returnRequest.shopkeeperComment = comment || null;
    returnRequest.processedAt = new Date();
    returnRequest.processedBy = user.id;
    await returnRequest.save({ session });

    if (status === "completed") {
      order = await Order.findById(returnRequest.order._id).session(session);

      if (order) {
        shipment = order.shipments.find(
          (s) => s.shop.toString() === shop._id.toString()
        );

        if (shipment) {
          const newStatus =
            returnRequest.queryType === "refund"
              ? "refunded"
              : "return_requested";

          shipment.statusHistory = shipment.statusHistory || [];
          shipment.statusHistory.push({
            oldStatus: shipment.status,
            newStatus,
            changedAt: new Date(),
            by: user.id,
          });

          shipment.status = newStatus;
          shipment.lastUpdated = new Date();

          await order.save({ session });
        }
      }

      // Restore stock (kept identical)
      const orderItem = order.items.find(
        (item) =>
          item.product.toString() === returnRequest.product._id.toString()
      );

      if (orderItem) {
        await Product.findByIdAndUpdate(
          returnRequest.product._id,
          { $inc: { currentStock: orderItem.quantity } },
          { session }
        );
      }
    }

    await session.commitTransaction();
    logger.info({
      ...logContext,
      action: "ReturnRequestStatusUpdated",
      msg: `Return request ${requestId} marked ${status}`,
    });
  } catch (err) {
    await session.abortTransaction();
    logger.error({
      ...logContext,
      msg: "Return request update failed, transaction aborted",
      error: err.message,
    });
    throw err;
  } finally {
    session.endSession();
  }

  // SAFE async zone post-commit
  await returnRequest.populate([
    { path: "customer", select: "firstName lastName email" },
    { path: "product", select: "productName icon1" },
    { path: "order", select: "orderNumber" },
  ]);

  // UPS / FedEx reverse shipment trigger (unchanged business logic)
  if (status === "completed") {
    (async () => {
      try {
        if (
          ["refund", "replacement"].includes(returnRequest.queryType) &&
          order &&
          shipment &&
          shipment.trackingId
        ) {
          const courier = shipment.courierName?.toUpperCase();
          let result = null;

          if (courier === "UPS") {
            result = await UpsApiService.createReturnShipment(
              order,
              shop._id,
              shipment.trackingId
            );
            if (!result?.trackingNumber)
              throw new Error("UPS response missing tracking number");

            await ReturnRequest.findByIdAndUpdate(returnRequest._id, {
              reverseShipmentStatus: "success",
              reverseTrackingId: result.trackingNumber,
            });

            logger.info({
              ...logContext,
              courier,
              msg: `[UPS:Return] Reverse shipment created`,
              tracking: result.trackingNumber,
            });
          } else if (courier === "FEDEX") {
            result = await FedexApiService.createReturnShipment(
              order,
              shop._id,
              shipment.trackingId
            );

            const fedexTrack =
              result?.output?.transactionShipments?.[0]
                ?.masterTrackingNumber || null;

            if (!fedexTrack)
              throw new Error("FedEx response missing tracking number");

            await ReturnRequest.findByIdAndUpdate(returnRequest._id, {
              reverseShipmentStatus: "success",
              reverseTrackingId: fedexTrack,
            });

            logger.info({
              ...logContext,
              courier,
              msg: `[FedEx:Return] Reverse shipment created`,
              tracking: fedexTrack,
            });
          } else {
            logger.warn({
              ...logContext,
              msg: `Unsupported courier for reverse shipment`,
              courier,
            });
          }
        } else {
          logger.warn({
            ...logContext,
            msg: `Reverse shipment skipped - missing tracking or invalid type`,
          });
        }
      } catch (err) {
        logger.error({
          ...logContext,
          msg: "Reverse shipment creation failed",
          error: err.message,
        });

        await ReturnRequest.findByIdAndUpdate(returnRequest._id, {
          reverseShipmentStatus: "failed",
        });
      }
    })();
  }

  return returnRequest;
}

  // Get single return request details
  async getReturnRequestById({ user, requestId, role, shop }) {
    if (!requestId) {
      throw new Error("Request ID is required");
    }

    const query = { _id: requestId };

    // If customer, only their requests
    if (role === "customer") {
      query.customer = user.id;
    }

    // If shopkeeper, only their active shop's requests
    if (role === "shopkeeper") {
      if (!shop || shop.status !== "active") {
        throw new Error("Active shop required");
      }
      query.shop = shop._id;
    }

    const request = await ReturnRequest.findOne(query)
      .populate("customer", "firstName lastName email phone")
      .populate("order", "orderNumber createdAt status")
      .populate("product", "productName icon1 sku")
      .populate("shop", "shopName")
      .populate("processedBy", "firstName lastName");

    if (!request) {
      throw new Error("Return request not found or unauthorized");
    }

    return request;
  }
}

module.exports = new ReturnRequestService();
