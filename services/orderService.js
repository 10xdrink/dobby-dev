const Cart = require("../models/Cart");
const mongoose = require("mongoose");
const AddressService = require("../services/addressService");
const ShiprocketApiService = require("../services/shiprocketApiService");
const taxService = require("../services/taxService");
const shippingCalculator = require("../services/shippingCalculator");
const customerGroupingService = require("../services/customergroupingService");
const pricingRuleService = require("../services/pricingruleService");
const cartService = require("../services/cartService");
const FedexIntegration = require("../models/FedxIntegration");
const UpsIntegration = require("../models/UpsIntegration");
const { sendOrderPlacementEmail } = require("../utils/orderemailTemplate");
const { sendOrderNotificationsToShopkeepers } = require("../utils/shopkeeperordermailTemplate");
const Customer = require("../models/Customer");
const AbandonedCart = require("../models/AbandonedCart");
const FlashSale = require("../models/FlashSale");
const Coupon = require("../models/Coupon");
const Order = require("../models/Order");
const Product = require("../models/productModel");
const Payment = require("../models/Payment");
const crypto = require("crypto");
const Address = require("../models/Address");
const shipmentQueue = require("../queues/shipmentQueue");
const PaymentGateway = require("../models/PaymentGateway");
const PaymentSettings = require("../models/PaymentSettings");
const logger = require("../config/logger");
const { createAndEmitNotification } = require("../helpers/notification");
const Shop = require("../models/Shop");
const User = require("../models/User");

