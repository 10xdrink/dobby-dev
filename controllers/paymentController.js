const Payment = require("../models/Payment");
const PaymentGateway = require("../models/PaymentGateway");
const PaymentSettings = require("../models/PaymentSettings");
const Shop = require("../models/Shop");
const Order = require("../models/Order");
const User = require("../models/User");
const mongoose = require("mongoose");
const crypto = require("crypto");
const Stripe = require("stripe");
const Razorpay = require("razorpay");
const paypal = require("@paypal/checkout-server-sdk");
const logger = require("../config/logger")

// helper to get active gateway config
async function getGatewayConfig(name) {
  // Check if digital payment is enabled
  const paymentSettings = await PaymentSettings.getSettings();
  if (!paymentSettings.digitalPaymentEnabled) {
    throw new Error("Digital payment methods are currently disabled");
  }
  
  const g = await PaymentGateway.findOne({ name, isActive: true });
  if (!g) throw new Error("Payment gateway not available");
  return g;
}

// Create idempotency key (client may send a key too)
function createIdempotencyKey() {
  return crypto.randomBytes(16).toString("hex");
}

// Initiate payment
exports.initiatePayment = async (req, res) => {
  const requestId = req.requestId || crypto.randomBytes(8).toString("hex");
  const context = { route: "paymentController.initiatePayment", requestId };

  logger.info({
    ...context,
    event: "PAYMENT_INITIATE_START",
    userId: req.user?.id,
  });

  try {
    const userId = req.user.id;
    const owner = await User.findById(userId);
    if (!owner) {
      logger.error({
        ...context,
        event: "USER_NOT_FOUND",
        userId,
      });
      return res.status(404).json({ message: "User not found" });
    }
    if (owner.role !== "shopkeeper") {
      logger.error({
        ...context,
        event: "UNAUTHORIZED_ROLE",
        userId,
        role: owner.role,
      });
      return res.status(403).json({ message: "Only shopkeepers allowed" });
    }

    // SECURITY: Check if user already has a shop
    const existingShop = await Shop.findOne({ owner: userId });
    if (existingShop) {
      logger.warn({
        ...context,
        event: "SHOP_ALREADY_EXISTS",
        userId,
        shopId: existingShop._id,
      });
      return res
        .status(400)
        .json({ message: "Shop already exists for this user" });
    }

    // SECURITY: Check if user already has a paid payment (prevent duplicate payments)
    // Allow new payment only if previous payments are cancelled or failed
    const existingPaidPayment = await Payment.findOne({
      owner: userId,
      type: "shop",
      status: { $in: ["paid", "used"] },
    }).sort({ createdAt: -1 });

    if (existingPaidPayment) {
      // Check if payment is used and shop exists
      if (existingPaidPayment.status === "used") {
        const shopForPayment = await Shop.findOne({ payment: existingPaidPayment._id });
        if (shopForPayment) {
          logger.warn({
            ...context,
            event: "SHOP_ALREADY_CREATED_WITH_PAYMENT",
            userId,
            paymentId: existingPaidPayment._id,
            shopId: shopForPayment._id,
          });
          return res.status(400).json({
            message: "You have already created a shop with this payment.",
          });
        }
      }

      logger.warn({
        ...context,
        event: "PAYMENT_ALREADY_EXISTS",
        userId,
        paymentId: existingPaidPayment._id,
        paymentStatus: existingPaidPayment.status,
      });
      return res.status(400).json({
        message: "You have already paid for shop creation. Please create your shop.",
        paymentId: existingPaidPayment._id,
        paymentStatus: existingPaidPayment.status,
      });
    }

    const {
      gateway,
      shopName,
      shopAddress,
      phoneNumber,
      idempotencyKey,
    } = req.body;

    if (!gateway) {
      logger.error({
        ...context,
        event: "GATEWAY_MISSING",
        body: req.body,
      });
      return res.status(400).json({ message: "gateway required" });
    }

    logger.debug({
      ...context,
      event: "PAYMENT_INITIATE_VALIDATED",
      gateway,
      shopName,
    });

    // create Payment record (pending)
    const amount = 3000 * 100; // amount in paise for INR for stripe/razorpay
    const currency = "INR";
    const key = idempotencyKey || createIdempotencyKey();

    const payment = new Payment({
      owner: userId,
      amount: 3000,
      currency,
      gateway,
      status: "pending",
      idempotencyKey: key,
      metadata: { shopName, shopAddress, phoneNumber},
      type: "shop" 
    });
    await payment.save();

    // Now create gateway-specific order / payment intent
    if (gateway === "stripe") {
      const cfg = await getGatewayConfig("stripe");
      const stripe = Stripe(cfg.credentials.apiKey);
      // create PaymentIntent
      const pi = await stripe.paymentIntents.create(
        {
          amount: 3000 * 100,
          currency: "inr",
          metadata: { paymentId: payment._id.toString(), owner: userId },
        },
        { idempotencyKey: key }
      );

      payment.gatewayOrderId = pi.id;
      payment.clientSecret = pi.client_secret;
      await payment.save();

      return res.json({
        paymentId: payment._id,
        clientSecret: pi.client_secret,
        gateway: "stripe",
      });
    }

    if (gateway === "razorpay") {
      const cfg = await getGatewayConfig("razorpay");
      const rzp = new Razorpay({
        key_id: cfg.credentials.apiKey,
        key_secret: cfg.credentials.apiSecret,
      });

      const options = {
        amount: 3000 * 100,
        currency: "INR",
        receipt: `payment_${payment._id}`,
        payment_capture: 1,
      };
      const order = await rzp.orders.create(options);
      payment.gatewayOrderId = order.id;
      await payment.save();

      return res.json({
        paymentId: payment._id,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        gateway: "razorpay",
      });
    }

    if (gateway === "paypal") {
      const cfg = await getGatewayConfig("paypal");

      // PayPal environment
      const environment = new paypal.core.SandboxEnvironment(
        cfg.credentials.clientId,
        cfg.credentials.clientSecret
      );
      // If cfg is production use LiveEnvironment
      const client = new paypal.core.PayPalHttpClient(environment);

      const request = new paypal.orders.OrdersCreateRequest();
      request.prefer("return=representation");
      request.requestBody({
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: { currency_code: "INR", value: "3000.00" },
            description: "Shop creation fee",
          },
        ],
        application_context: {
          brand_name: "Dobby Mall",
          return_url: `${process.env.FRONTEND_PROD}/shopkeeper/shopManagement/Edit-shop`,
          cancel_url: `${process.env.FRONTEND_PROD}/shopkeeper/shopManagement`,
        },
      });

      const order = await client.execute(request);
      payment.gatewayOrderId = order.result.id;
      await payment.save();

      // Return approve link to client
      const approveLink = order.result.links.find(
        (l) => l.rel === "approve"
      )?.href;
      return res.json({
        paymentId: payment._id,
        approveLink,
        gateway: "paypal",
      });
    }

    return res.status(400).json({ message: "Unsupported gateway" });
  } catch (err) {
    console.error("initiatePayment err", err);
    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};





