const SupplierMailTemplate = require("../models/SupplierMailTemplate");
const { sendEmail } = require("../utils/mailer");
const logger = require("../config/logger");
const User = require("../models/User");

async function sendShopkeeperOrderEmail(order, shopId) {
  try {
    let template = await SupplierMailTemplate.findOne({
      templateType: "order_recieved",
      isActive: true,
    });

    if (!template) {
      template = await SupplierMailTemplate.findOne({
        templateType: "order_received",
        isActive: true,
      });
    }

    if (!template) {
      logger.warn({
        event: "SHOPKEEPER_MAIL_TEMPLATE_MISSING",
        shopId,
        orderId: order._id,
        message: "Template 'order_recieved' or 'order_received' not found or inactive"
      });
      return false;
    }

    const shop = await require("../models/Shop")
      .findById(shopId)
      .populate("owner");
    
    if (!shop || !shop.owner) {
      logger.error({
        event: "SHOPKEEPER_NOT_FOUND",
        shopId,
        orderId: order._id,
      });
      return false;
    }

    const shopkeeper = shop.owner;
    
    if (!shopkeeper.email) {
      logger.warn({
        event: "SHOPKEEPER_NO_EMAIL",
        shopId,
        shopkeeperId: shopkeeper._id,
      });
      return false;
    }

    const shopItems = order.items.filter(
      (item) => {
        const itemShopId = item.shop?._id?.toString() || item.shop?.toString();
        return itemShopId === shopId.toString();
      }
    );

    if (shopItems.length === 0) {
      logger.warn({
        event: "NO_ITEMS_FOR_SHOP",
        shopId,
        orderId: order._id,
      });
      return false;
    }

    const shopCalculations = calculateShopOrderTotals(shopItems, order);
    const shipment = order.shipments.find(
      (s) => s.shop.toString() === shopId.toString()
    );
    const displayOrderNumber = shipment?.shipmentId || order.orderNumber;

    const placeholders = {
      VendorName: `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim() || shopkeeper.email,
      ShopName: shop.shopName || "Your Shop",
      OrderNumber: displayOrderNumber,
      OrderDate: new Date(order.createdAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }),
      CustomerName: order.customer?.firstName 
        ? `${order.customer.firstName} ${order.customer.lastName || ""}`.trim()
        : order.customer?.email || "Customer",
      CustomerEmail: order.customer?.email || "N/A",
      CustomerPhone: order.customer?.phone || "N/A",
      DeliveryAddress: formatAddress(order.address),
      LoginButton: `<a href="https://test-dobby.vercel.app/?form=shopkeeper-signin" style="display:inline-block;background:#FF9900;color:#0F1111;padding:12px 32px;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;border:1px solid #FFA724;font-family:Arial,sans-serif;margin:20px 0;">Manage Order</a>`,
    };

    let mailBody = template.mailBody;
    for (const [key, value] of Object.entries(placeholders)) {
      mailBody = mailBody.replace(new RegExp(`{${key}}`, "g"), value);
    }

    let pageLinksHtml = "";
    for (const [key, value] of Object.entries(template.pageLinks || {})) {
      if (value.enabled) {
        pageLinksHtml += `<a href="${value.url}" style="color:#007185;text-decoration:none;font-size:13px;margin:0 12px;display:inline-block;">${key.replace(/([A-Z])/g, " $1").trim()}</a>`;
      }
    }

    const iconMap = {
      facebook: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
      instagram: "https://cdn-icons-png.flaticon.com/512/733/733558.png",
      X: "https://cdn-icons-png.flaticon.com/512/5969/5969020.png",
      linkedin: "https://cdn-icons-png.flaticon.com/512/733/733561.png",
      youtube: "https://cdn-icons-png.flaticon.com/512/733/733646.png",
    };

    let socialLinksHtml = "";
    for (const [key, value] of Object.entries(template.socialMediaLinks || {})) {
      if (value.enabled && value.url) {
        const iconUrl = iconMap[key] || "https://cdn-icons-png.flaticon.com/512/733/733585.png";
        socialLinksHtml += `<a href="${value.url}" style="margin:0 8px;display:inline-block;" target="_blank"><img src="${iconUrl}" alt="${key}" height="20" style="opacity:0.7;vertical-align:middle;"/></a>`;
      }
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Order - ${displayOrderNumber}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#F6F6F6;color:#0F1111;">
  
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F6F6;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        
        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#FFFFFF;border:1px solid #DDD;border-radius:8px;overflow:hidden;">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background:linear-gradient(135deg,#232F3E 0%,#374251 100%);padding:24px 30px;text-align:center;">
              <img src="${template.logoUrl}" alt="Logo" style="height:50px;max-width:180px;display:block;margin:0 auto;"/>
            </td>
          </tr>
          
          <!-- Order Alert Banner -->
          <tr>
            <td style="background:#F0F8FF;padding:20px 30px;border-bottom:3px solid #FF9900;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="60" style="vertical-align:middle;">
                    <div style="background:#067D62;width:50px;height:50px;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;line-height:50px;">
                      <span style="color:#FFF;font-size:28px;font-weight:bold;">✓</span>
                    </div>
                  </td>
                  <td style="vertical-align:middle;padding-left:16px;">
                    <div style="font-size:22px;font-weight:700;color:#0F1111;margin-bottom:6px;line-height:1.2;">
                      ${template.title || 'New Order Received!'}
                    </div>
                    <div style="font-size:14px;color:#565959;line-height:1.4;">
                      Order #<strong style="color:#B12704;">${displayOrderNumber}</strong> · ${placeholders.OrderDate}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Message Body -->
          <tr>
            <td style="padding:30px 30px 20px 30px;color:#0F1111;font-size:15px;line-height:1.6;">
              ${mailBody}
            </td>
          </tr>
          
          <!-- Order Items Section -->
          <tr>
            <td style="padding:0 30px 20px 30px;">
              <h2 style="margin:0 0 20px 0;font-size:20px;font-weight:700;color:#0F1111;border-bottom:2px solid #FF9900;padding-bottom:10px;">
                Order Items (${shopItems.length})
              </h2>
              ${generateCleanOrderItemsHTML(shopItems)}
            </td>
          </tr>
          
          <!-- Pricing Summary -->
          ${generateCleanPricingSummaryHTML(shopCalculations, shopItems.length)}
          
          <!-- Customer & Shipping Info - Side by Side -->
          <tr>
            <td style="padding:0 30px 30px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F9F9F9;border-radius:8px;overflow:hidden;">
                <tr>
                  <!-- Customer Details -->
                  <td width="50%" style="padding:20px;vertical-align:top;border-right:1px solid #E5E5E5;">
                    <h3 style="margin:0 0 15px 0;font-size:16px;font-weight:700;color:#0F1111;">
                      👤 Customer
                    </h3>
                    <div style="font-size:14px;color:#0F1111;line-height:1.8;">
                      <div style="margin-bottom:8px;">
                        <strong>${order.customer?.firstName ? `${order.customer.firstName} ${order.customer.lastName || ""}`.trim() : "N/A"}</strong>
                      </div>
                      <div style="color:#565959;margin-bottom:6px;">
                        📧 ${order.customer?.email || "N/A"}
                      </div>
                      <div style="color:#565959;">
                        📱 ${order.customer?.phone || "N/A"}
                      </div>
                    </div>
                  </td>
                  
                  <!-- Shipping Address -->
                  <td width="50%" style="padding:20px;vertical-align:top;">
                    <h3 style="margin:0 0 15px 0;font-size:16px;font-weight:700;color:#0F1111;">
                      📦 Delivery Address
                    </h3>
                    <div style="font-size:14px;color:#0F1111;line-height:1.8;">
                      ${formatAddressHTML(order.address)}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Shipment Status -->
          <tr>
            <td style="padding:0 30px 30px 30px;">
              <div style="background:#FFF8E1;border-left:4px solid #FF9900;padding:16px 20px;border-radius:6px;">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <div style="font-size:15px;font-weight:700;color:#0F1111;margin-bottom:8px;">
                        🚚 Shipment Status
                      </div>
                      <div style="font-size:14px;color:#0F1111;line-height:1.6;">
                        Status: <strong style="color:#B12704;text-transform:capitalize;">${shipment?.status || "Pending"}</strong>
                        ${shipment?.trackingId ? `<br/>Tracking ID: <strong style="color:#007185;">${shipment.trackingId}</strong>` : ''}
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- Action Button -->
          <tr>
            <td style="padding:30px;text-align:center;background:#F9F9F9;border-top:1px solid #DDD;border-bottom:1px solid #DDD;">
              ${placeholders.LoginButton}
              <div style="font-size:13px;color:#565959;margin-top:12px;">
                Login to manage your orders and update shipment status
              </div>
            </td>
          </tr>
          
          <!-- Important Note -->
          <tr>
            <td style="padding:25px 30px;">
              <div style="padding:16px;background:#FFF3CD;border-left:4px solid #FFC107;border-radius:6px;">
                <div style="font-size:14px;color:#856404;line-height:1.6;">
                  <strong style="color:#B12704;">⚠️ Important:</strong> This email contains only the items ordered from <strong>${shop.shopName}</strong>. The customer may have placed orders with other sellers as well.
                </div>
              </div>
            </td>
          </tr>
          
          <!-- Footer Message -->
          ${template.footerSectionText ? `
          <tr>
            <td style="padding:25px 30px;font-size:14px;color:#565959;line-height:1.7;border-top:1px solid #E5E5E5;">
              ${template.footerSectionText}
            </td>
          </tr>
          ` : ""}
          
          <!-- Page Links -->
          ${pageLinksHtml ? `
          <tr>
            <td style="padding:20px 30px;text-align:center;background:#F9F9F9;border-top:1px solid #E5E5E5;">
              ${pageLinksHtml}
            </td>
          </tr>
          ` : ""}
          
          <!-- Social Media Links -->
          ${socialLinksHtml ? `
          <tr>
            <td style="padding:20px 30px;text-align:center;background:#F9F9F9;">
              <div style="font-size:12px;color:#565959;margin-bottom:12px;text-transform:uppercase;letter-spacing:1.5px;font-weight:600;">
                Connect With Us
              </div>
              ${socialLinksHtml}
            </td>
          </tr>
          ` : ""}
          
          <!-- Copyright Footer -->
          <tr>
            <td style="padding:20px 30px;text-align:center;background:#232F3E;color:#FFFFFF;font-size:12px;line-height:1.6;">
              ${template.copyrightText || ""}
            </td>
          </tr>
          
        </table>
        
      </td>
    </tr>
  </table>
  
</body>
</html>
    `;

    await sendEmail(
      shopkeeper.email,
      template.title || "New Order Received",
      htmlContent
    );

    logger.info({
      event: "SHOPKEEPER_ORDER_EMAIL_SENT",
      orderId: order._id,
      orderNumber: order.orderNumber,
      shopId,
      shopkeeperEmail: shopkeeper.email,
      itemCount: shopItems.length,
      total: shopCalculations.total,
    });

    return true;
  } catch (err) {
    logger.error({
      event: "SHOPKEEPER_ORDER_EMAIL_FAILED",
      orderId: order?._id,
      shopId,
      error: err.message,
      stack: err.stack,
    });
    return false;
  }
}

async function sendOrderNotificationsToShopkeepers(order) {
  try {
    if (typeof order.populate === 'function') {
        await order.populate([
            { path: "items.product" },
            { path: "items.shop" },
            { path: "address" },
            { path: "customer" }
        ]);
    }

    const shopIds = [...new Set(order.items
        .filter(item => item.shop) 
        .map(item => (item.shop._id || item.shop).toString())
    )];

    logger.info({
      event: "SENDING_SHOPKEEPER_NOTIFICATIONS",
      orderId: order._id,
      orderNumber: order.orderNumber,
      shopCount: shopIds.length,
      shopIds,
    });

    const emailPromises = shopIds.map(shopId => 
      sendShopkeeperOrderEmail(order, shopId)
    );

    const results = await Promise.allSettled(emailPromises);
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failCount = results.filter(r => r.status === 'rejected' || !r.value).length;

    logger.info({
      event: "SHOPKEEPER_NOTIFICATIONS_COMPLETE",
      orderId: order._id,
      totalShops: shopIds.length,
      successCount,
      failCount,
    });

    return {
      success: successCount,
      failed: failCount,
      total: shopIds.length,
    };
  } catch (err) {
    logger.error({
      event: "SHOPKEEPER_NOTIFICATIONS_ERROR",
      orderId: order?._id,
      error: err.message,
      stack: err.stack,
    });
    return {
      success: 0,
      failed: 0,
      total: 0,
      error: err.message,
    };
  }
}

function calculateShopOrderTotals(shopItems, fullOrder) {
  let originalSubtotal = 0;
  let productDiscounts = 0;
  let flashSaleDiscounts = 0;
  let pricingRuleDiscounts = 0;
  let upsellDiscounts = 0;
  let subtotal = 0;
  let taxes = 0;
  let shipping = 0;
  let couponDiscount = 0;

  for (const item of shopItems) {
    const qty = item.quantity;
    
    // Original price (before any discounts)
    originalSubtotal += item.originalPrice * qty;
    
    // Product discount
    productDiscounts += (item.productDiscountAmount || 0) * qty;
    
    // Flash sale discount
    if (item.flashSale?.discountAmount) {
      flashSaleDiscounts += item.flashSale.discountAmount * qty;
    }
    
    // Pricing rule discount
    if (item.pricingRule?.discountAmount) {
      pricingRuleDiscounts += item.pricingRule.discountAmount * qty;
    }
    
    // Upsell/Cross-sell discount
    if (item.upsellCrossSell?.discountAmount) {
      upsellDiscounts += item.upsellCrossSell.discountAmount * qty;
    }

    // lineTotalBeforeCoupon already includes: all discounts + coupon + tax
    // So we use it directly for subtotal
    subtotal += item.lineTotalBeforeCoupon || (item.finalUnitPrice * qty);
    
    // Tax is already included in lineTotalBeforeCoupon, but we calculate it separately for display
    taxes += (item.taxAmount || 0) * qty;
    
    // Shipping per item
    shipping += item.allocatedShipping || 0;
  }

  // Calculate coupon discount from order level (if coupon belongs to this shop)
  // Note: Coupon discount is already included in lineTotalBeforeCoupon, 
  // but we need to show it separately in the breakdown
  if (fullOrder.appliedCoupon?.discountAmount && shopItems.length > 0) {
    const firstItemShop = shopItems[0].shop;
    const shopId = (firstItemShop._id || firstItemShop).toString();
    
    if (fullOrder.appliedCoupon.shop?.toString() === shopId) {
      // Coupon discount is allocated proportionally across items
      // We need to calculate the shop's share of the coupon
      // Since coupon is shop-specific, if it matches this shop, use the full discount
      couponDiscount = fullOrder.appliedCoupon.discountAmount;
    }
  }

  // Total calculation:
  // lineTotalBeforeCoupon already includes: originalPrice - allDiscounts - coupon + tax
  // So: total = subtotal (already includes tax) + shipping
  // We don't add tax again because it's already in subtotal
  const total = subtotal + shipping;

  return {
    originalSubtotal,
    productDiscounts,
    flashSaleDiscounts,
    pricingRuleDiscounts,
    upsellDiscounts,
    couponDiscount,
    subtotal,
    taxes, // For display only (already included in subtotal)
    shipping,
    total,
  };
}

function generateCleanOrderItemsHTML(shopItems) {
  let html = '';

  for (const item of shopItems) {
    const productImage = item.product?.icon1 || 'https://via.placeholder.com/100x100?text=No+Image';
    const productName = item.name || item.product?.productName || 'Product';
    const sku = item.sku || 'N/A';
    const qty = item.quantity;
    const unitPrice = item.originalPrice;
    const lineTotal = unitPrice * qty;

    html += `
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border:1px solid #E5E5E5;border-radius:8px;overflow:hidden;background:#FAFAFA;">
        <tr>
          <td width="100" style="padding:16px;vertical-align:top;background:#FFF;">
            <img src="${productImage}" alt="${productName}" style="width:100px;height:100px;object-fit:cover;border:1px solid #DDD;border-radius:6px;display:block;"/>
          </td>
          <td style="padding:16px;vertical-align:top;">
            <div style="font-size:16px;font-weight:700;color:#007185;margin-bottom:8px;line-height:1.4;">
              ${productName}
            </div>
            <div style="font-size:13px;color:#565959;margin-bottom:12px;">
              SKU: <strong style="color:#0F1111;">${sku}</strong>
            </div>
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="33%" style="font-size:14px;color:#565959;">
                  <div style="margin-bottom:4px;font-size:12px;color:#888;">Quantity</div>
                  <strong style="color:#0F1111;font-size:16px;">${qty}</strong>
                </td>
                <td width="33%" style="font-size:14px;text-align:center;">
                  <div style="margin-bottom:4px;font-size:12px;color:#888;">Unit Price</div>
                  <strong style="color:#0F1111;font-size:16px;">${formatCurrency(unitPrice)}</strong>
                </td>
                <td width="34%" style="text-align:right;">
                  <div style="margin-bottom:4px;font-size:12px;color:#888;">Line Total</div>
                  <strong style="color:#B12704;font-size:18px;font-weight:700;">${formatCurrency(lineTotal)}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  return html;
}

function generateCleanPricingSummaryHTML(calculations, itemCount) {
  const totalSavings = calculations.productDiscounts + calculations.flashSaleDiscounts + 
                       calculations.pricingRuleDiscounts + calculations.upsellDiscounts + 
                       calculations.couponDiscount;

  return `
    <tr>
      <td style="padding:0 30px 30px 30px;">
        <div style="background:#F9F9F9;border-radius:8px;padding:24px;border:1px solid #E5E5E5;">
          <h3 style="margin:0 0 20px 0;font-size:18px;font-weight:700;color:#0F1111;border-bottom:2px solid #FF9900;padding-bottom:10px;">
            💰 Order Summary
          </h3>
          
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
            <tr>
              <td style="padding:10px 0;color:#0F1111;border-bottom:1px solid #E5E5E5;">
                Items (${itemCount})
              </td>
              <td style="padding:10px 0;text-align:right;color:#0F1111;border-bottom:1px solid #E5E5E5;">
                ${formatCurrency(calculations.originalSubtotal)}
              </td>
            </tr>
            
            ${totalSavings > 0 ? `
            <tr>
              <td style="padding:10px 0;color:#067D62;font-weight:700;border-bottom:1px solid #E5E5E5;">
                💚 Total Savings
              </td>
              <td style="padding:10px 0;text-align:right;color:#067D62;font-weight:700;border-bottom:1px solid #E5E5E5;">
                −${formatCurrency(totalSavings)}
              </td>
            </tr>
            ` : ""}
            
            ${calculations.taxes > 0 ? `
            <tr>
              <td style="padding:10px 0;color:#565959;border-bottom:1px solid #E5E5E5;">
                Tax (GST)
              </td>
              <td style="padding:10px 0;text-align:right;color:#565959;border-bottom:1px solid #E5E5E5;">
                ${formatCurrency(calculations.taxes)}
              </td>
            </tr>
            ` : ""}
              
            <tr>
              <td style="padding:10px 0;color:#565959;border-bottom:2px solid #DDD;">
                Shipping & Handling
              </td>
              <td style="padding:10px 0;text-align:right;color:#565959;border-bottom:2px solid #DDD;">
                ${calculations.shipping > 0 ? formatCurrency(calculations.shipping) : '<span style="color:#067D62;font-weight:700;">FREE</span>'}
              </td>
            </tr>
            
            <tr>
              <td style="padding:16px 0 0 0;color:#B12704;font-size:20px;font-weight:700;">
                Order Total
              </td>
              <td style="padding:16px 0 0 0;text-align:right;color:#B12704;font-size:20px;font-weight:700;">
                ${formatCurrency(calculations.total)}
              </td>
            </tr>
          </table>
          
          ${totalSavings > 0 ? `
          <div style="margin-top:20px;padding:14px;background:#E7F9F0;border-left:4px solid #067D62;border-radius:6px;">
            <div style="font-size:14px;color:#067D62;font-weight:700;">
              🎉 Great! Customer saved ${formatCurrency(totalSavings)} on this order
            </div>
          </div>
          ` : ""}
        </div>
      </td>
    </tr>
  `;
}

function formatAddressHTML(address) {
  if (!address) return "<span style='color:#999;'>Address not available</span>";
  
  return `
    <div style="font-weight:700;color:#0F1111;margin-bottom:8px;">${address.name || "N/A"}</div>
    <div style="color:#565959;line-height:1.8;">
      ${address.address1 || ""}<br/>
      ${address.address2 ? address.address2 + "<br/>" : ""}
      ${address.city || ""}, ${address.state || ""} ${address.pincode || ""}<br/>
      ${address.phone ? "📱 " + address.phone : ""}
    </div>
  `;
}

function formatAddress(address) {
  if (!address) return "Address not available";
  return `${address.name || ""}, ${address.address1 || ""}, ${address.address2 ? address.address2 + ", " : ""}${address.city || ""}, ${address.state || ""} ${address.pincode || ""}${address.phone ? ", Phone: " + address.phone : ""}`;
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount || 0);
}

module.exports = {
  sendShopkeeperOrderEmail,
  sendOrderNotificationsToShopkeepers,
  calculateShopOrderTotals,
};

// const SupplierMailTemplate = require("../models/SupplierMailTemplate");
// const { sendEmail } = require("../utils/mailer");
// const logger = require("../config/logger");
// const User = require("../models/User");


// async function sendShopkeeperOrderEmail(order, shopId) {
//   try {
//     // Fetch order_received template (handle typo in DB/Schema if necessary)
//     let template = await SupplierMailTemplate.findOne({
//       templateType: "order_recieved", // Schema defined typo
//       isActive: true,
//     });

//     if (!template) {
//       // Fallback to correct spelling if schema/DB was fixed
//       template = await SupplierMailTemplate.findOne({
//         templateType: "order_received", 
//         isActive: true,
//       });
//     }

//     if (!template) {
//       logger.warn({
//         event: "SHOPKEEPER_MAIL_TEMPLATE_MISSING",
//         shopId,
//         orderId: order._id,
//         message: "Template 'order_recieved' or 'order_received' not found or inactive"
//       });
//       return false;
//     }

//     // Order is already populated in sendOrderNotificationsToShopkeepers
    
//     // Get shopkeeper details
//     const shop = await require("../models/Shop")
//       .findById(shopId)
//       .populate("owner");
    
//     if (!shop || !shop.owner) {
//       logger.error({
//         event: "SHOPKEEPER_NOT_FOUND",
//         shopId,
//         orderId: order._id,
//       });
//       return false;
//     }

//     const shopkeeper = shop.owner;
    
//     if (!shopkeeper.email) {
//       logger.warn({
//         event: "SHOPKEEPER_NO_EMAIL",
//         shopId,
//         shopkeeperId: shopkeeper._id,
//       });
//       return false;
//     }

//     // Filter items for THIS shop only (Shop Isolation)
//     const shopItems = order.items.filter(
//       (item) => {
//         const itemShopId = item.shop?._id?.toString() || item.shop?.toString();
//         return itemShopId === shopId.toString();
//       }
//     );

//     if (shopItems.length === 0) {
//       logger.warn({
//         event: "NO_ITEMS_FOR_SHOP",
//         shopId,
//         orderId: order._id,
//       });
//       return false;
//     }

//     // Calculate shop-specific totals
//     const shopCalculations = calculateShopOrderTotals(shopItems, order);

//     // Get shipment info for this shop
//     const shipment = order.shipments.find(
//       (s) => s.shop.toString() === shopId.toString()
//     );

//     // Determine Order Number to show (Shop specific if available, else Global)
//     // User requirement: "order number usi ka dikhe"
//     const displayOrderNumber = shipment?.shipmentId || order.orderNumber;

//     // Build placeholders
//     const placeholders = {
//       VendorName: `${shopkeeper.firstName || ""} ${shopkeeper.lastName || ""}`.trim() || shopkeeper.email,
//       ShopName: shop.shopName || "Your Shop",
//       OrderNumber: displayOrderNumber,
//       OrderDate: new Date(order.createdAt).toLocaleString("en-IN", {
//         dateStyle: "full",
//         timeStyle: "short",
//         timeZone: "Asia/Kolkata",
//       }),
      
//       // Customer details
//       CustomerName: order.customer?.firstName 
//         ? `${order.customer.firstName} ${order.customer.lastName || ""}`.trim()
//         : order.customer?.email || "Customer",
//       CustomerEmail: order.customer?.email || "N/A",
//       CustomerPhone: order.customer?.phone || "N/A",

//       // Delivery Address
//       DeliveryAddress: formatAddress(order.address),

//       // Shop-specific order items HTML
//       OrderItemsHTML: generateShopOrderItemsHTML(shopItems),

//       // Shop-specific pricing breakdown
//       SubtotalBeforeDiscount: formatCurrency(shopCalculations.originalSubtotal),
//       ProductDiscounts: formatCurrency(shopCalculations.productDiscounts),
//       FlashSaleDiscounts: formatCurrency(shopCalculations.flashSaleDiscounts),
//       PricingRuleDiscounts: formatCurrency(shopCalculations.pricingRuleDiscounts),
//       UpsellDiscounts: formatCurrency(shopCalculations.upsellDiscounts),
//       CouponDiscount: formatCurrency(shopCalculations.couponDiscount),
//       SubtotalAfterDiscounts: formatCurrency(shopCalculations.subtotal),
//       TaxAmount: formatCurrency(shopCalculations.taxes),
//       ShippingAmount: formatCurrency(shopCalculations.shipping),
//       TotalAmount: formatCurrency(shopCalculations.total),

//       // Shipment status
//       ShipmentStatus: shipment?.status || "pending",
//       TrackingId: shipment?.trackingId || "Not yet assigned",

//       // Login link
//       LoginButton: `
//   <div style="text-align:center; margin:25px 0;">
//     <a href="https://test-dobby.vercel.app/?form=shopkeeper-signin"
//        style="background:#000; color:#fff; padding:12px 22px;
//               text-decoration:none; border-radius:6px;
//               font-weight:bold; display:inline-block;">
//        Login to Your Panel
//     </a>
//   </div>
// `,
//     };

//     // Replace placeholders in mail body
//     let mailBody = template.mailBody;
//     for (const [key, value] of Object.entries(placeholders)) {
//       mailBody = mailBody.replace(new RegExp(`{${key}}`, "g"), value);
//     }

//     // Build page links HTML
//     let pageLinksHtml = "";
//     for (const [key, value] of Object.entries(template.pageLinks || {})) {
//       if (value.enabled) {
//         pageLinksHtml += `<a href="${value.url}" style="margin:0 8px; color:#000; text-decoration:none; text-transform:capitalize;">${key.replace(/([A-Z])/g, " $1")}</a>`;
//       }
//     }

//     // Build social media links HTML
//     const iconMap = {
//       facebook: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
//       instagram: "https://cdn-icons-png.flaticon.com/512/733/733558.png",
//       X: "https://cdn-icons-png.flaticon.com/512/5969/5969020.png",
//       linkedin: "https://cdn-icons-png.flaticon.com/512/733/733561.png",
//       youtube: "https://cdn-icons-png.flaticon.com/512/733/733646.png",
//     };

//     let socialLinksHtml = "";
//     for (const [key, value] of Object.entries(template.socialMediaLinks || {})) {
//       if (value.enabled && value.url) {
//         const iconUrl = iconMap[key] || "https://cdn-icons-png.flaticon.com/512/733/733585.png";
//         socialLinksHtml += `
//           <a href="${value.url}" style="margin:0 5px;" target="_blank">
//             <img src="${iconUrl}" alt="${key}" height="22" style="vertical-align:middle; display:inline-block;"/>
//           </a>
//         `;
//       }
//     }

//     // Generate final HTML email
//     const htmlContent = `
//       <div style="font-family: Arial, sans-serif; max-width:650px; margin:0 auto; padding:20px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
//         <!-- Logo -->
//         <div style="text-align:center; margin-bottom:20px;">
//           <img src="${template.logoUrl}" alt="Logo" style="width:100px; height:100px; object-fit:contain; border-radius:8px;"/>
//         </div>
        
//         <!-- Title -->
//         <h2 style="color:#333; text-align:center;">${template.title}</h2>
        
//         <!-- Mail Body -->
//         <div style="color:#555; font-size:15px; line-height:1.6;">
//           ${mailBody}
//         </div>
        
//         <!-- Order Summary Table -->
//         ${generateShopOrderSummaryHTML(shopItems, shopCalculations)}
        
//         <!-- Footer Section -->
//         <p style="color:#555; font-size:14px; line-height:1.6; margin-top:30px;">
//           ${template.footerSectionText || ""}
//         </p>
        
//         <!-- Icon -->
//         ${template.iconUrl ? `<div style="text-align:center; margin:20px 0;"><img src="${template.iconUrl}" alt="Icon" style="height:60px;"/></div>` : ""}
        
//         <!-- Page Links -->
//         ${pageLinksHtml ? `<div style="margin-top:20px; text-align:center;">${pageLinksHtml}</div>` : ""}
        
//         <!-- Social Links -->
//         ${socialLinksHtml ? `<div style="margin-top:20px; text-align:center;">${socialLinksHtml}</div>` : ""}
        
//         <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
        
//         <!-- Copyright -->
//         <p style="font-size:12px; color:#888; text-align:center;">
//           ${template.copyrightText || ""}
//         </p>
//       </div>
//     `;

//     // Send email
//     await sendEmail(
//       shopkeeper.email,
//       template.title || "New Order Received",
//       htmlContent
//     );

//     logger.info({
//       event: "SHOPKEEPER_ORDER_EMAIL_SENT",
//       orderId: order._id,
//       orderNumber: order.orderNumber,
//       shopId,
//       shopkeeperEmail: shopkeeper.email,
//       itemCount: shopItems.length,
//       total: shopCalculations.total,
//     });

//     return true;
//   } catch (err) {
//     logger.error({
//       event: "SHOPKEEPER_ORDER_EMAIL_FAILED",
//       orderId: order?._id,
//       shopId,
//       error: err.message,
//       stack: err.stack,
//     });
//     return false;
//   }
// }


// async function sendOrderNotificationsToShopkeepers(order) {
//   try {
//     // Populate order details BEFORE processing
//     // We need product, shop, address, and customer details
//     if (typeof order.populate === 'function') {
//         await order.populate([
//             { path: "items.product" },
//             { path: "items.shop" },
//             { path: "address" },
//             { path: "customer" }
//         ]);
//     }

//     // Get unique shop IDs from order items
//     // Safely handle item.shop which might be null or an object or an ID
//     const shopIds = [...new Set(order.items
//         .filter(item => item.shop) 
//         .map(item => (item.shop._id || item.shop).toString())
//     )];

//     logger.info({
//       event: "SENDING_SHOPKEEPER_NOTIFICATIONS",
//       orderId: order._id,
//       orderNumber: order.orderNumber,
//       shopCount: shopIds.length,
//       shopIds,
//     });

//     // Send email to each shopkeeper
//     const emailPromises = shopIds.map(shopId => 
//       sendShopkeeperOrderEmail(order, shopId)
//     );

//     const results = await Promise.allSettled(emailPromises);

//     const successCount = results.filter(r => r.status === 'fulfilled' && r.value).length;
//     const failCount = results.filter(r => r.status === 'rejected' || !r.value).length;

//     logger.info({
//       event: "SHOPKEEPER_NOTIFICATIONS_COMPLETE",
//       orderId: order._id,
//       totalShops: shopIds.length,
//       successCount,
//       failCount,
//     });

//     return {
//       success: successCount,
//       failed: failCount,
//       total: shopIds.length,
//     };
//   } catch (err) {
//     logger.error({
//       event: "SHOPKEEPER_NOTIFICATIONS_ERROR",
//       orderId: order?._id,
//       error: err.message,
//       stack: err.stack,
//     });
//     return {
//       success: 0,
//       failed: 0,
//       total: 0,
//       error: err.message,
//     };
//   }
// }

// // Helper: Calculate shop-specific order totals
// function calculateShopOrderTotals(shopItems, fullOrder) {
//   let originalSubtotal = 0;
//   let productDiscounts = 0;
//   let flashSaleDiscounts = 0;
//   let pricingRuleDiscounts = 0;
//   let upsellDiscounts = 0;
//   let subtotal = 0;
//   let taxes = 0;
//   let shipping = 0;

//   for (const item of shopItems) {
//     const qty = item.quantity;
    
//     // Original price
//     originalSubtotal += item.originalPrice * qty;

//     // Discounts
//     productDiscounts += (item.productDiscountAmount || 0) * qty;
    
//     if (item.flashSale?.discountAmount) {
//       flashSaleDiscounts += item.flashSale.discountAmount * qty;
//     }
    
//     if (item.pricingRule?.discountAmount) {
//       pricingRuleDiscounts += item.pricingRule.discountAmount * qty;
//     }
    
//     if (item.upsellCrossSell?.discountAmount) {
//       upsellDiscounts += item.upsellCrossSell.discountAmount * qty;
//     }

//     // Subtotal (line total before tax)
//     subtotal += item.lineTotalBeforeCoupon || (item.finalUnitPrice * qty);

//     // Tax
//     taxes += (item.taxAmount || 0) * qty;

//     // Shipping (allocated)
//     shipping += item.allocatedShipping || 0;
//   }

//   // Coupon discount (shop-specific from order)
//   let couponDiscount = 0;
//   if (fullOrder.appliedCoupon?.discountAmount && shopItems.length > 0) {
//     // Safely get shop ID from the first item (assuming all items in shopItems belong to same shop)
//     const firstItemShop = shopItems[0].shop;
//     const shopId = (firstItemShop._id || firstItemShop).toString();
    
//     if (fullOrder.appliedCoupon.shop?.toString() === shopId) {
//       couponDiscount = fullOrder.appliedCoupon.discountAmount;
//     }
//   }

//   const total = subtotal + taxes + shipping;

//   return {
//     originalSubtotal,
//     productDiscounts,
//     flashSaleDiscounts,
//     pricingRuleDiscounts,
//     upsellDiscounts,
//     couponDiscount,
//     subtotal,
//     taxes,
//     shipping,
//     total,
//   };
// }


// function generateShopOrderItemsHTML(shopItems) {
//   let html = `
//     <table style="width:100%; border-collapse:collapse; margin:20px 0;">
//       <thead>
//         <tr style="background:#f5f5f5;">
//           <th style="padding:10px; text-align:left; border-bottom:2px solid #ddd;">Product</th>
//           <th style="padding:10px; text-align:center; border-bottom:2px solid #ddd;">SKU</th>
//           <th style="padding:10px; text-align:center; border-bottom:2px solid #ddd;">Qty</th>
//           <th style="padding:10px; text-align:right; border-bottom:2px solid #ddd;">Unit Price</th>
//           <th style="padding:10px; text-align:right; border-bottom:2px solid #ddd;">Total</th>
//         </tr>
//       </thead>
//       <tbody>
//   `;

//   for (const item of shopItems) {
//     html += `
//       <tr>
//         <td style="padding:10px; border-bottom:1px solid #eee;">${item.name}</td>
//         <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${item.sku || "N/A"}</td>
//         <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${item.quantity}</td>
//         <td style="padding:10px; text-align:right; border-bottom:1px solid #eee;">${formatCurrency(item.originalPrice)}</td>
//         <td style="padding:10px; text-align:right; border-bottom:1px solid #eee;">${formatCurrency(item.originalPrice * item.quantity)}</td>
//       </tr>
//     `;
//   }

//   html += `
//       </tbody>
//     </table>
//   `;

//   return html;
// }


// function generateShopOrderSummaryHTML(shopItems, calculations) {
//   return `
//     <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0;">
//       <h3 style="margin:0 0 15px 0; color:#333;">Your Order Summary</h3>
      
//       <table style="width:100%; border-collapse:collapse;">
//         <!-- Original Subtotal -->
//         <tr>
//           <td style="padding:8px 0; color:#666;">Item Price</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(calculations.originalSubtotal)}</td>
//         </tr>
        
//         <!-- Product Discounts -->
//         ${calculations.productDiscounts > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#28a745;">Product Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#28a745;">-${formatCurrency(calculations.productDiscounts)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Flash Sale Discounts -->
//         ${calculations.flashSaleDiscounts > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#ff6b6b;">Flash Sale Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#ff6b6b;">-${formatCurrency(calculations.flashSaleDiscounts)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Pricing Rule Discounts -->
//         ${calculations.pricingRuleDiscounts > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#9b59b6;">Special Offer Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#9b59b6;">-${formatCurrency(calculations.pricingRuleDiscounts)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Upsell Discounts -->
//         ${calculations.upsellDiscounts > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#3498db;">Bundle Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#3498db;">-${formatCurrency(calculations.upsellDiscounts)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Coupon Discount -->
//         ${calculations.couponDiscount > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#e74c3c;">Coupon Discount</td>
//           <td style="padding:8px 0; text-align:right; color:#e74c3c;">-${formatCurrency(calculations.couponDiscount)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Subtotal -->
//         <tr style="border-top:2px solid #ddd;">
//           <td style="padding:12px 0; font-weight:600;">Subtotal</td>
//           <td style="padding:12px 0; text-align:right; font-weight:600;">${formatCurrency(calculations.subtotal)}</td>
//         </tr>
        
//         <!-- Tax -->
//         ${calculations.taxes > 0 ? `
//         <tr>
//           <td style="padding:8px 0; color:#666;">Tax</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(calculations.taxes)}</td>
//         </tr>
//         ` : ""}
        
//         <!-- Shipping -->
//         <tr>
//           <td style="padding:8px 0; color:#666;">Shipping</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(calculations.shipping)}</td>
//         </tr>
        
//         <!-- Total -->
//         <tr style="border-top:2px solid #333;">
//           <td style="padding:15px 0; font-size:18px; font-weight:bold; color:#333;">Your Total</td>
//           <td style="padding:15px 0; text-align:right; font-size:18px; font-weight:bold; color:#333;">${formatCurrency(calculations.total)}</td>
//         </tr>
//       </table>
      
//       <div style="margin-top:15px; padding:12px; background:#fff3cd; border-left:4px solid #ffc107; border-radius:4px;">
//         <p style="margin:0; color:#856404; font-size:13px;">
//           <strong>Note:</strong> This shows only items from your shop. Customer may have ordered from multiple shops.
//         </p>
//       </div>
//     </div>
//   `;
// }


// function formatAddress(address) {
//   if (!address) return "Address not available";

//   return `
//     ${address.name || ""}<br/>
//     ${address.address1 || ""}<br/>
//     ${address.address2 ? address.address2 + "<br/>" : ""}
//     ${address.city || ""}, ${address.state || ""} ${address.pincode || ""}<br/>
//     ${address.phone ? "Phone: " + address.phone : ""}
//   `;
// }


// function formatCurrency(amount) {
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//   }).format(amount || 0);
// }

// module.exports = {
//   sendShopkeeperOrderEmail,
//   sendOrderNotificationsToShopkeepers,
//   calculateShopOrderTotals,
// };