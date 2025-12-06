// controllers/shopCustomerController.js
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const ShopCustomerStatus = require("../models/ShopCustomerStatus");
const Shop = require("../models/Shop");
const mongoose = require("mongoose");
const Address = require("../models/Address");
const { sendEmail } = require("../utils/mailer");
const cacheService = require("../services/cacheService");

exports.getCustomersList = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { status, state, period } = req.query;

    const cacheKey = `shop:${shopId}:customers:${status || ''}:${state || ''}:${period || ''}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      let dateFilter = {};
      if (period) {
        const now = new Date();
        let fromDate = new Date();

        if (period === "7d") fromDate.setDate(now.getDate() - 7);
        else if (period === "30d") fromDate.setDate(now.getDate() - 30);
        else if (period === "3m") fromDate.setMonth(now.getMonth() - 3);

        dateFilter = { createdAt: { $gte: fromDate } };
      }

      const customers = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: "$items" },
        { $match: { "items.shop": new mongoose.Types.ObjectId(shopId) } },
        {
          $group: {
            _id: "$customer",
            totalOrders: { $addToSet: "$_id" },

            totalSpent: { $sum: "$items.lineTotalBeforeCoupon" },
            lastOrder: { $max: "$createdAt" },
            firstOrder: { $min: "$createdAt" },
          },
        },
        {
          $project: {
            _id: 1,
            totalOrders: { $size: "$totalOrders" },
            totalSpent: 1,
            lastOrder: 1,
            firstOrder: 1,
          },
        },
        {
          $lookup: {
            from: "customers",
            localField: "_id",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: "$customer" },
        {
          $lookup: {
            from: "addresses",
            localField: "_id",
            foreignField: "customer",
            as: "addresses",
          },
        },
      ]);

      const now = new Date();
      let enriched = customers.map((c) => {
        const daysSinceLast = (now - c.lastOrder) / (1000 * 60 * 60 * 24);
        let custStatus = "inactive";
        if (daysSinceLast <= 30) custStatus = "active";
        if (c.totalOrders === 1) custStatus = "new";

        const shippingAddr =
          c.addresses?.find((a) => a.type === "shipping") || c.addresses?.[0];
        const stateName = shippingAddr?.state || null;

        return {
          customerId: c._id,
          name: `${c.customer.firstName} ${c.customer.lastName}`,
          email: c.customer.email,
          phone: c.customer.phone,
          totalOrders: c.totalOrders,
          totalSpent: c.totalSpent,
          status: custStatus,
          state: stateName,
          lastOrder: c.lastOrder,
        };
      });

      if (status && ["new", "active", "inactive"].includes(status)) {
        enriched = enriched.filter((x) => x.status === status);
      }

      if (state) {
        enriched = enriched.filter(
          (x) =>
            x.state && x.state.toLowerCase().trim() === state.toLowerCase().trim()
        );
      }

      return { count: enriched.length, customers: enriched };
    });

    res.json(responseData);
  } catch (err) {
    console.error("getCustomersList error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getSingleCustomer = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const customerId = req.params.customerId;

    const cacheKey = `shop:${shopId}:customer:${customerId}:details`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const orders = await Order.aggregate([
        { $match: { customer: new mongoose.Types.ObjectId(customerId) } },
        { $unwind: "$items" },
        { $match: { "items.shop": new mongoose.Types.ObjectId(shopId) } },
        {
          $group: {
            _id: "$_id",
            createdAt: { $first: "$createdAt" },
            status: { $first: "$status" },

            totalSpentInThisShop: { $sum: "$items.lineTotalBeforeCoupon" },
          },
        },
        { $sort: { createdAt: -1 } },
      ]);

      const totalSpent = orders.reduce((s, o) => s + o.totalSpentInThisShop, 0);
      const avgOrderValue = orders.length ? totalSpent / orders.length : 0;

      const customer = await Customer.findById(customerId).select(
        "firstName lastName email phone createdAt"
      );

      return {
        customer,
        totalOrders: orders.length,
        totalSpent,
        avgOrderValue,
        orders,
      };
    });

    res.json(responseData);
  } catch (err) {
    console.error("getSingleCustomer error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getCustomerStats = async (req, res) => {
  try {
    const shopId = req.shop._id;
    
    const cacheKey = `shop:${shopId}:customerStats`;
    const stats = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const customers = await Order.aggregate([
        { $unwind: "$items" },
        { $match: { "items.shop": new mongoose.Types.ObjectId(shopId) } },
        {
          $group: {
            _id: "$customer",
            totalOrders: { $addToSet: "$_id" }, // Count unique orders, not items
            totalSpent: { $sum: "$items.lineTotalBeforeCoupon" }, // ✅ FIX: Use shop-specific item total
            lastOrder: { $max: "$createdAt" },
            firstOrder: { $min: "$createdAt" },
          },
        },
        {
          $project: {
            _id: 1,
            totalOrders: { $size: "$totalOrders" }, // Convert set to count
            totalSpent: 1,
            lastOrder: 1,
            firstOrder: 1,
          },
        },
      ]);

      const now = new Date();
      const stats = {
        totalCustomers: customers.length,
        newCustomers: 0,
        activeCustomers: 0,
        avgOrderValue: 0,
      };

      let totalValue = 0,
        totalOrders = 0;
      for (const c of customers) {
        if (c.totalOrders === 1) stats.newCustomers++;
        const days = (now - c.lastOrder) / (1000 * 60 * 60 * 24);
        if (days <= 30) stats.activeCustomers++;
        totalValue += c.totalSpent;
        totalOrders += c.totalOrders;
      }

      stats.avgOrderValue = totalOrders ? totalValue / totalOrders : 0;
      return stats;
    });

    res.json(stats);
  } catch (err) {
    console.error("getCustomerStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getViewOrders = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const customerId = req.params.customerId;

    const cacheKey = `shop:${shopId}:customer:${customerId}:orders`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const orders = await Order.aggregate([
        {
          $match: {
            customer: new mongoose.Types.ObjectId(customerId),
            "items.shop": new mongoose.Types.ObjectId(shopId),
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            _id: 1,
            orderNumber: 1,
            status: 1,
            payment: 1,
            createdAt: 1,
            items: {
              $filter: {
                input: "$items",
                as: "item",
                cond: {
                  $eq: ["$$item.shop", new mongoose.Types.ObjectId(shopId)],
                },
              },
            },

            totalAmountForThisShop: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$items",
                      as: "item",
                      cond: {
                        $eq: ["$$item.shop", new mongoose.Types.ObjectId(shopId)],
                      },
                    },
                  },
                  as: "shopItem",

                  in: "$$shopItem.lineTotalBeforeCoupon",
                },
              },
            },
          },
        },
      ]);

      const customer = await Customer.findById(customerId).select(
        "firstName lastName email phone"
      );

      return {
        success: true,
        customer,
        totalOrders: orders.length,
        orders,
      };
    });

    res.json(responseData);
  } catch (err) {
    console.error("Error fetching customer orders:", err);
    res.status(500).json({
      success: false,
      message: "Server error while fetching customer orders",
    });
  }
};

exports.getCustomerProfile = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const customerId = req.params.customerId;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    const cacheKey = `shop:${shopId}:customer:${customerId}:profile`;
    const response = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      //  Get customer basic details
      const customer = await Customer.findById(customerId).select(
        "firstName lastName email phone birthday profilePhoto profilePhotoId createdAt"
      );

      if (!customer) {
        return { error: 404, message: "Customer not found" };
      }

      //  Get addresses
      const addresses = await Address.find({ customer: customerId }).select(
        "addressLine city state country zipCode type isDefault"
      );

      //  Get orders placed in this shop
      const orders = await Order.aggregate([
        {
          $match: {
            customer: new mongoose.Types.ObjectId(customerId),
            "items.shop": new mongoose.Types.ObjectId(shopId),
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            _id: 1,
            orderNumber: 1,
            status: 1,
            payment: 1,
            createdAt: 1,
            items: {
              $filter: {
                input: "$items",
                as: "item",
                cond: {
                  $eq: ["$$item.shop", new mongoose.Types.ObjectId(shopId)],
                },
              },
            },

            totalAmountForThisShop: {
              $sum: {
                $map: {
                  input: {
                    $filter: {
                      input: "$items",
                      as: "item",
                      cond: {
                        $eq: ["$$item.shop", new mongoose.Types.ObjectId(shopId)],
                      },
                    },
                  },
                  as: "shopItem",
                  // ✅ FIX: Use lineTotalBeforeCoupon (includes tax, after discounts)
                  in: "$$shopItem.lineTotalBeforeCoupon",
                },
              },
            },
          },
        },
      ]);

      const totalSpent = orders.reduce(
        (sum, o) => sum + o.totalAmountForThisShop,
        0
      );

      return {
        success: true,
        customer,
        addresses,
        stats: {
          totalOrders: orders.length,
          totalSpent,
        },
        orders,
      };
    });

    if (response.error) {
      return res
        .status(response.error)
        .json({ success: false, message: response.message });
    }

    res.json(response);
  } catch (err) {
    console.error("Error fetching customer profile:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.sendMessageToCustomer = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { customerId } = req.params;
    const { message, shopkeeperEmail } = req.body;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    if (!message || !shopkeeperEmail) {
      return res.status(400).json({
        success: false,
        message: "Message and sender email are required.",
      });
    }

    const shop = await Shop.findById(shopId).select("shopName status");
    if (!shop || shop.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Only active shops can send messages.",
      });
    }

    const customer = await Customer.findById(customerId).select(
      "firstName lastName email"
    );
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    const subject = `Message from ${shop.shopName} | Dobby Mall`;


    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${shop.shopName} - Dobby Mall</title>
    </head>
    <body style="margin:0; padding:0; background-color:#f4f6f8; font-family:'Segoe UI', Arial, sans-serif;">

      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f8; padding:40px 0;">
        <tr>
          <td align="center">
            <table width="640" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.08); overflow:hidden;">

              <!-- Header / Brand -->
              <tr>
                <td style="background:linear-gradient(90deg, #0d1b2a, #1b263b); padding:25px 0; text-align:center;">
                  <h1 style="margin:0; font-size:26px; font-weight:700; color:#f8f9fa; letter-spacing:1px;">
                    Dobby Mall
                  </h1>
                  <p style="margin:4px 0 0; font-size:14px; color:#d1d5db;">Empowering Modern Retail</p>
                </td>
              </tr>

              <!-- Content Card -->
              <tr>
                <td style="padding:32px 40px;">
                  <h2 style="font-size:20px; color:#111827; margin-bottom:12px;">Message from ${shop.shopName}</h2>
                  <p style="font-size:15px; color:#374151; margin-bottom:20px;">
                    Hello <strong>${customer.firstName || "Customer"}</strong>,
                  </p>

                  <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:18px 20px; color:#333; font-size:15px; line-height:1.6;">
                    ${message.replace(/\n/g, "<br/>")}
                  </div>

                  <p style="margin-top:24px; color:#4b5563; font-size:14px;">
                    Regards,<br/>
                    <strong>${shop.shopName} Team</strong><br/>
                    <span style="color:#6b7280;">Sent via Dobby Mall Enterprise Panel</span><br/>
                    <span style="font-size:13px; color:#9ca3af;">Sender: ${shopkeeperEmail}</span>
                  </p>

                  <!-- CTA -->
                  <div style="text-align:center; margin-top:30px;">
                    <a href="https://test-dobby.vercel.app" target="_blank" rel="noopener"
                      style="background-color:#f5b301; color:#111827; text-decoration:none; font-weight:600;
                      font-size:15px; padding:12px 28px; border-radius:6px; display:inline-block;">
                      Visit Dobby Mall
                    </a>
                  </div>
                </td>
              </tr>

              <!-- Divider -->
              <tr>
                <td style="padding:0 40px;">
                  <hr style="border:none; border-top:1px solid #e5e7eb; margin:0;">
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color:#f9fafb; padding:20px 40px; text-align:center;">
                  <p style="font-size:13px; color:#6b7280; margin:0;">
                    © ${new Date().getFullYear()} Dobby Mall. All rights reserved.<br/>
                    <span style="color:#9ca3af;">Smart Retail Infrastructure | www.dobbymall.com</span>
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>

    </body>
    </html>
    `;

    await sendEmail(customer.email, subject, htmlContent);

    res.json({
      success: true,
      message: `Message sent successfully to ${customer.email}`,
    });
  } catch (err) {
    console.error("Error sending message to customer:", err);
    res.status(500).json({
      success: false,
      message: "Server error while sending message.",
    });
  }
};