exports.confirmPayment = async (req, res) => {
  const requestId = req.requestId || createIdempotencyKey();
  const context = { route: "confirmPayment", requestId };

  try {
    const { paymentId, gatewayPaymentId } = req.body;

    if (!paymentId) {
      logger.warn({
        ...context,
        event: "MISSING_PAYMENT_ID",
        message: "Payment ID required",
        body: req.body,
      });
      return res.status(400).json({ message: "Payment ID required" });
    }

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      logger.warn({
        ...context,
        event: "PAYMENT_NOT_FOUND",
        paymentId,
        message: "Payment not found",
      });
      return res.status(404).json({ message: "Payment not found" });
    }

    // ===== Block manual confirmation for customer orders =====
     if (payment.type === "order") {
      logger.info({
        ...context,
        event: "BLOCK_MANUAL_CONFIRM_ORDER",
        paymentId: payment._id,
        message: "Customer order payments are confirmed automatically via webhook.",
      });
      return res.status(403).json({
        message: "Customer order payments are confirmed automatically via webhook.",
      });
    }

    // ===== Shop payments manual confirm =====
    if (payment.status === "paid") {
      logger.info({
        ...context,
        event: "ALREADY_PAID",
        paymentId: payment._id,
        owner: payment.owner,
        message: "Payment already verified",
      });
      return res.status(200).json({ message: "Already paid" });
    }

    // ===== Mark payment as paid =====
    payment.gatewayPaymentId = gatewayPaymentId || null;
    payment.status = "paid";
    await payment.save();

    logger.info({
      ...context,
      event: "PAYMENT_CONFIRMED",
      paymentId: payment._id,
      owner: payment.owner,
      gatewayPaymentId,
      type: payment.type,
      message: "Payment status updated to paid",
    });

    // ===== Update order if exists =====
    if (payment.order) {
      const order = await Order.findById(payment.order);
      if (order && order.status !== "paid") {
        order.status = "paid";
        await order.save();

        logger.info({
          ...context,
          event: "ORDER_UPDATED",
          orderId: order._id,
          linkedPayment: payment._id,
          message: "Linked order marked as paid",
        });
      } else if (!order) {
        logger.warn({
          ...context,
          event: "ORDER_NOT_FOUND",
          linkedPayment: payment._id,
          message: "Linked order not found for payment",
        });
      }
    }

    return res.json({
      message: "Payment confirmed successfully.",
      paymentStatus: payment.status,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "CONFIRM_PAYMENT_ERROR",
      message: err.message,
      stack: err.stack,
      body: req.body,
      params: req.params,
      query: req.query,
    });

    logger.error({
      ...context,
      event: "PAYMENT_INITIATE_ERROR",
      error: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });

    return res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "production" ? undefined : err.message,
    });
  }
};