class OrderService {
  async createOrder({ user, body, req }) {
    const requestId = req?.requestId || crypto.randomBytes(8).toString("hex");
    const context = { route: "OrderService.createOrder", requestId };

    logger.info({
      ...context,
      event: "ORDER_CREATE_START",
      userId: user?._id,
      customerId: user?._id,
      body: { ...body, paymentGateway: body.paymentGateway },
    });

    const customerId = user?._id || null;
    // Accept both paymentMethod and paymentGateway for compatibility
    const { addressId, paymentMethod, paymentGateway, sessionId, notes } = body;
    const selectedPaymentMethod = paymentMethod || paymentGateway;

    try {
      if (!addressId) {
        logger.error({
          ...context,
          event: "ORDER_CREATE_VALIDATION_FAILED",
          error: "Delivery address required",
          addressId,
        });
        throw new Error("Delivery address required");
      }
      if (!selectedPaymentMethod) {
        logger.error({
          ...context,
          event: "ORDER_CREATE_VALIDATION_FAILED",
          error: "Payment method required",
          paymentMethod: selectedPaymentMethod,
        });
        throw new Error("Payment method required");
      }

      // Check payment settings
      const paymentSettings = await PaymentSettings.getSettings();
      
      // Check COD enabled
      if (selectedPaymentMethod === "cod") {
        if (!paymentSettings.cashOnDeliveryEnabled) {
          logger.error({
            ...context,
            event: "ORDER_CREATE_COD_DISABLED",
            paymentMethod: selectedPaymentMethod,
          });
          throw new Error("Cash on Delivery is currently disabled");
        }
      } else {
        // Check digital payment enabled for all digital gateways
        if (!paymentSettings.digitalPaymentEnabled) {
          logger.error({
            ...context,
            event: "ORDER_CREATE_DIGITAL_PAYMENT_DISABLED",
            paymentMethod: selectedPaymentMethod,
          });
          throw new Error("Digital payment methods are currently disabled");
        }
      }

      // Merge guest addresses
      if (sessionId && customerId) {
        try {
          await AddressService.mergeGuestAddresses({
            user,
            query: { sessionId },
          });
          logger.info({
            ...context,
            event: "MERGE_GUEST_ADDRESS_DONE",
            sessionId,
          });
        } catch (mergeErr) {
          logger.warn({
            ...context,
            event: "MERGE_GUEST_ADDRESS_FAILED",
            error: mergeErr.message,
            sessionId,
          });
          // Continue even if merge fails
        }
      }

      const address = await Address.findById(addressId);
      if (!address) {
        logger.error({
          ...context,
          event: "ADDRESS_NOT_FOUND",
          addressId,
        });
        throw new Error("Address not found");
      }

      if (address.customer?.toString() !== customerId?.toString()) {
        logger.error({
          ...context,
          event: "UNAUTHORIZED_ADDRESS_ACCESS",
          addressId,
          addressCustomer: address.customer?.toString(),
          requestCustomer: customerId?.toString(),
        });
        throw new Error("Unauthorized address access");
      }

      logger.debug({
        ...context,
        event: "ADDRESS_VALIDATED",
        addressId,
      });

      // Merge session cart into customer cart
      if (sessionId && customerId) {
        try {
          const sessionCart = await Cart.findOne({ sessionId });
          let customerCart = await Cart.findOne({ customer: customerId });

          if (sessionCart) {
            logger.info({
              ...context,
              event: "SESSION_CART_FOUND",
              sessionId,
              itemCount: sessionCart.items.length,
            });

            if (!customerCart) {
              sessionCart.customer = customerId;
              sessionCart.sessionId = null;
              await sessionCart.save();
              customerCart = sessionCart;
              logger.info({
                ...context,
                event: "SESSION_CART_CONVERTED_TO_CUSTOMER",
                sessionId,
              });
            } else {
              let mergedCount = 0;
              for (let item of sessionCart.items) {
                const existing = customerCart.items.find(
                  (i) => i.product.toString() === item.product.toString()
                );
                if (existing) {
                  existing.quantity += item.quantity;
                  mergedCount++;
                } else {
                  customerCart.items.push(item);
                }
              }
              await customerCart.save();
              await sessionCart.remove();
              logger.info({
                ...context,
                event: "SESSION_CART_MERGED",
                sessionId,
                mergedItems: mergedCount,
                newItems: sessionCart.items.length - mergedCount,
              });
            }
          }
        } catch (mergeErr) {
          logger.error({
            ...context,
            event: "CART_MERGE_FAILED",
            error: mergeErr.message,
            sessionId,
          });
          // Continue - cart merge failure shouldn't block order
        }
      }

      const cart = await Cart.findOne({ customer: customerId })
        .populate("items.product")
        .populate({
          path: "items.product",
          populate: { path: "shop", select: "shopName status" },
        });
      if (!cart) {
        logger.error({
          ...context,
          event: "CART_NOT_FOUND",
          customerId,
        });
        throw new Error("Cart not found");
      }
      if (!cart.items || cart.items.length === 0) {
        logger.error({
          ...context,
          event: "CART_EMPTY",
          customerId,
          cartId: cart._id,
        });
        throw new Error("Cart is empty");
      }

      logger.info({
        ...context,
        event: "CART_LOADED",
        customerId,
        itemCount: cart.items.length,
      });

      // Validate applied coupon
      let appliedCoupon = null;
      let couponDiscount = 0;

      if (cart.appliedCoupon && cart.appliedCoupon.couponId) {
        logger.info({
          ...context,
          event: "COUPON_VALIDATION_START",
          couponId: cart.appliedCoupon.couponId,
          couponCode: cart.appliedCoupon.code,
        });

        const coupon = await Coupon.findById(cart.appliedCoupon.couponId);

        if (!coupon) {
          logger.warn({
            ...context,
            event: "COUPON_NOT_FOUND",
            couponId: cart.appliedCoupon.couponId,
          });
          cart.appliedCoupon = null;
          await cart.save();
        } else {
          const now = new Date();

          if (coupon.status !== "active") {
            logger.warn({
              ...context,
              event: "COUPON_INACTIVE",
              couponId: coupon._id,
            });
            cart.appliedCoupon = null;
            await cart.save();
            throw new Error("Coupon is no longer active");
          }

          if (now < coupon.startDate || now > coupon.endDate) {
            logger.warn({
              ...context,
              event: "COUPON_EXPIRED",
              couponId: coupon._id,
            });
            cart.appliedCoupon = null;
            await cart.save();
            throw new Error("Coupon has expired");
          }

          const alreadyUsed = coupon.usedBy.some(
            (usage) => usage.customer.toString() === customerId.toString()
          );

          if (alreadyUsed) {
            logger.warn({
              ...context,
              event: "COUPON_ALREADY_USED",
              couponId: coupon._id,
              customerId,
            });
            cart.appliedCoupon = null;
            await cart.save();
            throw new Error("You have already used this coupon");
          }

          appliedCoupon = coupon;

          // Verify cart has items from coupon shop
          const hasItemsFromCouponShop = cart.items.some(
            (item) => item.product.shop?.toString() === coupon.shop.toString()
          );
          if (!hasItemsFromCouponShop) {
            logger.warn({
              ...context,
              event: "COUPON_NO_MATCHING_SHOP_ITEMS",
              couponId: coupon._id,
              couponShop: coupon.shop.toString(),
            });
            // Clear invalid coupon silently and continue with order
            cart.appliedCoupon = null;
            appliedCoupon = null;
            await cart.save();
          }

          logger.info({
            ...context,
            event: "COUPON_VALIDATED",
            couponId: coupon._id,
          });
        }
      }

      // IMPORTANT: Recalculate cart with correct enterprise flow
      // (Product Discount → Best of Flash/PricingRule → Coupon → Tax → Shipping)
      // Pass addressId to ensure tax is calculated for the selected delivery address
      await cartService._recalculateCart(cart, { addressId });

      couponDiscount = cart.couponDiscount || 0;

      logger.info({
        ...context,
        event: "CART_RECALCULATED",
        totalAmount: cart.totalAmount,
        couponDiscount,
        shipping: cart.shippingAmount,
        grandTotal: cart.grandTotal,
      });

      // Use pre-calculated cart items (already has correct discount/tax flow)
      if (!cart.itemsWithTax || cart.itemsWithTax.length === 0) {
        logger.error({
          ...context,
          event: "CART_ITEMS_WITH_TAX_MISSING",
          cartId: cart._id,
        });
        throw new Error("Cart calculation failed");
      }

      let subtotal = 0;
      const items = [];
      const validationErrors = [];

      //  Cart service already calculated everything with proper enterprise flow
      for (let idx = 0; idx < cart.items.length; idx++) {
        const cartItem = cart.items[idx];
        const itemWithTax = cart.itemsWithTax[idx];

        try {
          // === VALIDATIONS ONLY (no calculations) ===
          if (!cartItem.product) {
            validationErrors.push(
              `Product missing for cart item ${cartItem._id}`
            );
            logger.error({
              ...context,
              event: "CART_ITEM_PRODUCT_MISSING",
              cartItemId: cartItem._id,
            });
            continue;
          }

          if (cartItem.product.status !== "active") {
            validationErrors.push(
              `Product inactive: ${
                cartItem.product.productName || cartItem.product._id
              }`
            );
            logger.warn({
              ...context,
              event: "PRODUCT_INACTIVE_IN_CART",
              productId: cartItem.product._id,
              productName: cartItem.product.productName,
            });
            continue;
          }

          if (!cartItem.product.shop) {
            validationErrors.push(
              `Product missing shop: ${
                cartItem.product.productName || cartItem.product._id
              }`
            );
            logger.error({
              ...context,
              event: "PRODUCT_SHOP_MISSING",
              productId: cartItem.product._id,
            });
            continue;
          }

          if (
            cartItem.product.shop.status &&
            cartItem.product.shop.status !== "active"
          ) {
            validationErrors.push(
              `Shop inactive for product: ${
                cartItem.product.productName || cartItem.product._id
              }`
            );
            logger.error({
              ...context,
              event: "PRODUCT_SHOP_INACTIVE",
              productId: cartItem.product._id,
              shopId: cartItem.product.shop._id || cartItem.product.shop,
            });
            continue;
          }

          // === COPY PRE-CALCULATED VALUES (no recalculation) ===
          // REASON: Cart service is single source of truth for all pricing

          subtotal += itemWithTax.lineTotal;

          // Build order item from cart's pre-calculated values
          items.push({
            product: cartItem.product._id,
            shop: cartItem.product.shop._id || cartItem.product.shop,
            name: cartItem.product.productName,
            sku: cartItem.product.sku,
            quantity: cartItem.quantity,

            // === Original price (no calculation) ===
            originalPrice: itemWithTax.originalPrice,

            // === Product discount (cart already handled upsell logic) ===
            productDiscountType: itemWithTax.productDiscountType || "none",
            productDiscountValue: itemWithTax.productDiscountValue || 0,
            productDiscountAmount: itemWithTax.productDiscount || 0,
            priceAfterProductDiscount: itemWithTax.priceAfterProductDiscount,

            // === Flash sale (cart chose best campaign) ===
            flashSale: itemWithTax.flashSale
              ? {
                  flashSaleId: itemWithTax.flashSale.id,
                  flashSaleName: itemWithTax.flashSale.name,
                  discountType: itemWithTax.flashSale.discountType,
                  discountValue: itemWithTax.flashSale.discountValue,
                  discountAmount: itemWithTax.flashSale.discountAmount,
                }
              : null,
            priceAfterFlashSale: itemWithTax.flashSale
              ? itemWithTax.priceAfterProductDiscount -
                itemWithTax.flashSaleDiscount
              : itemWithTax.priceAfterProductDiscount,

            // === Pricing rule (cart chose best campaign) ===
            pricingRule: itemWithTax.pricingRule
              ? {
                  ruleId: itemWithTax.pricingRule.ruleId,
                  ruleName: itemWithTax.pricingRule.ruleName,
                  discountType: itemWithTax.pricingRule.discountType,
                  discountValue: itemWithTax.pricingRule.discountValue,
                  discountAmount: itemWithTax.pricingRule.discountAmount,
                  customerGroup: itemWithTax.pricingRule.customerGroup,
                }
              : null,
            priceAfterPricingRule: itemWithTax.upsellCrossSell
              ? itemWithTax.priceAfterUpsell ||
                itemWithTax.priceAfterProductDiscount
              : itemWithTax.pricingRule
              ? itemWithTax.priceAfterProductDiscount -
                (itemWithTax.pricingRuleDiscount || 0)
              : itemWithTax.priceAfterProductDiscount,

            // === Upsell/Cross-sell (cart handled) ===
            upsellCrossSell: itemWithTax.upsellCrossSell
              ? {
                  ruleId: itemWithTax.upsellCrossSell.ruleId,
                  ruleName: itemWithTax.upsellCrossSell.ruleName,
                  ruleType: itemWithTax.upsellCrossSell.ruleType,
                  discountType: itemWithTax.upsellCrossSell.discountType,
                  discountValue: itemWithTax.upsellCrossSell.discountValue,
                  discountAmount: itemWithTax.upsellCrossSell.discountAmount,
                }
              : null,
            priceAfterUpsell: itemWithTax.priceAfterUpsell || null,

            // === Tax (cart calculated AFTER coupon) ===
            taxType: itemWithTax.taxType,
            taxRate: itemWithTax.taxRate,
            taxAmount: itemWithTax.taxAmount,
            region: itemWithTax.region,

            // === Final price (cart applied: product discount → best campaign → coupon → tax) ===
            finalUnitPrice: itemWithTax.priceWithTax,
            lineTotalBeforeCoupon: itemWithTax.lineTotal,

            // === Shipping ===
            shippingCost: cartItem.product.shippingCost || 0,
          });

          logger.debug({
            ...context,
            event: "ITEM_COPIED_FROM_CART",
            productId: cartItem.product._id,
            productName: cartItem.product.productName,
            quantity: cartItem.quantity,
            // Log to verify no recalculation
            copiedValues: {
              originalPrice: itemWithTax.originalPrice,
              productDiscount: itemWithTax.productDiscount || 0,
              flashSaleDiscount: itemWithTax.flashSaleDiscount || 0,
              pricingRuleDiscount: itemWithTax.pricingRuleDiscount || 0,
              upsellDiscount: itemWithTax.upsellDiscount || 0,
              couponDiscount: itemWithTax.couponDiscount || 0,
              taxAmount: itemWithTax.taxAmount,
              finalPrice: itemWithTax.priceWithTax,
              lineTotal: itemWithTax.lineTotal,
            },
          });
        } catch (itemErr) {
          logger.error({
            ...context,
            event: "ITEM_PROCESSING_ERROR",
            error: itemErr.message,
            stack: itemErr.stack,
            cartItemId: cartItem._id,
          });
          validationErrors.push(`Error processing item: ${itemErr.message}`);
        }
      }

      if (validationErrors.length > 0) {
        logger.error({
          ...context,
          event: "CART_VALIDATION_ERRORS",
          errors: validationErrors,
        });
        throw new Error(
          `Cart validation failed: ${validationErrors.join(", ")}`
        );
      }

      if (items.length === 0) {
        logger.error({
          ...context,
          event: "NO_VALID_ITEMS",
          customerId,
        });
        throw new Error("No valid items in cart");
      }

      logger.info({
        ...context,
        event: "CART_ITEMS_COPIED",
        itemCount: items.length,
        subtotal: cart.totalAmount,
      });

      // === USE PRE-CALCULATED TOTALS FROM CART ===
      const shipping = cart.shippingAmount || 0;
      subtotal = cart.totalAmount; // Already includes: discounts + tax (after coupon)
      const total = cart.grandTotal; // subtotal + shipping

      // Allocate shipping per item from cart's breakdown
      const shippingBreakdown = cart.shippingBreakdown || [];
      for (let i = 0; i < items.length; i++) {
        const shopId = items[i].shop?.toString();
        const shopBreakdown = shippingBreakdown.find(
          (sb) => sb.shop?.toString() === shopId
        );
        if (shopBreakdown) {
          const shopItemCount = items.filter(
            (item) => item.shop?.toString() === shopId
          ).length;
          items[i].allocatedShipping =
            shopBreakdown.shipping / shopItemCount || 0;
        } else {
          items[i].allocatedShipping = 0;
        }
      }

      if (total <= 0) {
        logger.error({
          ...context,
          event: "INVALID_ORDER_TOTAL",
          subtotal,
          shipping,
          total,
        });
        throw new Error("Order total must be greater than zero");
      }

      logger.info({
        ...context,
        event: "ORDER_TOTALS_FROM_CART",
        subtotal,
        couponDiscount,
        shipping,
        total,
        verification: "CART_VALUES_USED",
      });

      // For digital payment gateways, check both settings and gateway active status
      let gateway = null;
      if (selectedPaymentMethod !== "cod") {
        // Check if digital payment is enabled (already checked above, but double-check for safety)
        if (!paymentSettings.digitalPaymentEnabled) {
          logger.error({
            ...context,
            event: "DIGITAL_PAYMENT_DISABLED",
            paymentMethod: selectedPaymentMethod,
          });
          throw new Error("Digital payment methods are currently disabled");
        }
        
        // Check if specific gateway is active
        gateway = await PaymentGateway.findOne({
          name: selectedPaymentMethod,
          isActive: true,
        });
        if (!gateway) {
          logger.error({
            ...context,
            event: "INVALID_PAYMENT_GATEWAY",
            paymentMethod: selectedPaymentMethod,
          });
          throw new Error("Invalid or inactive payment gateway");
        }

        logger.debug({
          ...context,
          event: "PAYMENT_GATEWAY_FOUND",
          gateway: selectedPaymentMethod,
          gatewayId: gateway._id,
        });
      }

      if (selectedPaymentMethod === "cod") {
        logger.info({
          ...context,
          event: "COD_PAYMENT_INITIATED",
          total,
        });

        const payment = await Payment.create({
          customer: customerId,
          type: "order",
          amount: total,
          currency: "INR",
          gateway: "cod",
          status: "paid",
        });

        logger.info({
          ...context,
          event: "COD_PAYMENT_CREATED",
          paymentId: payment._id,
        });

        const order = await this._finalizeOrder({
          customerId,
          addressId,
          notes,
          items,
          subtotal,
          shipping,
          total,
          paymentId: payment._id,
          paymentMethod: "cod",
          sessionId,
          requestId,
          couponId: appliedCoupon?._id,
          couponDiscount,
        });

        logger.info({
          ...context,
          event: "COD_ORDER_FINALIZED",
          orderId: order._id,
          paymentId: payment._id,
        });

        return order;
      }

      

      const idempotencyKey = crypto.randomBytes(16).toString("hex");

      logger.info({
        ...context,
        event: "ONLINE_PAYMENT_INITIATING",
        gateway: selectedPaymentMethod,
        total,
        idempotencyKey,
      });

      const payment = await Payment.create({
        customer: customerId,
        type: "order",
        amount: total,
        currency: "INR",
        gateway: selectedPaymentMethod,
        status: "pending",
        idempotencyKey,
        metadata: {
          addressId,
          notes,
          items,
          sessionId,
          requestId,
          couponId: appliedCoupon?._id,
          couponCode: appliedCoupon?.code,
          couponDiscount,
          pricingRulesApplied: items
            .filter((item) => item.pricingRule)
            .map((item) => ({
              productId: item.product,
              ruleId: item.pricingRule.ruleId,
              discountAmount: item.pricingRule.discountAmount,
            })),
        },
      });

      logger.info({
        ...context,
        event: "PAYMENT_CREATED",
        paymentId: payment._id,
        gateway: selectedPaymentMethod,
        amount: total,
      });

      // Create gateway-specific order
      if (selectedPaymentMethod === "razorpay") {
        try {
          if (!gateway.credentials?.apiKey || !gateway.credentials?.apiSecret) {
            logger.error({
              ...context,
              event: "RAZORPAY_CREDENTIALS_MISSING",
              paymentId: payment._id,
            });
            throw new Error("Razorpay credentials not configured");
          }

          const Razorpay = require("razorpay");
          const razorpay = new Razorpay({
            key_id: gateway.credentials.apiKey,
            key_secret: gateway.credentials.apiSecret,
          });

          const options = {
            amount: Math.round(total * 100),
            currency: "INR",
            receipt: `order_${payment._id}`,
            payment_capture: 1,
            notes: {
              paymentId: payment._id.toString(),
              customerId: customerId.toString(),
              type: "order",
              requestId,
            },
          };

          logger.debug({
            ...context,
            event: "RAZORPAY_ORDER_CREATING",
            paymentId: payment._id,
            amount: options.amount,
          });

          const razorpayOrder = await razorpay.orders.create(options);
          payment.gatewayOrderId = razorpayOrder.id;
          await payment.save();

          logger.info({
            ...context,
            event: "RAZORPAY_ORDER_CREATED",
            paymentId: payment._id,
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
          });

          return {
            message: "Proceed to payment",
            gateway: selectedPaymentMethod,
            paymentId: payment._id,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: gateway.credentials.apiKey,
            idempotencyKey,
          };
        } catch (rzpErr) {
          logger.error({
            ...context,
            event: "RAZORPAY_ORDER_CREATION_FAILED",
            paymentId: payment._id,
            error: rzpErr.message,
            stack: rzpErr.stack,
          });
          // Mark payment as failed
          payment.status = "failed";
          await payment.save();
          throw new Error(`Razorpay order creation failed: ${rzpErr.message}`);
        }
      }

      if (selectedPaymentMethod === "stripe") {
        try {
          if (!gateway.credentials?.apiKey) {
            logger.error({
              ...context,
              event: "STRIPE_CREDENTIALS_MISSING",
              paymentId: payment._id,
            });
            throw new Error("Stripe API key not configured");
          }

          const Stripe = require("stripe");
          const stripe = Stripe(gateway.credentials.apiKey);

          logger.debug({
            ...context,
            event: "STRIPE_PAYMENT_INTENT_CREATING",
            paymentId: payment._id,
            amount: Math.round(total * 100),
          });

          const paymentIntent = await stripe.paymentIntents.create(
            {
              amount: Math.round(total * 100),
              currency: "inr",
              metadata: {
                paymentId: payment._id.toString(),
                customerId: customerId.toString(),
                type: "order",
                requestId,
              },
            },
            { idempotencyKey }
          );

          payment.gatewayOrderId = paymentIntent.id;
          payment.clientSecret = paymentIntent.client_secret;
          await payment.save();

          logger.info({
            ...context,
            event: "STRIPE_PAYMENT_INTENT_CREATED",
            paymentId: payment._id,
            paymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
          });

          return {
            message: "Proceed to payment",
            gateway: selectedPaymentMethod,
            paymentId: payment._id,
            clientSecret: paymentIntent.client_secret,
            amount: total,
            currency: "INR",
            idempotencyKey,
          };
        } catch (stripeErr) {
          logger.error({
            ...context,
            event: "STRIPE_PAYMENT_INTENT_FAILED",
            paymentId: payment._id,
            error: stripeErr.message,
            stack: stripeErr.stack,
          });
          // Mark payment as failed
          payment.status = "failed";
          await payment.save();
          throw new Error(
            `Stripe payment intent creation failed: ${stripeErr.message}`
          );
        }
      }

      if (selectedPaymentMethod === "paypal") {
        try {
          if (
            !gateway.credentials?.clientId ||
            !gateway.credentials?.clientSecret
          ) {
            logger.error({
              ...context,
              event: "PAYPAL_CREDENTIALS_MISSING",
              paymentId: payment._id,
            });
            throw new Error("PayPal credentials not configured");
          }

          const paypal = require("@paypal/checkout-server-sdk");
          const environment = new paypal.core.SandboxEnvironment(
            gateway.credentials.clientId,
            gateway.credentials.clientSecret
          );
          const client = new paypal.core.PayPalHttpClient(environment);

          const request = new paypal.orders.OrdersCreateRequest();
          request.prefer("return=representation");
          request.requestBody({
            intent: "CAPTURE",
            purchase_units: [
              {
                amount: {
                  currency_code: "INR",
                  value: total.toFixed(2),
                },
                description: "Order Payment",
                custom_id: payment._id.toString(),
              },
            ],
            application_context: {
              brand_name: "Your Store Name",
              return_url: `${process.env.FRONTEND_PROD}/order-success`,
              cancel_url: `${process.env.FRONTEND_PROD}/order-cancelled`,
            },
          });

          logger.debug({
            ...context,
            event: "PAYPAL_ORDER_CREATING",
            paymentId: payment._id,
            amount: total.toFixed(2),
          });

          const order = await client.execute(request);
          payment.gatewayOrderId = order.result.id;
          await payment.save();

          logger.info({
            ...context,
            event: "PAYPAL_ORDER_CREATED",
            paymentId: payment._id,
            paypalOrderId: order.result.id,
          });

          const approveLink = order.result.links.find(
            (l) => l.rel === "approve"
          )?.href;

          if (!approveLink) {
            logger.warn({
              ...context,
              event: "PAYPAL_APPROVE_LINK_MISSING",
              paymentId: payment._id,
              links: order.result.links,
            });
          }

          return {
            message: "Proceed to payment",
            gateway: selectedPaymentMethod,
            paymentId: payment._id,
            orderId: order.result.id,
            approveLink,
            amount: total,
            currency: "INR",
            idempotencyKey,
          };
        } catch (paypalErr) {
          logger.error({
            ...context,
            event: "PAYPAL_ORDER_CREATION_FAILED",
            paymentId: payment._id,
            error: paypalErr.message,
            stack: paypalErr.stack,
          });
          // Mark payment as failed
          payment.status = "failed";
          await payment.save();
          throw new Error(`PayPal order creation failed: ${paypalErr.message}`);
        }
      }

      logger.warn({
        ...context,
        event: "UNSUPPORTED_PAYMENT_GATEWAY",
        paymentGateway,
        paymentId: payment._id,
      });

      return {
        message: "Proceed to payment",
        gateway: paymentGateway,
        paymentId: payment._id,
        amount: total,
        currency: "INR",
        idempotencyKey,
      };
    } catch (err) {
      logger.error({
        ...context,
        event: "ORDER_CREATE_ERROR",
        error: err.message,
        stack: err.stack,
        customerId,
        addressId,
        paymentGateway,
      });
      throw err;
    }
  }

