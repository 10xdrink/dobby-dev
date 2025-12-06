const Payment = require("../models/Payment");
const PaymentGateway = require("../models/PaymentGateway");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const OrderService = require("../services/orderService");
const Product = require("../models/productModel");
const AbandonedCart = require("../models/AbandonedCart");
const shipmentQueue = require("../queues/shipmentQueue");
const ShiprocketApiService = require("../services/shiprocketApiService");
const FedexIntegration = require("../models/FedxIntegration");
const UpsIntegration = require("../models/UpsIntegration");
const crypto = require("crypto");
const Stripe = require("stripe");
const paypal = require("@paypal/checkout-server-sdk");
const logger = require("../config/logger");
const mongoose = require("mongoose");

exports.stripeWebhook = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "webhookController.stripeWebhook", requestId };

  logger.info({
    ...context,
    event: "STRIPE_WEBHOOK_RECEIVED",
    headers: {
      "stripe-signature": req.headers["stripe-signature"]
        ? "present"
        : "missing",
    },
  });

  try {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
      logger.error({
        ...context,
        event: "STRIPE_SIGNATURE_MISSING",
      });
      return res.status(400).send("Missing stripe-signature header");
    }

    const cfg = await PaymentGateway.findOne({ name: "stripe" });
    if (!cfg || !cfg.credentials?.apiKey || !cfg.credentials?.webhookSecret) {
      logger.error({
        ...context,
        event: "STRIPE_CONFIG_MISSING",
        hasConfig: !!cfg,
        hasApiKey: !!cfg?.credentials?.apiKey,
        hasWebhookSecret: !!cfg?.credentials?.webhookSecret,
      });
      return res.status(500).send("Stripe configuration missing");
    }

    const stripeClient = Stripe(cfg.credentials.apiKey);
    let event;

    try {
      event = stripeClient.webhooks.constructEvent(
        req.rawBody,
        sig,
        cfg.credentials.webhookSecret
      );
      logger.debug({
        ...context,
        event: "STRIPE_WEBHOOK_VERIFIED",
        eventType: event.type,
        eventId: event.id,
      });
    } catch (err) {
      logger.error({
        ...context,
        event: "STRIPE_SIGNATURE_MISMATCH",
        error: err.message,
        stack: err.stack,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object;
      const metadata = pi.metadata || {};
      const paymentId = metadata.paymentId;

      logger.info({
        ...context,
        event: "STRIPE_PAYMENT_SUCCEEDED",
        paymentIntentId: pi.id,
        paymentId,
        amount: pi.amount_received,
      });

      if (!paymentId) {
        logger.error({
          ...context,
          event: "STRIPE_PAYMENT_ID_MISSING",
          metadata,
        });
        return res.status(400).end();
      }

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        logger.error({
          ...context,
          event: "STRIPE_PAYMENT_NOT_FOUND",
          paymentId,
        });
        return res.status(404).end();
      }

      const receivedAmount = Math.round(pi.amount_received / 100);
      const expectedAmount = Math.round(payment.amount);
      if (receivedAmount !== expectedAmount) {
        logger.error({
          ...context,
          event: "STRIPE_AMOUNT_MISMATCH",
          paymentId: payment._id,
          receivedAmount,
          expectedAmount,
        });
        return res.status(400).end();
      }

      if (payment.status === "paid") {
        logger.info({
          ...context,
          event: "STRIPE_PAYMENT_ALREADY_PROCESSED",
          paymentId: payment._id,
        });
        return res.status(200).end();
      }

      // Update payment
      payment.status = "paid";
      payment.gatewayPaymentId = pi.id;
      payment.paidAt = new Date();
      await payment.save();

      logger.info({
        ...context,
        event: "STRIPE_PAYMENT_MARKED_PAID",
        paymentId: payment._id,
        gatewayPaymentId: pi.id,
        amount: payment.amount,
      });

      if (payment.type === "order") {
        try {
          logger.info({
            ...context,
            event: "STRIPE_ORDER_FINALIZE_START",
            paymentId: payment._id,
            customerId: payment.customer,
          });

          const items = payment.metadata?.items || [];
          const subtotal = items.reduce(
            (s, i) => s + (i.price || 0) * (i.quantity || 0),
            0
          );
          const shipping = items.reduce((s, i) => s + (i.shippingCost || 0), 0);

          if (!items || items.length === 0) {
            logger.error({
              ...context,
              event: "STRIPE_ORDER_NO_ITEMS",
              paymentId: payment._id,
            });
            throw new Error("No items in payment metadata");
          }

          await OrderService._finalizeOrder({
            customerId: payment.customer,
            addressId: payment.metadata?.addressId,
            notes: payment.metadata?.notes,
            items,
            subtotal,
            shipping,
            total: payment.amount,
            paymentId: payment._id,
            sessionId: payment.metadata?.sessionId,
            requestId,
            couponId: payment.metadata?.couponId,
            couponDiscount: payment.metadata?.couponDiscount || 0,
          });

          logger.info({
            ...context,
            event: "STRIPE_ORDER_FINALIZED",
            paymentId: payment._id,
          });
        } catch (error) {
          logger.error({
            ...context,
            event: "STRIPE_ORDER_FINALIZE_FAILED",
            paymentId: payment._id,
            error: error.message,
            stack: error.stack,
          });
          // Don't return error - webhook already processed payment
        }
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object;
      const paymentId = pi.metadata?.paymentId;

      logger.info({
        ...context,
        event: "STRIPE_PAYMENT_FAILED",
        paymentIntentId: pi.id,
        paymentId,
      });

      if (paymentId) {
        const payment = await Payment.findById(paymentId);
        if (payment) {
          if (payment.status !== "failed") {
            payment.status = "failed";
            await payment.save();
            logger.info({
              ...context,
              event: "STRIPE_PAYMENT_MARKED_FAILED",
              paymentId: payment._id,
            });
          } else {
            logger.debug({
              ...context,
              event: "STRIPE_PAYMENT_ALREADY_FAILED",
              paymentId: payment._id,
            });
          }
        } else {
          logger.warn({
            ...context,
            event: "STRIPE_PAYMENT_NOT_FOUND_FOR_FAILURE",
            paymentId,
          });
        }
      } else {
        logger.warn({
          ...context,
          event: "STRIPE_PAYMENT_ID_MISSING_IN_FAILURE",
          metadata: pi.metadata,
        });
      }
    }

    // Handle payment cancellation when user exits/closes payment modal
    if (event.type === "payment_intent.canceled") {
      const pi = event.data.object;
      const paymentId = pi.metadata?.paymentId;

      logger.info({
        ...context,
        event: "STRIPE_PAYMENT_CANCELED",
        paymentIntentId: pi.id,
        paymentId,
      });

      if (paymentId) {
        const payment = await Payment.findById(paymentId);
        if (payment) {
          if (payment.status === "pending" || payment.status === "verifying") {
            payment.status = "cancelled";
            await payment.save();
            logger.info({
              ...context,
              event: "STRIPE_PAYMENT_MARKED_CANCELLED",
              paymentId: payment._id,
            });
          } else {
            logger.debug({
              ...context,
              event: "STRIPE_PAYMENT_ALREADY_PROCESSED",
              paymentId: payment._id,
              currentStatus: payment.status,
            });
          }
        } else {
          logger.warn({
            ...context,
            event: "STRIPE_PAYMENT_NOT_FOUND_FOR_CANCELLATION",
            paymentId,
          });
        }
      } else {
        logger.warn({
          ...context,
          event: "STRIPE_PAYMENT_ID_MISSING_IN_CANCELLATION",
          metadata: pi.metadata,
        });
      }
    }

    logger.info({
      ...context,
      event: "STRIPE_WEBHOOK_PROCESSED",
      eventType: event.type,
    });

    res.json({ received: true });
  } catch (err) {
    logger.error({
      ...context,
      event: "STRIPE_WEBHOOK_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).end();
  }
};

// FIXED VERSION - Replace your razorpayWebhook function with this

exports.razorpayWebhook = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "webhookController.razorpayWebhook", requestId };

  logger.info({
    ...context,
    event: "RAZORPAY_WEBHOOK_RECEIVED",
    headers: {
      "x-razorpay-signature": req.headers["x-razorpay-signature"]
        ? "present"
        : "missing",
    },
  });

  try {
    const body = req.rawBody;
    const sig = req.headers["x-razorpay-signature"];

    if (!sig) {
      logger.error({
        ...context,
        event: "RAZORPAY_SIGNATURE_MISSING",
      });
      return res.status(400).send("Missing x-razorpay-signature header");
    }

    const cfg = await PaymentGateway.findOne({ name: "razorpay" });
    if (!cfg || !cfg.credentials?.webhookSecret) {
      logger.error({
        ...context,
        event: "RAZORPAY_CONFIG_MISSING",
        hasConfig: !!cfg,
        hasWebhookSecret: !!cfg?.credentials?.webhookSecret,
      });
      return res.status(500).send("Razorpay configuration missing");
    }

    const secret = cfg.credentials.webhookSecret;
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSig !== sig) {
      logger.error({
        ...context,
        event: "RAZORPAY_SIGNATURE_MISMATCH",
        expectedSig: expectedSig.substring(0, 10) + "...",
        receivedSig: sig.substring(0, 10) + "...",
      });
      return res.status(400).send("Invalid signature");
    }

    const payload = JSON.parse(body);
    const event = payload.event;

    logger.debug({
      ...context,
      event: "RAZORPAY_WEBHOOK_VERIFIED",
      eventType: event,
    });

    if (event === "payment.captured") {
      const entity = payload.payload?.payment?.entity;
      if (!entity) {
        logger.error({
          ...context,
          event: "RAZORPAY_ENTITY_MISSING",
          payload: JSON.stringify(payload).substring(0, 200),
        });
        return res.status(400).end();
      }

      const gatewayOrderId = entity.order_id;
      logger.info({
        ...context,
        event: "RAZORPAY_PAYMENT_CAPTURED",
        gatewayOrderId,
        paymentId: entity.id,
        amount: entity.amount,
      });

      const payment = await Payment.findOne({
        gatewayOrderId: gatewayOrderId,
      });

      if (!payment) {
        logger.error({
          ...context,
          event: "RAZORPAY_PAYMENT_NOT_FOUND",
          gatewayOrderId,
        });
        return res.status(404).end();
      }

      const receivedAmount = Number(entity.amount / 100);
      const expectedAmount = Number(payment.amount);
      if (receivedAmount !== expectedAmount) {
        logger.error({
          ...context,
          event: "RAZORPAY_AMOUNT_MISMATCH",
          paymentId: payment._id,
          receivedAmount,
          expectedAmount,
        });
        return res.status(400).end();
      }

      if (payment.status === "paid") {
        logger.info({
          ...context,
          event: "RAZORPAY_PAYMENT_ALREADY_PROCESSED",
          paymentId: payment._id,
        });
        return res.status(200).end();
      }

      // Update payment FIRST
      payment.status = "paid";
      payment.gatewayPaymentId = entity.id;
      payment.paidAt = new Date();
      await payment.save();

      logger.info({
        ...context,
        event: "RAZORPAY_PAYMENT_MARKED_PAID",
        paymentId: payment._id,
        gatewayPaymentId: entity.id,
        amount: payment.amount,
      });

      // CRITICAL FIX: Check if order type and finalize
      if (payment.type === "order") {
        try {
          logger.info({
            ...context,
            event: "RAZORPAY_ORDER_FINALIZE_START",
            paymentId: payment._id,
            customerId: payment.customer,
            metadata: payment.metadata,
          });

          const items = payment.metadata?.items || [];

          // CRITICAL: Validate items exist
          if (!items || items.length === 0) {
            logger.error({
              ...context,
              event: "RAZORPAY_ORDER_NO_ITEMS",
              paymentId: payment._id,
              metadata: payment.metadata,
            });
            throw new Error("No items in payment metadata");
          }

          const subtotal = items.reduce(
            (s, i) => s + (i.price || 0) * (i.quantity || 0),
            0
          );
          const shipping = items.reduce((s, i) => s + (i.shippingCost || 0), 0);

          logger.debug({
            ...context,
            event: "RAZORPAY_ORDER_CALCULATION",
            itemCount: items.length,
            subtotal,
            shipping,
            total: payment.amount,
          });

          // Call _finalizeOrder with proper error handling
          const order = await OrderService._finalizeOrder({
            customerId: payment.customer,
            addressId: payment.metadata?.addressId,
            notes: payment.metadata?.notes,
            items,
            subtotal,
            shipping,
            total: payment.amount,
            paymentId: payment._id,
            sessionId: payment.metadata?.sessionId,
            requestId,
            couponId: payment.metadata?.couponId,
            couponDiscount: payment.metadata?.couponDiscount || 0,
          });

          // CRITICAL: Update payment with order reference
          payment.order = order._id;
          await payment.save();

          logger.info({
            ...context,
            event: "RAZORPAY_ORDER_FINALIZED",
            paymentId: payment._id,
            orderId: order._id,
            orderNumber: order.orderNumber,
          });
        } catch (error) {
          logger.error({
            ...context,
            event: "RAZORPAY_ORDER_FINALIZE_FAILED",
            paymentId: payment._id,
            error: error.message,
            stack: error.stack,
          });

          // IMPORTANT: Don't return 500 - webhook was processed successfully
          // The payment is marked as paid, order creation failure is a separate issue
          // that can be retried manually or via admin panel
        }
      }
    }

    if (event === "payment.failed") {
      const entity = payload.payload?.payment?.entity;
      if (entity) {
        const gatewayOrderId = entity.order_id;
        logger.info({
          ...context,
          event: "RAZORPAY_PAYMENT_FAILED",
          gatewayOrderId,
          paymentId: entity.id,
        });

        const payment = await Payment.findOne({
          gatewayOrderId: gatewayOrderId,
        });

        if (payment) {
          if (payment.status !== "failed") {
            payment.status = "failed";
            await payment.save();
            logger.info({
              ...context,
              event: "RAZORPAY_PAYMENT_MARKED_FAILED",
              paymentId: payment._id,
            });
          } else {
            logger.debug({
              ...context,
              event: "RAZORPAY_PAYMENT_ALREADY_FAILED",
              paymentId: payment._id,
            });
          }
        } else {
          logger.warn({
            ...context,
            event: "RAZORPAY_PAYMENT_NOT_FOUND_FOR_FAILURE",
            gatewayOrderId,
          });
        }
      } else {
        logger.warn({
          ...context,
          event: "RAZORPAY_ENTITY_MISSING_IN_FAILURE",
        });
      }
    }

    // Handle order cancellation when user exits/closes Razorpay checkout
    // Razorpay sends order.paid event with close_reason: "opt_out" when user exits
    if (event === "order.paid") {
      const orderEntity = payload.payload?.order?.entity;
      if (orderEntity) {
        const closeReason = orderEntity.close_reason;
        const gatewayOrderId = orderEntity.id;
        
        // Log the full payload structure for debugging
        logger.debug({
          ...context,
          event: "RAZORPAY_ORDER_PAID_EVENT",
          gatewayOrderId,
          closeReason,
          orderStatus: orderEntity.status,
          amountPaid: orderEntity.amount_paid,
        });
        
        // Check if user exited without paying (opt_out or user_exit)
        // Also check if order status indicates cancellation
        if (
          closeReason === "opt_out" || 
          closeReason === "user_exit" ||
          (orderEntity.status === "attempted" && !orderEntity.amount_paid)
        ) {
          logger.info({
            ...context,
            event: "RAZORPAY_ORDER_CANCELLED_BY_USER",
            gatewayOrderId,
            closeReason,
            orderStatus: orderEntity.status,
          });

          const payment = await Payment.findOne({
            gatewayOrderId: gatewayOrderId,
          });

          if (payment) {
            // Only cancel if payment hasn't been processed yet
            if (payment.status === "pending" || payment.status === "verifying") {
              payment.status = "cancelled";
              await payment.save();
              logger.info({
                ...context,
                event: "RAZORPAY_PAYMENT_MARKED_CANCELLED",
                paymentId: payment._id,
                closeReason,
                previousStatus: payment.status,
              });
            } else {
              logger.debug({
                ...context,
                event: "RAZORPAY_PAYMENT_ALREADY_PROCESSED",
                paymentId: payment._id,
                currentStatus: payment.status,
              });
            }
          } else {
            logger.warn({
              ...context,
              event: "RAZORPAY_PAYMENT_NOT_FOUND_FOR_CANCELLATION",
              gatewayOrderId,
            });
          }
        }
      }
    }

    logger.info({
      ...context,
      event: "RAZORPAY_WEBHOOK_PROCESSED",
      eventType: event,
    });

    res.json({ status: "ok" });
  } catch (err) {
    logger.error({
      ...context,
      event: "RAZORPAY_WEBHOOK_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).end();
  }
};

exports.paypalWebhook = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "webhookController.paypalWebhook", requestId };

  logger.info({
    ...context,
    event: "PAYPAL_WEBHOOK_RECEIVED",
    eventType: req.body?.event_type,
  });

  try {
    const body = req.body;
    const headers = req.headers;

    if (!body || !body.event_type) {
      logger.error({
        ...context,
        event: "PAYPAL_INVALID_BODY",
      });
      return res.status(400).send("Invalid webhook body");
    }

    const cfg = await PaymentGateway.findOne({
      name: "paypal",
      isActive: true,
    });
    if (
      !cfg ||
      !cfg.credentials?.clientId ||
      !cfg.credentials?.clientSecret ||
      !cfg.credentials?.webhookId
    ) {
      logger.error({
        ...context,
        event: "PAYPAL_CONFIG_MISSING",
        hasConfig: !!cfg,
        hasClientId: !!cfg?.credentials?.clientId,
        hasClientSecret: !!cfg?.credentials?.clientSecret,
        hasWebhookId: !!cfg?.credentials?.webhookId,
      });
      return res.status(500).send("PayPal config missing");
    }

    const environment = new paypal.core.SandboxEnvironment(
      cfg.credentials.clientId,
      cfg.credentials.clientSecret
    );
    const client = new paypal.core.PayPalHttpClient(environment);

    const verifyRequest =
      new paypal.notifications.VerifyWebhookSignatureRequest();
    verifyRequest.requestBody({
      auth_algo: headers["paypal-auth-algo"],
      cert_url: headers["paypal-cert-url"],
      transmission_id: headers["paypal-transmission-id"],
      transmission_sig: headers["paypal-transmission-sig"],
      transmission_time: headers["paypal-transmission-time"],
      webhook_id: cfg.credentials.webhookId,
      webhook_event: body,
    });

    let response;
    try {
      response = await client.execute(verifyRequest);
      if (response.result.verification_status !== "SUCCESS") {
        logger.error({
          ...context,
          event: "PAYPAL_SIGNATURE_VERIFICATION_FAILED",
          verificationStatus: response.result.verification_status,
        });
        return res.status(400).send("Invalid PayPal webhook signature");
      }
      logger.debug({
        ...context,
        event: "PAYPAL_WEBHOOK_VERIFIED",
        verificationStatus: response.result.verification_status,
      });
    } catch (verifyErr) {
      logger.error({
        ...context,
        event: "PAYPAL_VERIFICATION_ERROR",
        error: verifyErr.message,
        stack: verifyErr.stack,
      });
      return res.status(400).send("PayPal webhook verification failed");
    }

    const event = body.event_type;
    const resource = body.resource;

    logger.debug({
      ...context,
      event: "PAYPAL_EVENT_PARSED",
      eventType: event,
      resourceId: resource?.id,
    });

    if (event === "PAYMENT.CAPTURE.COMPLETED") {
      logger.info({
        ...context,
        event: "PAYPAL_PAYMENT_CAPTURED",
        resourceId: resource?.id,
        amount: resource?.amount?.value,
      });

      if (!resource) {
        logger.error({
          ...context,
          event: "PAYPAL_RESOURCE_MISSING",
        });
        return res.status(400).end();
      }

      // Try multiple ways to find the payment
      let payment = null;
      const lookupMethods = [];

      // First try: gatewayOrderId from supplementary_data (most reliable)
      if (resource.supplementary_data?.related_ids?.order_id) {
        const orderId = resource.supplementary_data.related_ids.order_id;
        payment = await Payment.findOne({
          gatewayOrderId: orderId,
        });
        if (payment) lookupMethods.push("supplementary_data.order_id");
      }

      // Second try: custom_id from purchase_units (payment ID we set)
      if (!payment && resource.purchase_units?.[0]?.custom_id) {
        const customId = resource.purchase_units[0].custom_id;
        payment = await Payment.findById(customId);
        if (payment) lookupMethods.push("purchase_units.custom_id");
      }

      // Third try: metadata orderId (fallback for legacy payments)
      if (!payment && resource.invoice_id) {
        payment = await Payment.findOne({
          "metadata.orderId": resource.invoice_id,
        });
        if (payment) lookupMethods.push("metadata.orderId");
      }

      if (!payment) {
        logger.error({
          ...context,
          event: "PAYPAL_PAYMENT_NOT_FOUND",
          resourceId: resource.id,
          orderId: resource.supplementary_data?.related_ids?.order_id,
          customId: resource.purchase_units?.[0]?.custom_id,
          invoiceId: resource.invoice_id,
        });
        return res.status(404).end();
      }

      logger.debug({
        ...context,
        event: "PAYPAL_PAYMENT_FOUND",
        paymentId: payment._id,
        lookupMethods,
      });

      const receivedAmount = Number(resource.amount?.value);
      const expectedAmount = Number(payment.amount);
      if (receivedAmount !== expectedAmount) {
        logger.error({
          ...context,
          event: "PAYPAL_AMOUNT_MISMATCH",
          paymentId: payment._id,
          receivedAmount,
          expectedAmount,
        });
        return res.status(400).end();
      }

      if (payment.status === "paid") {
        logger.info({
          ...context,
          event: "PAYPAL_PAYMENT_ALREADY_PROCESSED",
          paymentId: payment._id,
        });
        return res.status(200).end();
      }

      payment.status = "paid";
      payment.gatewayPaymentId = resource.id;
      payment.paidAt = new Date();
      await payment.save();

      logger.info({
        ...context,
        event: "PAYPAL_PAYMENT_MARKED_PAID",
        paymentId: payment._id,
        gatewayPaymentId: resource.id,
        amount: payment.amount,
      });

      if (payment.type === "order") {
        try {
          logger.info({
            ...context,
            event: "PAYPAL_ORDER_FINALIZE_START",
            paymentId: payment._id,
            customerId: payment.customer,
          });

          const items = payment.metadata?.items || [];
          const subtotal = items.reduce(
            (s, i) => s + (i.price || 0) * (i.quantity || 0),
            0
          );
          const shipping = items.reduce((s, i) => s + (i.shippingCost || 0), 0);

          if (!items || items.length === 0) {
            logger.error({
              ...context,
              event: "PAYPAL_ORDER_NO_ITEMS",
              paymentId: payment._id,
            });
            throw new Error("No items in payment metadata");
          }

          await OrderService._finalizeOrder({
            customerId: payment.customer,
            addressId: payment.metadata?.addressId,
            notes: payment.metadata?.notes,
            items,
            subtotal,
            shipping,
            total: payment.amount,
            paymentId: payment._id,
            sessionId: payment.metadata?.sessionId,
            requestId,
            couponId: payment.metadata?.couponId,
            couponDiscount: payment.metadata?.couponDiscount || 0,
          });

          logger.info({
            ...context,
            event: "PAYPAL_ORDER_FINALIZED",
            paymentId: payment._id,
          });
        } catch (error) {
          logger.error({
            ...context,
            event: "PAYPAL_ORDER_FINALIZE_FAILED",
            paymentId: payment._id,
            error: error.message,
            stack: error.stack,
          });
          // Don't return error - webhook already processed payment
        }
      }
    }

    if (
      event === "PAYMENT.CAPTURE.DENIED" ||
      event === "PAYMENT.CAPTURE.REFUNDED"
    ) {
      logger.info({
        ...context,
        event: "PAYPAL_PAYMENT_DENIED_OR_REFUNDED",
        eventType: event,
        resourceId: resource?.id,
      });

      if (resource?.id) {
        const payment = await Payment.findOne({
          gatewayPaymentId: resource.id,
        });
        if (payment) {
          if (payment.status !== "failed") {
            payment.status = "failed";
            await payment.save();
            logger.info({
              ...context,
              event: "PAYPAL_PAYMENT_MARKED_FAILED",
              paymentId: payment._id,
              reason: event,
            });
          } else {
            logger.debug({
              ...context,
              event: "PAYPAL_PAYMENT_ALREADY_FAILED",
              paymentId: payment._id,
            });
          }
        } else {
          logger.warn({
            ...context,
            event: "PAYPAL_PAYMENT_NOT_FOUND_FOR_FAILURE",
            gatewayPaymentId: resource.id,
          });
        }
      } else {
        logger.warn({
          ...context,
          event: "PAYPAL_RESOURCE_ID_MISSING_IN_FAILURE",
        });
      }
    }

    // Handle order cancellation when user clicks cancel in PayPal checkout
    if (event === "CHECKOUT.ORDER.CANCELLED") {
      logger.info({
        ...context,
        event: "PAYPAL_ORDER_CANCELLED_BY_USER",
        resourceId: resource?.id,
      });

      // Try multiple ways to find the payment
      let payment = null;

      // First try: gatewayOrderId from resource.id
      if (resource?.id) {
        payment = await Payment.findOne({
          gatewayOrderId: resource.id,
        });
      }

      // Second try: custom_id from purchase_units
      if (!payment && resource?.purchase_units?.[0]?.custom_id) {
        const customId = resource.purchase_units[0].custom_id;
        payment = await Payment.findById(customId);
      }

      if (payment) {
        if (payment.status === "pending" || payment.status === "verifying") {
          payment.status = "cancelled";
          await payment.save();
          logger.info({
            ...context,
            event: "PAYPAL_PAYMENT_MARKED_CANCELLED",
            paymentId: payment._id,
          });
        } else {
          logger.debug({
            ...context,
            event: "PAYPAL_PAYMENT_ALREADY_PROCESSED",
            paymentId: payment._id,
            currentStatus: payment.status,
          });
        }
      } else {
        logger.warn({
          ...context,
          event: "PAYPAL_PAYMENT_NOT_FOUND_FOR_CANCELLATION",
          resourceId: resource?.id,
        });
      }
    }

    logger.info({
      ...context,
      event: "PAYPAL_WEBHOOK_PROCESSED",
      eventType: event,
    });

    res.json({ status: "ok" });
  } catch (err) {
    logger.error({
      ...context,
      event: "PAYPAL_WEBHOOK_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).end();
  }
};
