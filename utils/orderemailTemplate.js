const CustomerMailTemplate = require("../models/CustomerMailTemplate");
const { sendEmail } = require("../utils/mailer");
const logger = require("../config/logger");

/**
 * Generate and send order placement confirmation email
 * @param {Object} order - Order document from database
 * @param {Object} customer - Customer document
 */
async function sendOrderPlacementEmail(order, customer) {
  try {
    // Fetch order place template
    const template = await CustomerMailTemplate.findOne({
      templateType: "order_place",
      isActive: true,
    });

    if (!template) {
      logger.warn("Order place email template not found or inactive");
      return;
    }

    // Populate order details if needed
    await order.populate("items.product items.shop address");

    // Calculate discount breakdown
    const discountBreakdown = calculateOrderDiscounts(order);

    const trackUrl = `https://test-dobby.vercel.app/user/orders`;

    // Build dynamic placeholders
    const placeholders = {
      Name: customer.firstName || customer.email?.split("@")[0] || "Customer",
      OrderNumber: order.orderNumber,
      OrderDate: new Date(order.createdAt).toLocaleString("en-IN", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }),

      // Delivery Address
      DeliveryName: order.address?.name || customer.firstName || "",
      DeliveryAddress: formatAddress(order.address),

      // Order Items HTML
      OrderItemsHTML: generateOrderItemsHTML(order.items),

      // Pricing breakdown
      SubtotalBeforeDiscount: formatCurrency(
        calculateOriginalSubtotal(order.items)
      ),
      ProductDiscounts: formatCurrency(discountBreakdown.productDiscounts),
      FlashSaleDiscounts: formatCurrency(discountBreakdown.flashSaleDiscounts),
      PricingRuleDiscounts: formatCurrency(
        discountBreakdown.pricingRuleDiscounts
      ),
      UpsellDiscounts: formatCurrency(discountBreakdown.upsellDiscounts),
      CouponDiscount: formatCurrency(order.appliedCoupon?.discountAmount || 0),
      SubtotalAfterDiscounts: formatCurrency(order.subtotal),
      TaxAmount: formatCurrency(order.taxes || 0),
      ShippingAmount: formatCurrency(order.shipping || 0),
      TotalAmount: formatCurrency(order.total),
      TrackOrderButton: `
  <div style="text-align:center; margin:35px 0;">
    <a href="${trackUrl}"
       style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color:#ffffff; 
              padding:16px 40px;
              text-decoration:none; 
              border-radius:50px;
              font-weight:600; 
              font-size:15px;
              display:inline-block;
              letter-spacing:0.5px;
              box-shadow:0 8px 20px rgba(102, 126, 234, 0.3);
              transition:all 0.3s ease;">
       Track Your Order →
    </a>
  </div>
`,
    };

    // Replace placeholders in mail body
    let mailBody = template.mailBody;
    for (const [key, value] of Object.entries(placeholders)) {
      mailBody = mailBody.replace(new RegExp(`{${key}}`, "g"), value);
    }

    // Build page links HTML
    let pageLinksHtml = "";
    for (const [key, value] of Object.entries(template.pageLinks || {})) {
      if (value.enabled) {
        pageLinksHtml += `<a href="${
          value.url
        }" style="margin:0 15px; 
                         color:#667eea; 
                         text-decoration:none; 
                         text-transform:capitalize;
                         font-weight:500;
                         font-size:13px;
                         transition:color 0.3s ease;">${key.replace(
          /([A-Z])/g,
          " $1"
        )}</a>`;
      }
    }

    // Build social media links HTML
    const iconMap = {
      facebook:
        "https://res.cloudinary.com/demo/image/upload/v1729600000/facebook-black.png",
      instagram:
        "https://res.cloudinary.com/demo/image/upload/v1729600000/instagram-black.png",
      X: "https://res.cloudinary.com/demo/image/upload/v1729600000/x-black.png",
      linkedin:
        "https://res.cloudinary.com/demo/image/upload/v1729600000/linkedin-black.png",
      youtube:
        "https://res.cloudinary.com/demo/image/upload/v1729600000/youtube-black.png",
    };

    let socialLinksHtml = "";
    for (const [key, value] of Object.entries(
      template.socialMediaLinks || {}
    )) {
      if (value.enabled && value.url) {
        const iconUrl =
          iconMap[key] ||
          "https://res.cloudinary.com/demo/image/upload/v1729600000/link-black.png";
        socialLinksHtml += `
          <a href="${value.url}" 
             style="margin:0 8px;
                    display:inline-block;
                    opacity:0.7;
                    transition:opacity 0.3s ease;" 
             target="_blank">
            <img src="${iconUrl}" 
                 alt="${key}" 
                 height="24" 
                 style="vertical-align:middle; display:inline-block;"/>
          </a>
        `;
      }
    }

    // Generate final HTML email
    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin:0; padding:0; background:#f5f7fa; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <div style="max-width:680px; margin:40px auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.08);">
          
          <!-- Header Section with Gradient -->
          <div style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:40px 30px; text-align:center; position:relative;">
            <div style="background:rgba(255,255,255,0.15); backdrop-filter:blur(10px); border-radius:12px; padding:20px; display:inline-block;">
              <img src="${template.logoUrl}" 
                   alt="Logo" 
                   style="width:80px; height:80px; object-fit:contain; border-radius:12px; background:#ffffff; padding:10px;"/>
            </div>
            <h1 style="color:#ffffff; margin:20px 0 0 0; font-size:28px; font-weight:700; letter-spacing:-0.5px;">
              ${template.title}
            </h1>
          </div>
          
          <!-- Main Content -->
          <div style="padding:45px 40px;">
            
            <!-- Mail Body -->
            <div style="color:#2d3748; font-size:15px; line-height:1.8; margin-bottom:35px;">
              ${mailBody}
            </div>
            
            <!-- Order Items Card -->
            <div style="background:#f8fafc; border-radius:12px; padding:25px; margin-bottom:30px; border:1px solid #e2e8f0;">
              <h3 style="margin:0 0 20px 0; color:#1a202c; font-size:18px; font-weight:600; border-bottom:2px solid #667eea; padding-bottom:12px; display:inline-block;">
                Order Items
              </h3>
              ${generateOrderItemsHTML(order.items)}
            </div>
            
            <!-- Order Summary -->
            ${generateOrderSummaryHTML(order, discountBreakdown)}
            
            <!-- Track Order Button -->
            ${placeholders.TrackOrderButton}
            
            <!-- Footer Section Text -->
            ${template.footerSectionText ? `
            <div style="background:#f8fafc; border-left:4px solid #667eea; padding:20px 25px; border-radius:8px; margin:30px 0;">
              <p style="color:#4a5568; font-size:14px; line-height:1.7; margin:0;">
                ${template.footerSectionText}
              </p>
            </div>
            ` : ""}
            
            <!-- Icon -->
            ${
              template.iconUrl
                ? `<div style="text-align:center; margin:30px 0;">
                     <img src="${template.iconUrl}" 
                          alt="Icon" 
                          style="height:50px; opacity:0.8;"/>
                   </div>`
                : ""
            }
            
          </div>
          
          <!-- Footer -->
          <div style="background:#f8fafc; padding:35px 40px; border-top:1px solid #e2e8f0;">
            
            <!-- Page Links -->
            ${
              pageLinksHtml
                ? `<div style="text-align:center; margin-bottom:25px;">
                     ${pageLinksHtml}
                   </div>`
                : ""
            }
            
            <!-- Social Links -->
            ${
              socialLinksHtml
                ? `<div style="text-align:center; margin-bottom:25px;">
                     ${socialLinksHtml}
                   </div>`
                : ""
            }
            
            <!-- Copyright -->
            <div style="text-align:center; padding-top:20px; border-top:1px solid #e2e8f0;">
              <p style="font-size:12px; color:#718096; margin:0; line-height:1.6;">
                ${template.copyrightText || ""}
              </p>
            </div>
          </div>
          
        </div>
      </body>
      </html>
    `;

    // Send email
    await sendEmail(
      customer.email,
      template.title || "Order Confirmation",
      htmlContent
    );

    logger.info({
      event: "ORDER_PLACEMENT_EMAIL_SENT",
      orderId: order._id,
      orderNumber: order.orderNumber,
      customerEmail: customer.email,
    });

    return true;
  } catch (err) {
    logger.error({
      event: "ORDER_PLACEMENT_EMAIL_FAILED",
      orderId: order?._id,
      error: err.message,
      stack: err.stack,
    });
    return false;
  }
}

// Helper: Generate order items HTML table
function generateOrderItemsHTML(items) {
  let html = `
    <table style="width:100%; border-collapse:collapse;">
      <thead>
        <tr>
          <th style="padding:14px 12px; 
                     text-align:left; 
                     background:#667eea; 
                     color:#ffffff; 
                     font-weight:600; 
                     font-size:13px; 
                     letter-spacing:0.5px;
                     border-top-left-radius:8px;">
            PRODUCT
          </th>
          <th style="padding:14px 12px; 
                     text-align:center; 
                     background:#667eea; 
                     color:#ffffff; 
                     font-weight:600; 
                     font-size:13px; 
                     letter-spacing:0.5px;">
            QTY
          </th>
          <th style="padding:14px 12px; 
                     text-align:right; 
                     background:#667eea; 
                     color:#ffffff; 
                     font-weight:600; 
                     font-size:13px; 
                     letter-spacing:0.5px;
                     border-top-right-radius:8px;">
            PRICE
          </th>
        </tr>
      </thead>
      <tbody>
  `;

  for (const item of items) {
    html += `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:16px 12px; color:#2d3748; font-size:14px; font-weight:500;">
          ${item.name}
        </td>
        <td style="padding:16px 12px; 
                   text-align:center; 
                   color:#4a5568; 
                   font-size:14px;
                   background:#f8fafc;
                   font-weight:600;">
          ${item.quantity}
        </td>
        <td style="padding:16px 12px; 
                   text-align:right; 
                   color:#1a202c; 
                   font-size:14px; 
                   font-weight:600;">
          ${formatCurrency(item.originalPrice)}
        </td>
      </tr>
    `;
  }

  html += `
      </tbody>
    </table>
  `;

  return html;
}

// Helper: Generate complete order summary with discounts
function generateOrderSummaryHTML(order, discountBreakdown) {
  const originalSubtotal = calculateOriginalSubtotal(order.items);

  return `
    <div style="background:linear-gradient(135deg, #f8fafc 0%, #e6f2ff 100%); 
                padding:30px; 
                border-radius:12px; 
                border:1px solid #e2e8f0;
                box-shadow:0 4px 15px rgba(102, 126, 234, 0.08);">
      
      <h3 style="margin:0 0 25px 0; 
                 color:#1a202c; 
                 font-size:20px; 
                 font-weight:700;
                 display:flex;
                 align-items:center;">
        <span style="display:inline-block; 
                     width:4px; 
                     height:24px; 
                     background:#667eea; 
                     margin-right:12px; 
                     border-radius:2px;"></span>
        Order Summary
      </h3>
      
      <table style="width:100%; border-collapse:collapse;">
        <!-- Original Subtotal -->
        <tr>
          <td style="padding:10px 0; color:#4a5568; font-size:14px;">Item Price</td>
          <td style="padding:10px 0; text-align:right; color:#2d3748; font-weight:500; font-size:14px;">
            ${formatCurrency(originalSubtotal)}
          </td>
        </tr>
        
        <!-- Product Discounts -->
        ${
          discountBreakdown.productDiscounts > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#10b981; font-size:14px; font-weight:500;">
            <span style="display:inline-block; margin-right:6px;">💰</span> Product Discounts
          </td>
          <td style="padding:10px 0; text-align:right; color:#10b981; font-weight:600; font-size:14px;">
            -${formatCurrency(discountBreakdown.productDiscounts)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Flash Sale Discounts -->
        ${
          discountBreakdown.flashSaleDiscounts > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#f59e0b; font-size:14px; font-weight:500;">
            <span style="display:inline-block; margin-right:6px;">⚡</span> Flash Sale Discounts
          </td>
          <td style="padding:10px 0; text-align:right; color:#f59e0b; font-weight:600; font-size:14px;">
            -${formatCurrency(discountBreakdown.flashSaleDiscounts)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Pricing Rule Discounts -->
        ${
          discountBreakdown.pricingRuleDiscounts > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#8b5cf6; font-size:14px; font-weight:500;">
            <span style="display:inline-block; margin-right:6px;">🎁</span> Special Offer Discounts
          </td>
          <td style="padding:10px 0; text-align:right; color:#8b5cf6; font-weight:600; font-size:14px;">
            -${formatCurrency(discountBreakdown.pricingRuleDiscounts)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Upsell Discounts -->
        ${
          discountBreakdown.upsellDiscounts > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#3b82f6; font-size:14px; font-weight:500;">
            <span style="display:inline-block; margin-right:6px;">📦</span> Bundle Discounts
          </td>
          <td style="padding:10px 0; text-align:right; color:#3b82f6; font-weight:600; font-size:14px;">
            -${formatCurrency(discountBreakdown.upsellDiscounts)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Coupon Discount -->
        ${
          order.appliedCoupon?.discountAmount > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#ef4444; font-size:14px; font-weight:500;">
            <span style="display:inline-block; margin-right:6px;">🎟️</span> Coupon Discount ${
            order.appliedCoupon.couponId ? "(Applied)" : ""
          }
          </td>
          <td style="padding:10px 0; text-align:right; color:#ef4444; font-weight:600; font-size:14px;">
            -${formatCurrency(order.appliedCoupon.discountAmount)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Subtotal after discounts -->
        <tr style="border-top:2px solid #cbd5e0; border-bottom:2px solid #cbd5e0;">
          <td style="padding:16px 0; font-weight:600; color:#1a202c; font-size:15px;">Subtotal</td>
          <td style="padding:16px 0; text-align:right; font-weight:700; color:#1a202c; font-size:15px;">
            ${formatCurrency(order.subtotal)}
          </td>
        </tr>
        
        <!-- Tax -->
        ${
          order.taxes > 0
            ? `
        <tr>
          <td style="padding:10px 0; color:#4a5568; font-size:14px;">Tax</td>
          <td style="padding:10px 0; text-align:right; color:#2d3748; font-weight:500; font-size:14px;">
            ${formatCurrency(order.taxes)}
          </td>
        </tr>
        `
            : ""
        }
        
        <!-- Shipping -->
        <tr>
          <td style="padding:10px 0; color:#4a5568; font-size:14px;">Delivery Fee</td>
          <td style="padding:10px 0; text-align:right; color:#2d3748; font-weight:500; font-size:14px;">
            ${formatCurrency(order.shipping)}
          </td>
        </tr>
        
        <!-- Total -->
        <tr style="border-top:3px solid #667eea;">
          <td style="padding:20px 0 0 0; font-size:18px; font-weight:700; color:#1a202c;">
            Total Amount
          </td>
          <td style="padding:20px 0 0 0; text-align:right; font-size:20px; font-weight:700; color:#667eea;">
            ${formatCurrency(order.total)}
          </td>
        </tr>
      </table>
      
      <!-- Delivery Address -->
      <div style="margin-top:30px; 
                  padding:25px; 
                  background:#ffffff; 
                  border-radius:10px; 
                  border-left:4px solid #667eea;
                  box-shadow:0 2px 8px rgba(0,0,0,0.04);">
        <h4 style="margin:0 0 12px 0; 
                   color:#1a202c; 
                   font-size:16px; 
                   font-weight:600;
                   display:flex;
                   align-items:center;">
          <span style="display:inline-block; margin-right:8px; font-size:18px;">📍</span>
          Delivery Address
        </h4>
        <div style="color:#4a5568; font-size:14px; line-height:1.7;">
          ${formatAddress(order.address)}
        </div>
      </div>
    </div>
  `;
}

// Helper: Calculate discount breakdown from order items
function calculateOrderDiscounts(order) {
  let productDiscounts = 0;
  let flashSaleDiscounts = 0;
  let pricingRuleDiscounts = 0;
  let upsellDiscounts = 0;

  for (const item of order.items) {
    productDiscounts += (item.productDiscountAmount || 0) * item.quantity;

    if (item.flashSale?.discountAmount) {
      flashSaleDiscounts += item.flashSale.discountAmount * item.quantity;
    }

    if (item.pricingRule?.discountAmount) {
      pricingRuleDiscounts += item.pricingRule.discountAmount * item.quantity;
    }

    if (item.upsellCrossSell?.discountAmount) {
      upsellDiscounts += item.upsellCrossSell.discountAmount * item.quantity;
    }
  }

  return {
    productDiscounts,
    flashSaleDiscounts,
    pricingRuleDiscounts,
    upsellDiscounts,
  };
}

// Helper: Calculate original subtotal (before any discounts)
function calculateOriginalSubtotal(items) {
  return items.reduce(
    (sum, item) => sum + item.originalPrice * item.quantity,
    0
  );
}

// Helper: Format address
function formatAddress(address) {
  if (!address) return "Address not available";

  return `
    <strong style="color:#2d3748;">${address.name || ""}</strong><br/>
    ${address.address1 || ""}<br/>
    ${address.address2 ? address.address2 + "<br/>" : ""}
    ${address.city || ""}, ${address.state || ""} ${address.pincode || ""}<br/>
    ${address.phone ? '<span style="color:#667eea;">📞 ' + address.phone + '</span>' : ""}
  `;
}

// Helper: Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(amount || 0);
}

module.exports = {
  sendOrderPlacementEmail,
  generateOrderItemsHTML,
  generateOrderSummaryHTML,
  calculateOrderDiscounts,
};
// const CustomerMailTemplate = require("../models/CustomerMailTemplate");
// const { sendEmail } = require("../utils/mailer");
// const logger = require("../config/logger");

// /**
//  * Generate and send order placement confirmation email
//  * @param {Object} order - Order document from database
//  * @param {Object} customer - Customer document
//  */
// async function sendOrderPlacementEmail(order, customer) {
//   try {
//     // Fetch order place template
//     const template = await CustomerMailTemplate.findOne({
//       templateType: "order_place",
//       isActive: true,
//     });

//     if (!template) {
//       logger.warn("Order place email template not found or inactive");
//       return;
//     }

//     // Populate order details if needed
//     await order.populate("items.product items.shop address");

//     // Calculate discount breakdown
//     const discountBreakdown = calculateOrderDiscounts(order);

//     const trackUrl = `https://test-dobby.vercel.app/user/orders`;

//     // Build dynamic placeholders
//     const placeholders = {
//       Name: customer.firstName || customer.email?.split("@")[0] || "Customer",
//       OrderNumber: order.orderNumber,
//       OrderDate: new Date(order.createdAt).toLocaleString("en-IN", {
//         dateStyle: "full",
//         timeStyle: "short",
//         timeZone: "Asia/Kolkata",
//       }),

//       // Delivery Address
//       DeliveryName: order.address?.name || customer.firstName || "",
//       DeliveryAddress: formatAddress(order.address),

//       // Order Items HTML
//       OrderItemsHTML: generateOrderItemsHTML(order.items),

//       // Pricing breakdown
//       SubtotalBeforeDiscount: formatCurrency(
//         calculateOriginalSubtotal(order.items)
//       ),
//       ProductDiscounts: formatCurrency(discountBreakdown.productDiscounts),
//       FlashSaleDiscounts: formatCurrency(discountBreakdown.flashSaleDiscounts),
//       PricingRuleDiscounts: formatCurrency(
//         discountBreakdown.pricingRuleDiscounts
//       ),
//       UpsellDiscounts: formatCurrency(discountBreakdown.upsellDiscounts),
//       CouponDiscount: formatCurrency(order.appliedCoupon?.discountAmount || 0),
//       SubtotalAfterDiscounts: formatCurrency(order.subtotal),
//       TaxAmount: formatCurrency(order.taxes || 0),
//       ShippingAmount: formatCurrency(order.shipping || 0),
//       TotalAmount: formatCurrency(order.total),
//       TrackOrderButton: `
//   <div style="text-align:center; margin:25px 0;">
//     <a href="${trackUrl}"
//        style="background:#000; color:#fff; padding:12px 22px;
//               text-decoration:none; border-radius:6px;
//               font-weight:bold; display:inline-block;">
//        Track Your Order
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
//         pageLinksHtml += `<a href="${
//           value.url
//         }" style="margin:0 8px; color:#000; text-decoration:none; text-transform:capitalize;">${key.replace(
//           /([A-Z])/g,
//           " $1"
//         )}</a>`;
//       }
//     }

//     // Build social media links HTML
//     const iconMap = {
//       facebook:
//         "https://res.cloudinary.com/demo/image/upload/v1729600000/facebook-black.png",
//       instagram:
//         "https://res.cloudinary.com/demo/image/upload/v1729600000/instagram-black.png",
//       X: "https://res.cloudinary.com/demo/image/upload/v1729600000/x-black.png",
//       linkedin:
//         "https://res.cloudinary.com/demo/image/upload/v1729600000/linkedin-black.png",
//       youtube:
//         "https://res.cloudinary.com/demo/image/upload/v1729600000/youtube-black.png",
//     };

//     let socialLinksHtml = "";
//     for (const [key, value] of Object.entries(
//       template.socialMediaLinks || {}
//     )) {
//       if (value.enabled && value.url) {
//         const iconUrl =
//           iconMap[key] ||
//           "https://res.cloudinary.com/demo/image/upload/v1729600000/link-black.png";
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
//           <img src="${
//             template.logoUrl
//           }" alt="Logo" style="width:100px; height:100px; object-fit:contain; border-radius:8px;"/>
//         </div>
        
//         <!-- Title -->
//         <h2 style="color:#333; text-align:center;">${template.title}</h2>
        
//         <!-- Mail Body with Order Details -->
//         <div style="color:#555; font-size:15px; line-height:1.6;">
//           ${mailBody}
//         </div>
        
//         <!-- Order Summary Table -->
//         ${generateOrderSummaryHTML(order, discountBreakdown)}
        
//         <!-- Footer Section -->
//         <p style="color:#555; font-size:14px; line-height:1.6; margin-top:30px;">
//           ${template.footerSectionText || ""}
//         </p>
        
//         <!-- Icon -->
//         ${
//           template.iconUrl
//             ? `<div style="text-align:center; margin:20px 0;"><img src="${template.iconUrl}" alt="Icon" style="height:60px;"/></div>`
//             : ""
//         }
        
//         <!-- Page Links -->
//         ${
//           pageLinksHtml
//             ? `<div style="margin-top:20px; text-align:center;">${pageLinksHtml}</div>`
//             : ""
//         }
        
//         <!-- Social Links -->
//         ${
//           socialLinksHtml
//             ? `<div style="margin-top:20px; text-align:center;">${socialLinksHtml}</div>`
//             : ""
//         }
        
//         <hr style="border:none; border-top:1px solid #e0e0e0; margin:20px 0;"/>
        
//         <!-- Copyright -->
//         <p style="font-size:12px; color:#888; text-align:center;">
//           ${template.copyrightText || ""}
//         </p>
//       </div>
//     `;

//     // Send email
//     await sendEmail(
//       customer.email,
//       template.title || "Order Confirmation",
//       htmlContent
//     );

//     logger.info({
//       event: "ORDER_PLACEMENT_EMAIL_SENT",
//       orderId: order._id,
//       orderNumber: order.orderNumber,
//       customerEmail: customer.email,
//     });

//     return true;
//   } catch (err) {
//     logger.error({
//       event: "ORDER_PLACEMENT_EMAIL_FAILED",
//       orderId: order?._id,
//       error: err.message,
//       stack: err.stack,
//     });
//     return false;
//   }
// }

// // Helper: Generate order items HTML table
// function generateOrderItemsHTML(items) {
//   let html = `
//     <table style="width:100%; border-collapse:collapse; margin:20px 0;">
//       <thead>
//         <tr style="background:#f5f5f5;">
//           <th style="padding:10px; text-align:left; border-bottom:2px solid #ddd;">Product</th>
//           <th style="padding:10px; text-align:center; border-bottom:2px solid #ddd;">Quantity</th>
//           <th style="padding:10px; text-align:right; border-bottom:2px solid #ddd;">Price</th>
//         </tr>
//       </thead>
//       <tbody>
//   `;

//   for (const item of items) {
//     html += `
//       <tr>
//         <td style="padding:10px; border-bottom:1px solid #eee;">${
//           item.name
//         }</td>
//         <td style="padding:10px; text-align:center; border-bottom:1px solid #eee;">${
//           item.quantity
//         }</td>
//         <td style="padding:10px; text-align:right; border-bottom:1px solid #eee;">${formatCurrency(
//           item.originalPrice
//         )}</td>
//       </tr>
//     `;
//   }

//   html += `
//       </tbody>
//     </table>
//   `;

//   return html;
// }

// // Helper: Generate complete order summary with discounts
// function generateOrderSummaryHTML(order, discountBreakdown) {
//   const originalSubtotal = calculateOriginalSubtotal(order.items);

//   return `
//     <div style="background:#f9f9f9; padding:20px; border-radius:8px; margin:20px 0;">
//       <h3 style="margin:0 0 15px 0; color:#333;">Order Summary</h3>
      
//       <table style="width:100%; border-collapse:collapse;">
//         <!-- Original Subtotal -->
//         <tr>
//           <td style="padding:8px 0; color:#666;">Item Price</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(
//             originalSubtotal
//           )}</td>
//         </tr>
        
//         <!-- Product Discounts -->
//         ${
//           discountBreakdown.productDiscounts > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#28a745;">Product Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#28a745;">-${formatCurrency(
//             discountBreakdown.productDiscounts
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Flash Sale Discounts -->
//         ${
//           discountBreakdown.flashSaleDiscounts > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#ff6b6b;">Flash Sale Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#ff6b6b;">-${formatCurrency(
//             discountBreakdown.flashSaleDiscounts
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Pricing Rule Discounts -->
//         ${
//           discountBreakdown.pricingRuleDiscounts > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#9b59b6;">Special Offer Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#9b59b6;">-${formatCurrency(
//             discountBreakdown.pricingRuleDiscounts
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Upsell Discounts -->
//         ${
//           discountBreakdown.upsellDiscounts > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#3498db;">Bundle Discounts</td>
//           <td style="padding:8px 0; text-align:right; color:#3498db;">-${formatCurrency(
//             discountBreakdown.upsellDiscounts
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Coupon Discount -->
//         ${
//           order.appliedCoupon?.discountAmount > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#e74c3c;">Coupon Discount (${
//             order.appliedCoupon.couponId ? "Applied" : ""
//           })</td>
//           <td style="padding:8px 0; text-align:right; color:#e74c3c;">-${formatCurrency(
//             order.appliedCoupon.discountAmount
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Subtotal after discounts -->
//         <tr style="border-top:2px solid #ddd;">
//           <td style="padding:12px 0; font-weight:600;">Subtotal</td>
//           <td style="padding:12px 0; text-align:right; font-weight:600;">${formatCurrency(
//             order.subtotal
//           )}</td>
//         </tr>
        
//         <!-- Tax -->
//         ${
//           order.taxes > 0
//             ? `
//         <tr>
//           <td style="padding:8px 0; color:#666;">Tax</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(
//             order.taxes
//           )}</td>
//         </tr>
//         `
//             : ""
//         }
        
//         <!-- Shipping -->
//         <tr>
//           <td style="padding:8px 0; color:#666;">Delivery Fee</td>
//           <td style="padding:8px 0; text-align:right; color:#666;">${formatCurrency(
//             order.shipping
//           )}</td>
//         </tr>
        
//         <!-- Total -->
//         <tr style="border-top:2px solid #333;">
//           <td style="padding:15px 0; font-size:18px; font-weight:bold; color:#333;">Total</td>
//           <td style="padding:15px 0; text-align:right; font-size:18px; font-weight:bold; color:#333;">${formatCurrency(
//             order.total
//           )}</td>
//         </tr>
//       </table>
      
//       <!-- Delivery Address -->
//       <div style="margin-top:20px; padding-top:20px; border-top:1px solid #ddd;">
//         <h4 style="margin:0 0 10px 0; color:#333;">Delivery Address</h4>
//         <p style="margin:0; color:#666; line-height:1.6;">${formatAddress(
//           order.address
//         )}</p>
//       </div>
//     </div>
//   `;
// }

// // Helper: Calculate discount breakdown from order items
// function calculateOrderDiscounts(order) {
//   let productDiscounts = 0;
//   let flashSaleDiscounts = 0;
//   let pricingRuleDiscounts = 0;
//   let upsellDiscounts = 0;

//   for (const item of order.items) {
//     productDiscounts += (item.productDiscountAmount || 0) * item.quantity;

//     if (item.flashSale?.discountAmount) {
//       flashSaleDiscounts += item.flashSale.discountAmount * item.quantity;
//     }

//     if (item.pricingRule?.discountAmount) {
//       pricingRuleDiscounts += item.pricingRule.discountAmount * item.quantity;
//     }

//     if (item.upsellCrossSell?.discountAmount) {
//       upsellDiscounts += item.upsellCrossSell.discountAmount * item.quantity;
//     }
//   }

//   return {
//     productDiscounts,
//     flashSaleDiscounts,
//     pricingRuleDiscounts,
//     upsellDiscounts,
//   };
// }

// // Helper: Calculate original subtotal (before any discounts)
// function calculateOriginalSubtotal(items) {
//   return items.reduce(
//     (sum, item) => sum + item.originalPrice * item.quantity,
//     0
//   );
// }

// // Helper: Format address
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

// // Helper: Format currency
// function formatCurrency(amount) {
//   return new Intl.NumberFormat("en-IN", {
//     style: "currency",
//     currency: "INR",
//   }).format(amount || 0);
// }

// module.exports = {
//   sendOrderPlacementEmail,
//   generateOrderItemsHTML,
//   generateOrderSummaryHTML,
//   calculateOrderDiscounts,
// };