/**
 * @desc Deactivate a customer for this shop
 * @route PATCH /api/shop/customers/:customerId/deactivate
 * @access Private (Shopkeeper only)
 */
exports.deactivateCustomerForShop = async (req, res) => {
  try {
    const shopId = req.shop._id;
    const { customerId } = req.params;
    const { reason, shopkeeperEmail } = req.body;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Invalid customer ID" });
    }

    // Validate required fields
    if (!reason || !shopkeeperEmail) {
      return res.status(400).json({
        success: false,
        message: "Reason and shopkeeper email are required.",
      });
    }

    // Check shop status
    const shop = await Shop.findById(shopId).select("shopName status");
    if (!shop || shop.status !== "active") {
      return res.status(403).json({
        success: false,
        message: "Only active shops can deactivate customers.",
      });
    }

    // Check customer
    const customer = await Customer.findById(customerId).select("firstName lastName email");
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    // Update or create deactivation record
    const statusDoc = await ShopCustomerStatus.findOneAndUpdate(
      { shop: shopId, customer: customerId },
      { status: "deactivated", reason, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    // Send Email Notification
    const subject = `Important Notice from Dobby Mall — ${shop.shopName}`;
    const htmlContent = `
      <div style="font-family:'Segoe UI', Arial, sans-serif; padding:20px; background-color:#f9f9f9;">
        <div style="max-width:600px; margin:auto; background:#fff; border-radius:12px; box-shadow:0 0 10px rgba(0,0,0,0.05); padding:25px;">
          <div style="text-align:center;">
            <img src="https://dobbymall.com/logo.png" alt="Dobby Mall" style="height:60px; margin-bottom:10px;">
            <h2 style="color:#2c3e50;">${shop.shopName}</h2>
          </div>
          <p style="font-size:15px; color:#555;">Dear ${customer.firstName},</p>
          <p style="font-size:15px; color:#444; line-height:1.6;">
            We regret to inform you that your access to <strong>${shop.shopName}</strong> on <strong>Dobby Mall</strong> has been temporarily <span style="color:#e74c3c;">deactivated</span>.
          </p>
          <p style="font-size:15px; color:#444;">
            <strong>Reason:</strong> ${reason}
          </p>
          <p style="font-size:15px; color:#777; line-height:1.6;">
            You will not be able to place new orders with this shop while deactivated. However, you can continue shopping with other sellers on Dobby Mall.
          </p>
          <br/>
          <p style="font-size:14px; color:#666;">Best Regards,<br/>
          <strong>${shop.shopName} Team</strong><br/>
          
          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;">
          <div style="text-align:center; font-size:13px; color:#aaa;">
            © ${new Date().getFullYear()} Dobby Mall — Connecting Shops & Customers
          </div>
        </div>
      </div>
    `;

    await sendEmail(customer.email, subject, htmlContent);

    res.json({
      success: true,
      message: `Customer ${customer.email} has been deactivated for ${shop.shopName}.`,
      data: statusDoc,
    });
  } catch (err) {
    console.error("deactivateCustomerForShop error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while deactivating customer.",
    });
  }
};

