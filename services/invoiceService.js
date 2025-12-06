const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Shop = require("../models/Shop");
const Address = require("../models/Address");
const logger = require("../config/logger");

class InvoiceService {
  async generateInvoiceData(orderId, customerId) {
    try {
      logger.info({
        event: "INVOICE_GENERATION_START",
        orderId,
        customerId: customerId?.toString(),
      });

      // Fetch order with all necessary data
      const order = await Order.findById(orderId)
        .populate({
          path: "items.product",
          select: "productName sku icon1",
        })
        .populate({
          path: "items.shop",
          select: "shopName address phoneNumber",
        })
        .populate("address")
        .populate("customer", "firstName lastName email phone")
        .lean();

      if (!order) {
        throw new Error("Order not found");
      }

      // Verify customer owns this order
      if (order.customer._id.toString() !== customerId.toString()) {
        throw new Error("Unauthorized access to invoice");
      }

      // Calculate totals and breakdowns
      const invoiceData = {
        // Order info
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        status: order.status,

        // Customer info
        customer: {
          name: `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim(),
          email: order.customer.email,
          phone: order.customer.phone,
        },

        // Delivery address
        deliveryAddress: {
          name: order.address.name,
          phone: order.address.phone,
          addressLine1: order.address.addressLine1,
          addressLine2: order.address.addressLine2,
          city: order.address.city,
          state: order.address.state,
          pincode: order.address.pincode,
          country: order.address.country || "India",
        },

        // Items with complete breakdown
        items: order.items.map((item) => {
          // Calculate item-level totals
          const itemSubtotal = item.originalPrice * item.quantity;
          const productDiscount = item.productDiscountAmount * item.quantity;
          const flashSaleDiscount = item.flashSale?.discountAmount
            ? item.flashSale.discountAmount * item.quantity
            : 0;
          const pricingRuleDiscount = item.pricingRule?.discountAmount
            ? item.pricingRule.discountAmount * item.quantity
            : 0;
          const upsellDiscount = item.upsellCrossSell?.discountAmount
            ? item.upsellCrossSell.discountAmount * item.quantity
            : 0;

          return {
            productName: item.name,
            sku: item.sku,
            quantity: item.quantity,
            shopName: item.shop?.shopName,

            // Pricing breakdown
            originalPrice: item.originalPrice,
            itemSubtotal: itemSubtotal,

            // Discounts applied
            discounts: {
              productDiscount: {
                type: item.productDiscountType,
                value: item.productDiscountValue,
                amount: productDiscount,
              },
              flashSale: item.flashSale
                ? {
                    name: item.flashSale.flashSaleName,
                    type: item.flashSale.discountType,
                    value: item.flashSale.discountValue,
                    amount: flashSaleDiscount,
                  }
                : null,
              pricingRule: item.pricingRule
                ? {
                    name: item.pricingRule.ruleName,
                    type: item.pricingRule.discountType,
                    value: item.pricingRule.discountValue,
                    amount: pricingRuleDiscount,
                    customerGroup: item.pricingRule.customerGroup,
                  }
                : null,
              upsellCrossSell: item.upsellCrossSell
                ? {
                    name: item.upsellCrossSell.ruleName,
                    type: item.upsellCrossSell.ruleType,
                    discountType: item.upsellCrossSell.discountType,
                    value: item.upsellCrossSell.discountValue,
                    amount: upsellDiscount,
                  }
                : null,
              totalItemDiscount:
                productDiscount +
                flashSaleDiscount +
                pricingRuleDiscount +
                upsellDiscount,
            },

            // Tax
            tax: {
              type: item.taxType,
              rate: item.taxRate,
              amount: item.taxAmount * item.quantity,
              region: item.region,
            },

            // Final pricing
            finalUnitPrice: item.finalUnitPrice,
            lineTotal: item.lineTotalBeforeCoupon,
          };
        }),

        // Order-level summary
        summary: {
          // Subtotal (before coupon)
          subtotalBeforeCoupon: order.items.reduce(
            (sum, item) => sum + item.lineTotalBeforeCoupon,
            0
          ),

          // Total discounts breakdown
          discounts: {
            productDiscounts: order.items.reduce(
              (sum, item) => sum + item.productDiscountAmount * item.quantity,
              0
            ),
            flashSaleDiscounts: order.items.reduce(
              (sum, item) =>
                sum +
                (item.flashSale?.discountAmount
                  ? item.flashSale.discountAmount * item.quantity
                  : 0),
              0
            ),
            pricingRuleDiscounts: order.items.reduce(
              (sum, item) =>
                sum +
                (item.pricingRule?.discountAmount
                  ? item.pricingRule.discountAmount * item.quantity
                  : 0),
              0
            ),
            upsellDiscounts: order.items.reduce(
              (sum, item) =>
                sum +
                (item.upsellCrossSell?.discountAmount
                  ? item.upsellCrossSell.discountAmount * item.quantity
                  : 0),
              0
            ),
            couponDiscount: order.appliedCoupon?.discountAmount || 0,
          },

          // Coupon info
          appliedCoupon: order.appliedCoupon
            ? {
                couponId: order.appliedCoupon.couponId,
                discountAmount: order.appliedCoupon.discountAmount,
              }
            : null,

          // Tax
          totalTax: order.taxes,

          // Shipping
          shipping: order.shipping,
          shippingBreakdown: order.items.map((item) => ({
            shop: item.shop?.shopName,
            amount: item.allocatedShipping || 0,
          })),

          // Final totals
          subtotal: order.subtotal, // After all discounts (before shipping)
          total: order.total, // Grand total
        },

        // Payment info
        payment: {
          method: order.payment ? "Online" : "Cash on Delivery",
          status: order.status === "delivered" ? "Paid" : "Pending",
        },

        // Shipment tracking
        shipments: order.shipments.map((shipment) => ({
          shop: shipment.shop,
          status: shipment.status,
          trackingId: shipment.trackingId,
          courierName: shipment.courierName,
          lastUpdated: shipment.lastUpdated,
        })),
      };

      logger.info({
        event: "INVOICE_GENERATION_SUCCESS",
        orderId,
        itemCount: order.items.length,
        total: order.total,
      });

      return invoiceData;
    } catch (err) {
      logger.error({
        event: "INVOICE_GENERATION_ERROR",
        orderId,
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
}

module.exports = new InvoiceService();