  async _finalizeOrder({
    customerId,
    addressId,
    notes,
    items,
    subtotal,
    shipping,
    total,
    paymentId,
    paymentMethod,
    sessionId,
    requestId,
    couponId,
    couponDiscount,
  }) {
    const finalizeRequestId =
      requestId || crypto.randomBytes(8).toString("hex");
    const context = {
      route: "OrderService._finalizeOrder",
      requestId: finalizeRequestId,
    };

    logger.info({
      ...context,
      event: "ORDER_FINALIZE_START",
      paymentId,
      customerId,
      itemCount: items?.length || 0,
      total,
    });

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const existingOrder = await Order.findOne({ payment: paymentId });
      if (existingOrder) {
        logger.warn({
          ...context,
          event: "DUPLICATE_FINALIZE_IGNORED",
          paymentId,
          existingOrderId: existingOrder._id,
        });
        await session.abortTransaction();
        session.endSession();
        return existingOrder;
      }

      if (!items || items.length === 0) {
        logger.error({
          ...context,
          event: "NO_ITEMS_PROVIDED",
          paymentId,
        });
        await session.abortTransaction();
        session.endSession();
        throw new Error("No items provided for order finalization");
      }

      logger.debug({
        ...context,
        event: "VALIDATION_PASSED",
        paymentId,
        itemCount: items.length,
      });

      // Stock decrement - use items from metadata (actual ordered items)
      const stockUpdates = [];
      for (const item of items) {
        try {
          const productId = item.product?.toString
            ? item.product.toString()
            : item.product;
          if (!productId) {
            logger.error({
              ...context,
              event: "ITEM_PRODUCT_ID_MISSING",
              item: item.name || "unknown",
            });
            throw new Error(
              `Product ID missing for item: ${item.name || "unknown"}`
            );
          }

          const product = await Product.findById(productId).session(session);
          if (!product) {
            logger.error({
              ...context,
              event: "PRODUCT_NOT_FOUND",
              productId,
              itemName: item.name,
            });
            throw new Error(`Product not found: ${productId}`);
          }

          if (product.currentStock < item.quantity) {
            logger.error({
              ...context,
              event: "INSUFFICIENT_STOCK",
              productId,
              productName: product.productName,
              requested: item.quantity,
              available: product.currentStock,
            });
            throw new Error(
              `Insufficient stock for ${
                item.name || product.productName
              }. Available: ${product.currentStock}, Requested: ${
                item.quantity
              }`
            );
          }

          //       const previousStock = product.currentStock;
          // const newStock = previousStock - item.quantity;

          const updated = await Product.updateOne(
            { _id: productId, currentStock: { $gte: item.quantity } },
            { $inc: { currentStock: -item.quantity } },
            { session }
          );

          if (updated.modifiedCount === 0) {
            logger.error({
              ...context,
              event: "STOCK_UPDATE_FAILED",
              productId,
              productName: product.productName,
              requested: item.quantity,
              currentStock: product.currentStock,
            });
            throw new Error(
              `Insufficient stock for ${item.name || product.productName}`
            );
          }

          // try {
          //   await StockMovement.recordMovement({
          //     shop: product.shop,
          //     product: productId,
          //     type: "out",
          //     quantity: item.quantity,
          //     reason: "sale",
          //     order: order[0]._id,
          //     previousStock,
          //     newStock,
          //     location: {
          //       city: savedOrder?.address?.city,
          //       state: savedOrder?.address?.state,
          //       pincode: savedOrder?.address?.pincode,
          //     },
          //     notes: `Order ${order[0].orderNumber}`,
          //     performedBy: customerId,
          //   });

          //   logger.info({
          //     ...context,
          //     event: "STOCK_MOVEMENT_RECORDED",
          //     productId,
          //     quantity: item.quantity,
          //     previousStock,
          //     newStock,
          //   });
          // } catch (movementErr) {
          //   logger.error({
          //     ...context,
          //     event: "STOCK_MOVEMENT_RECORD_FAILED",
          //     error: movementErr.message,
          //     productId,
          //   });

          // }

          stockUpdates.push({
            productId,
            productName: product.productName,
            quantity: item.quantity,
            newStock: product.currentStock - item.quantity,
          });

          logger.debug({
            ...context,
            event: "STOCK_DECREMENTED",
            productId,
            quantity: item.quantity,
            newStock: product.currentStock - item.quantity,
          });
        } catch (itemErr) {
          logger.error({
            ...context,
            event: "STOCK_DECREMENT_ERROR",
            error: itemErr.message,
            item: item.name || "unknown",
          });
          throw itemErr;
        }
      }

      logger.info({
        ...context,
        event: "STOCK_DECREMENTED_ALL",
        stockUpdates,
      });

      // Get cart for removing items after order creation
      const cart = await Cart.findOne({ customer: customerId }).populate(
        "items.product"
      );

      if (!cart) {
        logger.warn({
          ...context,
          event: "CART_NOT_FOUND_FOR_CLEANUP",
          customerId,
        });
      }

      // Group items by shop
      const shopShipments = [];
      const shopMap = {};
      for (const item of items) {
        const shopId = item.shop?.toString();
        if (!shopId) {
          logger.error({
            ...context,
            event: "ITEM_SHOP_MISSING",
            itemName: item.name,
            productId: item.product,
          });
          throw new Error(
            `Shop ID missing for item: ${item.name || "unknown"}`
          );
        }

        if (!shopMap[shopId]) {
          shopMap[shopId] = true;
          shopShipments.push({
            shop: shopId,
            trackingId: null,
            shipmentId: null,
            status: "pending",
            lastUpdated: new Date(),
          });
        }
      }

      logger.info({
        ...context,
        event: "SHIPMENTS_GROUPED",
        shopCount: shopShipments.length,
        shops: shopShipments.map((s) => s.shop.toString()),
      });

      // Calculate total taxes for order summary
      let orderTaxes = 0;
      for (const item of items) {
        // Use the taxAmount already calculated and stored in item
        if (item.taxAmount) {
          orderTaxes += item.taxAmount * item.quantity;
        }
      }

      logger.debug({
        ...context,
        event: "TAXES_CALCULATED",
        orderTaxes,
        subtotal,
        shipping,
        total,
      });

      const orderData = {
        customer: customerId,
        items,
        shipments: shopShipments,
        subtotal,
        shipping,
        taxes: orderTaxes,
        total,
        address: addressId,
        payment: paymentId,
        paymentMethod: paymentMethod || "cod",
        status: "confirmed",
        notes: notes || null,
        appliedCoupon: couponId
          ? {
              couponId,
              discountAmount: couponDiscount,
            }
          : null,
      };

      logger.debug({
        ...context,
        event: "ORDER_CREATING",
        orderData: {
          customerId,
          itemCount: items.length,
          shipmentCount: shopShipments.length,
          total,
        },
      });

      const order = await Order.create([orderData], { session });

      logger.info({
        ...context,
        event: "ORDER_CREATED",
        orderId: order[0]._id,
        orderNumber: order[0].orderNumber,
        paymentId,
      });

      // send order confirmation email
      try {
        logger.info({
          ...context,
          event: "ORDER_EMAIL_SEND_START",
          orderId: order[0]._id,
          customerId,
        });

        const customer = await Customer.findById(customerId);

        if (customer && customer.email) {
          await sendOrderPlacementEmail(order[0], customer);

          logger.info({
            ...context,
            event: "ORDER_EMAIL_SENT_SUCCESS",
            orderId: order[0]._id,
            customerEmail: customer.email,
          });
        } else {
          logger.warn({
            ...context,
            event: "ORDER_EMAIL_SKIPPED_NO_EMAIL",
            orderId: order[0]._id,
            customerId,
          });
        }
      } catch (emailErr) {
        // Don't fail order if email fails
        logger.error({
          ...context,
          event: "ORDER_EMAIL_SEND_FAILED",
          orderId: order[0]._id,
          error: emailErr.message,
          stack: emailErr.stack,
        });
      }

      // send order mail template to shopkeeper 
      try {
        logger.info({
          ...context,
          event: "SHOPKEEPER_NOTIFICATIONS_START",
          orderId: order[0]._id,
        });

        const shopkeeperResults = await sendOrderNotificationsToShopkeepers(
          order[0]
        );

        logger.info({
          ...context,
          event: "SHOPKEEPER_NOTIFICATIONS_COMPLETE",
          orderId: order[0]._id,
          results: shopkeeperResults,
        });
      } catch (shopkeeperEmailErr) {
        logger.error({
          ...context,
          event: "SHOPKEEPER_NOTIFICATIONS_FAILED",
          orderId: order[0]._id,
          error: shopkeeperEmailErr.message,
          stack: shopkeeperEmailErr.stack,
        });
      }

      // Send notification to admin about new order
      try {
        const customerForNotif = await Customer.findById(customerId).select("firstName lastName email phone");
        if (customerForNotif) {
          const customerName = `${customerForNotif.firstName || ""} ${customerForNotif.lastName || ""}`.trim() || customerForNotif.email || customerForNotif.phone || "Customer";
          
          await createAndEmitNotification({
            title: "New Order Placed",
            message: `${customerName} has placed an order (${order[0].orderNumber})`,
            event: "ORDER_PLACED",
            targetModels: ["Admin"],
            meta: {
              orderId: order[0]._id,
              orderNumber: order[0].orderNumber,
              customerId: customerId,
              customerName: customerName,
              totalAmount: total,
              itemCount: items.length,
              status: order[0].status,
              createdAt: order[0].createdAt || new Date(),
            },
          });

          logger.info({
            ...context,
            event: "ADMIN_ORDER_NOTIFICATION_SENT",
            orderId: order[0]._id,
            customerId: customerId,
          });
        }
      } catch (notifErr) {
        logger.error({
          ...context,
          event: "ADMIN_ORDER_NOTIFICATION_FAILED",
          orderId: order[0]._id,
          error: notifErr.message,
          stack: notifErr.stack,
        });
        // Don't fail order if notification fails
      }

      // Send notifications to shopkeepers for their shop's items
      try {
        const customerForShopkeeperNotif = await Customer.findById(customerId).select("firstName lastName email phone");
        if (!customerForShopkeeperNotif) {
          logger.warn({
            ...context,
            event: "CUSTOMER_NOT_FOUND_FOR_SHOPKEEPER_NOTIFICATIONS",
            customerId,
          });
        } else {
          const customerName = `${customerForShopkeeperNotif.firstName || ""} ${customerForShopkeeperNotif.lastName || ""}`.trim() || customerForShopkeeperNotif.email || customerForShopkeeperNotif.phone || "Customer";
          
          // Group items by shop
          const shopItemsMap = {};
          for (const item of items) {
            const shopId = item.shop?.toString();
            if (!shopId) continue;
            
            if (!shopItemsMap[shopId]) {
              shopItemsMap[shopId] = [];
            }
            shopItemsMap[shopId].push(item);
          }

          logger.info({
            ...context,
            event: "SHOPKEEPER_NOTIFICATIONS_PREPARE",
            orderId: order[0]._id,
            shopsCount: Object.keys(shopItemsMap).length,
            shops: Object.keys(shopItemsMap),
          });

          // Send notification to each shopkeeper for their shop's items
          for (const [shopId, shopItems] of Object.entries(shopItemsMap)) {
            try {
              // Find shop and its owner (shopkeeper)
              const shop = await Shop.findById(shopId).populate("owner", "firstName lastName email phone");
              if (!shop || !shop.owner) {
                logger.warn({
                  ...context,
                  event: "SHOP_OR_OWNER_NOT_FOUND",
                  shopId,
                  orderId: order[0]._id,
                });
                continue;
              }

              const shopkeeper = shop.owner;
              
              if (!shopkeeper || !shopkeeper._id) {
                  logger.warn({
                      ...context,
                      event: "SHOPKEEPER_ID_MISSING",
                      shopId,
                      orderId: order[0]._id
                  });
                  continue;
              }

              // Calculate shop-specific totals
              const shopSubtotal = shopItems.reduce((sum, item) => {
                return sum + (item.lineTotalBeforeCoupon || 0);
              }, 0);

              const shopShipping = shopItems.reduce((sum, item) => {
                return sum + (item.allocatedShipping || 0);
              }, 0);

              const shopTotal = shopSubtotal + shopShipping;
              const shopItemCount = shopItems.reduce((sum, item) => sum + item.quantity, 0);

              // Get shipment status for this shop
              const shipment = order[0].shipments.find(
                (s) => s.shop?.toString() === shopId
              );

              await createAndEmitNotification({
                title: "New Order Received",
                message: `${customerName} has placed an order (${order[0].orderNumber}) - ${shopItemCount} item(s) from your shop`,
                event: "SHOP_ORDER_PLACED",
                targetUsers: [{ 
                  userId: shopkeeper._id, 
                  userModel: "User" 
                }],
                meta: {
                  orderId: order[0]._id,
                  orderNumber: order[0].orderNumber,
                  shopId: shop._id,
                  shopName: shop.shopName,
                  customerId: customerId,
                  customerName: customerName,
                  customerEmail: customerForShopkeeperNotif.email,
                  customerPhone: customerForShopkeeperNotif.phone,
                  shopSubtotal: shopSubtotal,
                  shopShipping: shopShipping,
                  shopTotal: shopTotal,
                  shopItemCount: shopItemCount,
                  items: shopItems.map(item => ({
                    productId: item.product?.toString() || item.product,
                    productName: item.name,
                    quantity: item.quantity,
                    price: item.finalUnitPrice,
                    lineTotal: item.lineTotalBeforeCoupon,
                  })),
                  shipmentStatus: shipment?.status || "pending",
                  status: order[0].status,
                  createdAt: order[0].createdAt || new Date(),
                },
              });

              logger.info({
                ...context,
                event: "SHOPKEEPER_ORDER_NOTIFICATION_SENT",
                orderId: order[0]._id,
                shopId: shop._id,
                shopkeeperId: shopkeeper._id,
                itemCount: shopItemCount,
                shopTotal: shopTotal,
              });
            } catch (shopNotifErr) {
              logger.error({
                ...context,
                event: "SHOPKEEPER_ORDER_NOTIFICATION_FAILED",
                orderId: order[0]._id,
                shopId,
                error: shopNotifErr.message,
                stack: shopNotifErr.stack,
              });
              // Continue with other shops even if one fails
            }
          }
        }
      } catch (shopkeeperNotifErr) {
        logger.error({
          ...context,
          event: "SHOPKEEPER_NOTIFICATIONS_ERROR",
          orderId: order[0]._id,
          error: shopkeeperNotifErr.message,
          stack: shopkeeperNotifErr.stack,
        });
        // Don't fail order if shopkeeper notifications fail
      }

      // Track coupon usage (ATOMIC - prevents duplicate usage)
      if (couponId && couponDiscount > 0) {
        try {
          const couponUpdate = await Coupon.updateOne(
            {
              _id: couponId,
              "usedBy.customer": { $ne: customerId },
            },
            {
              $inc: { usageCount: 1 },
              $push: {
                usedBy: {
                  customer: customerId,
                  usedAt: new Date(),
                  orderAmount: total,
                  discountAmount: couponDiscount,
                },
              },
            },
            { session }
          );

          if (couponUpdate.modifiedCount === 0) {
            logger.error({
              ...context,
              event: "COUPON_ALREADY_USED_BY_CUSTOMER",
              couponId,
              customerId,
              orderId: order[0]._id,
            });
            throw new Error("Coupon has already been used by this customer");
          }

          logger.info({
            ...context,
            event: "COUPON_USAGE_TRACKED",
            couponId,
            orderId: order[0]._id,
            discountAmount: couponDiscount,
          });
        } catch (couponErr) {
          logger.error({
            ...context,
            event: "COUPON_TRACKING_FAILED",
            error: couponErr.message,
            couponId,
          });
          // Fail order if coupon tracking fails (race condition detected)
          throw couponErr;
        }

        // Remove coupon from cart
        try {
          const cart = await Cart.findOne({ customer: customerId }).session(
            session
          );
          if (cart && cart.appliedCoupon) {
            cart.appliedCoupon = null;
            cart.couponDiscount = 0;
            await cart.save({ session });

            logger.info({
              ...context,
              event: "COUPON_REMOVED_FROM_CART",
              customerId,
            });
          }
        } catch (cartErr) {
          logger.error({
            ...context,
            event: "CART_COUPON_REMOVAL_FAILED",
            error: cartErr.message,
          });
        }
      }

      // Remove ordered items from cart (Re-fetch with session to ensure atomic update)
      // We allow this to fail the transaction to ensure data consistency (Order Placed = Cart Cleared)
      const cartToClear = await Cart.findOne({ customer: customerId }).session(session);
      
      if (cartToClear) {
        const orderedProductIds = items.map((i) => 
            (i.product?._id || i.product).toString()
        );
        
        const itemsBefore = cartToClear.items.length;
        
        // Filter out ordered items
        cartToClear.items = cartToClear.items.filter(
          (ci) => !orderedProductIds.includes(ci.product.toString())
        );
        
        // Recalculate cart totals (handles empty cart correctly)
        await cartService._recalculateCart(cartToClear);
        
        await cartToClear.save({ session });

        logger.info({
          ...context,
          event: "CART_CLEARED",
          itemsBefore,
          itemsAfter: cartToClear.items.length,
          removedCount: itemsBefore - cartToClear.items.length,
        });
      } else {
          logger.warn({
          ...context,
          event: "CART_NOT_FOUND_FOR_CLEARING",
          customerId
        });
      }

      const payment = await Payment.findById(paymentId).session(session);
      if (payment) {
        if (payment.status !== "paid") {
          payment.status = "paid";
          await payment.save({ session });
          logger.info({
            ...context,
            event: "PAYMENT_MARKED_PAID",
            paymentId,
          });
        } else {
          logger.debug({
            ...context,
            event: "PAYMENT_ALREADY_PAID",
            paymentId,
          });
        }
      } else {
        logger.error({
          ...context,
          event: "PAYMENT_NOT_FOUND",
          paymentId,
        });
        throw new Error(`Payment not found: ${paymentId}`);
      }

      await session.commitTransaction();
      session.endSession();

      logger.info({
        ...context,
        event: "ORDER_FINALIZED_SUCCESS",
        orderId: order[0]._id,
        orderNumber: order[0].orderNumber,
        paymentId,
        total,
      });

      // --- Shipment Queue ---
      try {
        const savedOrder = await Order.findById(order[0]._id)
          .populate("address")
          .populate("items.product")
          .populate({ path: "shipments.shop", populate: { path: "owner" } });

        if (!savedOrder) {
          logger.error({
            ...context,
            event: "ORDER_NOT_FOUND_AFTER_CREATE",
            orderId: order[0]._id,
          });
          throw new Error("Order not found after creation");
        }

        logger.info({
          ...context,
          event: "SHIPMENT_QUEUE_START",
          orderId: savedOrder._id,
          shipmentCount: savedOrder.shipments.length,
        });

        for (const shipment of savedOrder.shipments) {
          try {
            if (!shipment.shop) {
              logger.error({
                ...context,
                event: "SHIPMENT_SHOP_MISSING",
                shipmentIndex: savedOrder.shipments.indexOf(shipment),
              });
              continue;
            }

            const shopItems = savedOrder.items.filter(
              (item) => item.shop.toString() === shipment.shop.toString()
            );

            if (shopItems.length === 0) {
              logger.warn({
                ...context,
                event: "NO_ITEMS_FOR_SHIPMENT",
                shopId: shipment.shop.toString(),
              });
              continue;
            }

            const fedexIntegration = await FedexIntegration.findOne({
              shopkeeper: shipment.shop.owner,
              isActive: true,
            });
            const upsIntegration = await UpsIntegration.findOne({
              shopkeeper: shipment.shop.owner,
              isActive: true,
            });

            const courier = fedexIntegration
              ? "FEDEX"
              : upsIntegration
              ? "UPS"
              : "SHIPROCKET";

            logger.debug({
              ...context,
              event: "SHIPMENT_QUEUE_ADDING",
              shopId: shipment.shop.toString(),
              courier,
              itemCount: shopItems.length,
            });

            try {
              await shipmentQueue.add("create-shipment", {
                courier,
                order: savedOrder,
                shopId: shipment.shop,
                shopItems,
                requestId: finalizeRequestId,
              });

              logger.info({
                ...context,
                event: "SHIPMENT_QUEUED",
                shopId: shipment.shop.toString(),
                courier,
              });
            } catch (queueErr) {
              logger.error({
                ...context,
                event: "SHIPMENT_QUEUE_FAILED",
                shopId: shipment.shop.toString(),
                courier,
                error: queueErr.message,
              });

              // Fallback to direct Shiprocket API
              try {
                logger.info({
                  ...context,
                  event: "SHIPMENT_FALLBACK_START",
                  shopId: shipment.shop.toString(),
                });

                await ShiprocketApiService.createShipment(
                  savedOrder,
                  shipment.shop,
                  shopItems
                );

                logger.info({
                  ...context,
                  event: "SHIPMENT_FALLBACK_SUCCESS",
                  shopId: shipment.shop.toString(),
                });
              } catch (fallbackErr) {
                logger.error({
                  ...context,
                  event: "SHIPMENT_FALLBACK_FAILED",
                  shopId: shipment.shop.toString(),
                  error: fallbackErr.message,
                  stack: fallbackErr.stack,
                });
                // Continue with other shipments even if one fails
              }
            }
          } catch (shipmentErr) {
            logger.error({
              ...context,
              event: "SHIPMENT_PROCESSING_ERROR",
              shopId: shipment.shop?.toString(),
              error: shipmentErr.message,
              stack: shipmentErr.stack,
            });
            // Continue with other shipments
          }
        }

        logger.info({
          ...context,
          event: "SHIPMENT_QUEUE_COMPLETE",
          orderId: savedOrder._id,
        });
      } catch (shipmentQueueErr) {
        logger.error({
          ...context,
          event: "SHIPMENT_QUEUE_ERROR",
          error: shipmentQueueErr.message,
          stack: shipmentQueueErr.stack,
        });
        // Don't fail order if shipment queue fails - can be retried
      }

      // Abandoned cart update
      try {
        const orderedProductIds = items.map((i) => {
          const productId = i.product?.toString
            ? i.product.toString()
            : i.product;
          return productId.toString();
        });

        const abandonedFilter = customerId
          ? { customer: customerId, product: { $in: orderedProductIds } }
          : { sessionId, product: { $in: orderedProductIds } };

        const updateResult = await AbandonedCart.updateMany(
          { ...abandonedFilter, status: { $in: ["pending", "sent"] } },
          { $set: { status: "recovered", recoveredAt: new Date() } }
        );

        logger.info({
          ...context,
          event: "ABANDONED_CART_UPDATED",
          matchedCount: updateResult.matchedCount,
          modifiedCount: updateResult.modifiedCount,
        });
      } catch (abandonedErr) {
        logger.info({
          ...context,
          event: "ABANDONED_CART_UPDATE_FAILED",
          error: abandonedErr.message,
        });
        // Don't fail order if abandoned cart update fails
      }

      try {
        logger.info({
          ...context,
          event: "PRICING_RULE_TRACKING_START",
          orderId: order[0]._id,
        });

        for (const item of items) {
          if (item.pricingRule && item.pricingRule.ruleId) {
            const totalDiscountForItem =
              item.pricingRule.discountAmount * item.quantity;

            await pricingRuleService.trackRuleUsage(
              item.pricingRule.ruleId,
              totalDiscountForItem
            );

            logger.debug({
              ...context,
              event: "PRICING_RULE_USAGE_TRACKED",
              ruleId: item.pricingRule.ruleId,
              ruleName: item.pricingRule.ruleName,
              productId: item.product,
              discountGiven: totalDiscountForItem,
            });
          }
        }

        logger.info({
          ...context,
          event: "PRICING_RULE_TRACKING_COMPLETE",
          orderId: order[0]._id,
        });
      } catch (trackingErr) {
        logger.error({
          ...context,
          event: "PRICING_RULE_TRACKING_ERROR",
          error: trackingErr.message,
          stack: trackingErr.stack,
        });
      }

      try {
        logger.info({
          ...context,
          event: "CUSTOMER_GROUPING_START",
          orderId: order[0]._id,
          customerId: customerId.toString(),
        });

        await customerGroupingService.evaluateCustomerGroup(customerId);

        logger.info({
          ...context,
          event: "CUSTOMER_GROUPING_COMPLETE",
          orderId: order[0]._id,
        });
      } catch (groupingErr) {
        logger.error({
          ...context,
          event: "CUSTOMER_GROUPING_ERROR",
          error: groupingErr.message,
          stack: groupingErr.stack,
        });
        // Don't fail order if grouping evaluation fails
      }

      logger.info({
        ...context,
        event: "ORDER_FINALIZE_COMPLETE",
        orderId: order[0]._id,
        orderNumber: order[0].orderNumber,
      });

      return order[0];
    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      logger.error({
        ...context,
        event: "ORDER_FINALIZE_FAILED",
        error: err.message,
        stack: err.stack,
        paymentId,
        customerId,
      });
      throw err;
    }
  }

  // get orders

  async getOrders(req) {
    const customerId = req.user?._id;
    if (!customerId) throw new Error("Unauthorized access");

    const orders = await Order.find({ customer: customerId })
      .populate("items.product")
      .populate("address")
      .sort({ createdAt: -1 });

    return orders;
  }

  async getOrderById(req) {
    const customerId = req.user?._id;
    const orderId = req.params.orderId;

    const order = await Order.findOne({ _id: orderId, customer: customerId })
      .populate("items.product")
      .populate("items.shop")
      .populate("address");

    if (!order) throw new Error("Order not found");
    return order;
  }

  async updateStatus(orderId, status) {
    const order = await Order.findById(orderId);
    if (!order) throw new Error("Order not found");

    order.status = status;
    if (status === "cancelled") order.cancelledAt = new Date();
    if (status === "delivered") order.deliveredAt = new Date();
    if (status === "returned") order.returnedAt = new Date();

    await order.save();
    return order;
  }
}

module.exports = new OrderService();