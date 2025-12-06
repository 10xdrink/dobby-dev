const axios = require("axios");
const ShiprocketIntegration = require("../models/ShiprocketIntegration");
const ShiprocketAuth = require("../models/ShiprocketAuth");
const logger = require("../config/logger");
const Order = require("../models/Order");
const Shop = require("../models/Shop");

class ShiprocketApiService {
   async login(shopkeeperId) {
    logger.info(`[Shiprocket] Login attempt for shopkeeper: ${shopkeeperId}`);

    const integration = await ShiprocketIntegration.findOne({
      shopkeeper: shopkeeperId,
    });
    if (!integration) throw new Error("No Shiprocket integration found");

    const plainPassword = integration.getDecryptedPassword
      ? integration.getDecryptedPassword()
      : integration.shiprocketPassword;

   logger.info("[DEBUG] Shiprocket Integration Credentials", {
  email: integration.shiprocketEmail,
  encryptedPasswordSample: integration.shiprocketPassword?.slice(0, 10) + "...",
  decryptedPasswordSample: plainPassword?.slice(0, 3) + "***" + plainPassword?.slice(-2),
});

    const existingAuth = await ShiprocketAuth.findOne({
      shopkeeper: shopkeeperId,
    });
    if (existingAuth && existingAuth.tokenExpiry > new Date()) {
      logger.info("[Shiprocket] Using cached token", {
        shopkeeperId,
        expires: existingAuth.tokenExpiry,
      });
      return existingAuth.token;
    }

    try {
      logger.info("[Shiprocket] Sending login request to Shiprocket API");
      const res = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/auth/login",
        {
          email: integration.shiprocketEmail,
          password: plainPassword,
        }
      );

      const token = res.data.token;
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 10);

      if (existingAuth) {
        existingAuth.token = token;
        existingAuth.tokenExpiry = expiry;
        await existingAuth.save();
      } else {
        await ShiprocketAuth.create({
          shopkeeper: shopkeeperId,
          token,
          tokenExpiry: expiry,
        });
      }

      logger.info("[Shiprocket] Login successful", {
        shopkeeperId,
        tokenPreview: token?.slice(0, 10) + "...",
      });

      return token;
    } catch (err) {
      logger.error("[Shiprocket] Login failed", {
        shopkeeperId,
        response: err.response?.data,
        status: err.response?.status,
        message: err.message,
      });
      throw new Error("Failed to login to Shiprocket");
    }
  }

   async createWebhook(shopkeeperId) {
    logger.info(`[Shiprocket] Webhook creation started for shopkeeper: ${shopkeeperId}`);
    const token = await this.login(shopkeeperId);
    const existing = await ShiprocketAuth.findOne({ shopkeeper: shopkeeperId });

    if (existing && existing.webhookCreated) {
      logger.info("[Shiprocket] Webhook already marked as created");
      return true;
    }

    const webhookUrl =
      process.env.SHIPROCKET_WEBHOOK_URL ||
      "https://test-dobby-backend-2.onrender.com/api/shiprocket/webhook";

    try {
      logger.info("[Shiprocket] Fetching existing webhooks from Shiprocket");
      const listRes = await axios.get(
        "https://apiv2.shiprocket.in/v1/external/settings/webhooks",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const found =
        Array.isArray(listRes.data?.data) &&
        listRes.data.data.find(
          (w) => String(w.target_url).trim() === webhookUrl.trim()
        );

      if (found) {
        logger.info("[Shiprocket] Webhook already exists in Shiprocket", {
          webhookUrl,
        });

        if (existing) {
          existing.webhookCreated = true;
          await existing.save();
        } else {
          await ShiprocketAuth.create({
            shopkeeper: shopkeeperId,
            token,
            tokenExpiry: new Date(Date.now() + 10 * 60 * 60 * 1000),
            webhookCreated: true,
          });
        }
        return true;
      }
    } catch (err) {
      logger.error("[Shiprocket] Failed to list webhooks", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
    }

    try {
      logger.info("[Shiprocket] Creating new webhook", { webhookUrl });
      await axios.post(
        "https://apiv2.shiprocket.in/v1/external/settings/webhooks",
        { event: "SHIPMENT_STATUS_UPDATE", target_url: webhookUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      logger.info("[Shiprocket] Webhook created successfully");
    } catch (err) {
      logger.error("[Shiprocket] Webhook creation failed", {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message,
      });
      throw new Error("Failed to create Shiprocket webhook");
    }

    if (existing) {
      existing.webhookCreated = true;
      await existing.save();
    } else {
      await ShiprocketAuth.create({
        shopkeeper: shopkeeperId,
        token,
        tokenExpiry: new Date(Date.now() + 10 * 60 * 60 * 1000),
        webhookCreated: true,
      });
    }

    return true;
  }
  async createShipment(order, shopId, shopItems) {
    const shop = await Shop.findById(shopId).populate("owner");
    if (!shop) throw new Error("Shop not found");

    const shopkeeperId = shop.owner._id;
    const token = await this.login(shopkeeperId);
    await this.createWebhook(shopkeeperId);

    const integration = await ShiprocketIntegration.findOne({
      shopkeeper: shopkeeperId,
    });
    if (!integration)
      throw new Error("Shopkeeper not integrated with Shiprocket");

    let populatedOrder = order;
    if (
      !order.address ||
      typeof order.address === "string" ||
      !order.address.firstName
    ) {
      populatedOrder = await Order.findById(order._id).populate("address");
    }

    const address = populatedOrder?.address;
    if (!address) {
      logger.error(`Missing address in order ${order._id}`);
      throw new Error("Order address not found or not populated");
    }

    const shipmentData = {
      order_id: `${order._id}-${shopId}`,
      order_date: new Date().toISOString(),
      pickup_location: integration.pickupLocation,
      billing_customer_name: address.firstName,
      billing_last_name: address.lastName || "",
      billing_address: address.addressLine,
      billing_city: address.city,
      billing_pincode: address.zipCode,
      billing_state: address.state,
      billing_country: "India",
      billing_email: address.email,
      billing_phone: address.phone,
      payment_method: order.paymentMethod === "cod" ? "COD" : "Prepaid",
      sub_total: shopItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      order_items: shopItems.map((i) => ({
        name: i.name,
        sku: i.sku,
        units: i.quantity,
        selling_price: i.price,
      })),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 1,
    };

    let res;
    try {
      res = await axios.post(
        "https://apiv2.shiprocket.in/v1/external/orders/create/adhoc",
        shipmentData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      logger.error(
        `Shiprocket API error for order ${order._id} shop ${shopId}: ${err.message}`
      );
      throw new Error("Failed to create shipment in Shiprocket");
    }

    if (res.data?.shipment_id || res.data?.awb_code) {
      await Order.updateOne(
        { _id: order._id, "shipments.shop": shopId },
        {
          $set: {
            "shipments.$.trackingId": res.data.awb_code || null,
            "shipments.$.shipmentId": res.data.shipment_id || null,
            "shipments.$.courierName": res.data.courier_name || null,
            "shipments.$.status": "confirmed",
            "shipments.$.lastUpdated": new Date(),
          },
        },
        { upsert: true }
      );
    } else {
      logger.warn(
        `Shiprocket did not return trackingId/shipmentId for order ${order._id}`
      );
    }

    return res?.data || {};
  }

  async getTracking(awb, shopkeeperId) {
    const token = await this.login(shopkeeperId);
    const res = await axios.get(
      `https://apiv2.shiprocket.in/v1/external/courier/track/awb/${awb}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data;
  }
}

module.exports = new ShiprocketApiService();
