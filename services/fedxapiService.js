const axios = require("axios");
const qs = require("qs");
const FedexIntegration = require("../models/FedxIntegration");
const FedexAuth = require("../models/FedxAuth");
const Shop = require("../models/Shop");
const Order = require("../models/Order");
const logger = require("../config/logger");

class FedexApiService {
  getFedexUrl(integration, key) {
    const map = {
      token: integration.useSandbox
        ? process.env.FEDEX_SANDBOX_TOKEN_URL
        : process.env.FEDEX_TOKEN_URL,
      ship: integration.useSandbox
        ? process.env.FEDEX_SANDBOX_SHIP_URL
        : process.env.FEDEX_SHIP_URL,
      track: integration.useSandbox
        ? process.env.FEDEX_SANDBOX_TRACK_URL
        : process.env.FEDEX_TRACK_URL,
      webhook: integration.useSandbox
        ? process.env.FEDEX_SANDBOX_WEBHOOK_URL
        : process.env.FEDEX_WEBHOOK_URL,
    };
    return map[key];
  }
  async getToken(shopkeeperId) {
    logger.info("[FedEx:getToken] Start", { shopkeeperId });
    const integration = await FedexIntegration.findOne({ shopkeeper: shopkeeperId });
    if (!integration) {
      logger.warn("[FedEx:getToken] Integration not found", { shopkeeperId });
      throw new Error("No FedEx integration found");
    }

    const secret = integration.getDecryptedSecret
      ? integration.getDecryptedSecret()
      : integration.clientSecret;

    const existing = await FedexAuth.findOne({ shopkeeper: shopkeeperId });
    logger.debug("[FedEx:getToken] Existing Auth record", { exists: !!existing });

    if (existing && existing.tokenExpiry > new Date()) {
      logger.info("[FedEx] Using cached token", {
        shopkeeperId,
        expires: existing.tokenExpiry,
      });
      return existing.token;
    }

    const url = this.getFedexUrl(integration, "token");

    logger.info("[FedEx:getToken] Fetching new token", {
      shopkeeperId,
      sandbox: integration.useSandbox,
    });

    try {
      
      const data = qs.stringify({
        grant_type: "client_credentials",
        client_id: integration.clientId,
        client_secret: secret,
      });

      const res = await axios.post(url, data, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });

      const token = res.data.access_token;
      const expiry = new Date(
        Date.now() + res.data.expires_in * 1000 - 5 * 60 * 1000
      ); // buffer 5 min

      if (existing) {
        existing.token = token;
        existing.tokenExpiry = expiry;
        await existing.save();
        logger.info("[FedEx:getToken] Token updated in DB", { shopkeeperId });
      } else {
        await FedexAuth.create({
          shopkeeper: shopkeeperId,
          token,
          tokenExpiry: expiry,
        });
        logger.info("[FedEx:getToken] Token saved in DB", { shopkeeperId });
      }

      logger.info("[FedEx] Token fetched successfully", { shopkeeperId });
      return token;
    } catch (err) {
      logger.error("[FedEx] Token fetch failed", {
        shopkeeperId,
        error: err.message,
        response: err.response?.data,
      });
      throw new Error(
        `FedEx token error: ${
          err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.error_description ||
          err.message
        }`
      );
    }
  }

  async createWebhook(shopkeeperId) {
    logger.info("[FedEx:createWebhook] Start", { shopkeeperId });

    const token = await this.getToken(shopkeeperId);

    const existingAuth = await FedexAuth.findOne({ shopkeeper: shopkeeperId });
    
    if (existingAuth?.webhookCreated) {
      logger.info("[FedEx:createWebhook] Already created", { shopkeeperId });
      return true;
    }

    const integration = await FedexIntegration.findOne({
      shopkeeper: shopkeeperId,
    });
    logger.info(
      `[FedEx:createWebhook] Using ${
        integration.useSandbox ? "SANDBOX" : "PRODUCTION"
      } environment`,
      { shopkeeperId }
    );
    if (!integration) {
      logger.warn("[FedEx:createWebhook] No integration found", {
        shopkeeperId,
      });
      throw new Error("No FedEx integration found");
    }

    const url = this.getFedexUrl(integration, "webhook");

    logger.info("[FedEx:createWebhook] Creating webhook", {
      url,
      shopkeeperId,
    });

    try {
      await axios.post(
        `${url}/subscriptions`,
        {
          eventType: "shipment_status_update",
          callbackUrl: process.env.FEDEX_WEBHOOK_ENDPOINT,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (existingAuth) {
        existingAuth.webhookCreated = true;
        await existingAuth.save();
      } else {
        await FedexAuth.create({
          shopkeeper: shopkeeperId,
          token,
          tokenExpiry: new Date(),
          webhookCreated: true,
        });
      }

      logger.info("[FedEx:createWebhook] Webhook created successfully", {
        shopkeeperId,
      });

      return true;
    } catch (err) {
      logger.error("[FedEx] Webhook creation failed", {
        shopkeeperId,
        error: err.message,
        response: err.response?.data,
      });
      throw new Error(
        `FedEx webhook creation failed: ${
          err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.error_description ||
          err.message
        }`
      );
    }
  }

  async createShipment(order, shopId, shopItems) {
    logger.info("[FedEx:createShipment] Start", { orderId: order._id, shopId });

    const shop = await Shop.findById(shopId).populate("owner");
    if (!shop) {
      logger.warn("[FedEx:createShipment] Shop not found", { shopId });
      throw new Error("Shop not found");
    }
    const shopkeeperId = shop.owner._id;
    const token = await this.getToken(shopkeeperId);
    await this.createWebhook(shopkeeperId);

    const integration = await FedexIntegration.findOne({
      shopkeeper: shopkeeperId,
    });

    logger.info(
      `[FedEx:createShipment] Using ${
        integration.useSandbox ? "SANDBOX" : "PRODUCTION"
      } environment`,
      { shopkeeperId }
    );
    if (!integration) {
      logger.warn("[FedEx:createShipment] Integration missing", {
        shopkeeperId,
      });
      throw new Error("Shopkeeper not integrated with FedEx");
    }

    let populatedOrder = order;
    if (
      !order.address ||
      typeof order.address === "string" ||
      !order.address.firstName
    ) {
      logger.debug("[FedEx:createShipment] Populating order address from DB", {
        orderId: order._id,
      });
      populatedOrder = await Order.findById(order._id).populate("address");
    }
    const address = populatedOrder.address;
    if (!address) {
      logger.error("[FedEx:createShipment] No address found", {
        orderId: order._id,
      });
      throw new Error("Order address not found");
    }
    const shipmentPayload = {
      accountNumber: integration.accountNumber,
      customerTransactionId: `${order._id}-${shopId}`,
      shipper: {
        contact: {
          personName: integration.pickupContactName,
          phoneNumber: integration.pickupPhone,
        },
        address: {
          streetLines: [integration.pickupAddress],
          city: integration.pickupCity,
          stateOrProvinceCode: integration.pickupState,
          postalCode: integration.pickupPincode,
          countryCode: integration.pickupCountry,
        },
      },
      recipient: {
        contact: {
          personName:
            address.firstName +
            (address.lastName ? " " + address.lastName : ""),
          phoneNumber: address.phone,
        },
        address: {
          streetLines: [address.addressLine],
          city: address.city,
          stateOrProvinceCode: address.state,
          postalCode: address.zipCode,
          countryCode: address.country || "IN",
        },
      },
      packages: shopItems.map((i) => ({
        weight: { units: "KG", value: i.weight || 1 },
        dimensions: { length: 10, width: 10, height: 10, units: "CM" },
        items: [{ name: i.name, quantity: i.quantity, unitPrice: i.price }],
      })),
      serviceType: "FEDEX_GROUND",
      packagingType: "YOUR_PACKAGING",
      labelSpecification: {
        labelFormatType: "PDF",
        imageType: "PDF",
      },
    };

    try {
      const url = this.getFedexUrl(integration, "ship");

      logger.debug("[FedEx:createShipment] Sending shipment payload", {
        url,
        orderId: order._id,
      });

      const res = await axios.post(url, shipmentPayload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const trackingNumber =
        res.data.output.transactionShipments[0].masterTrackingNumber;
      const shipmentId = res.data.output.transactionShipments[0].shipmentId;

      logger.info("[FedEx:createShipment] Shipment created", {
        orderId: order._id,
        trackingNumber,
        shipmentId,
      });
      await Order.updateOne(
        { _id: order._id, "shipments.shop": shopId },
        {
          $set: {
            "shipments.$.trackingId": trackingNumber,
            "shipments.$.shipmentId": shipmentId,
            "shipments.$.courierName": "FedEx",
            "shipments.$.status": "confirmed",
            "shipments.$.lastUpdated": new Date(),
          },
        }
      );

      logger.info("[FedEx:createShipment] Order updated successfully", {
        orderId: order._id,
      });

      return res.data;
    } catch (err) {
      logger.error("[FedEx] Shipment creation failed", {
        shopkeeperId,
        error: err.message,
        response: err.response?.data,
      });
      throw new Error(
        `FedEx shipment failed:  ${
          err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.error_description ||
          err.message
        }`
      );
    }
  }

  async trackShipment(trackingNumber, shopkeeperId) {
    logger.info("[FedEx:trackShipment] Start", {
      shopkeeperId,
      trackingNumber,
    });

    const token = await this.getToken(shopkeeperId);
    const integration = await FedexIntegration.findOne({
      shopkeeper: shopkeeperId,
    });
    logger.info(
      `[FedEx:trackShipment] Using ${
        integration.useSandbox ? "SANDBOX" : "PRODUCTION"
      } environment`,
      { shopkeeperId }
    );
    if (!integration) {
      logger.warn("[FedEx:trackShipment] Integration missing", {
        shopkeeperId,
      });
      throw new Error("No FedEx integration found");
    }
    const url = this.getFedexUrl(integration, "track");

    try {
      const res = await axios.post(
        url,
        { trackingInfo: [{ trackingNumberInfo: { trackingNumber } }] },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      logger.info("[FedEx:trackShipment] Tracking success", {
        trackingNumber,
        status:
          res.data?.output?.completeTrackResults?.[0]?.trackResults?.[0]
            ?.latestStatusDetail,
      });

      return res.data;
    } catch (err) {
      logger.error("[FedEx:trackShipment] Failed", {
        shopkeeperId,
        trackingNumber,
        error: err.message,
        response: err.response?.data,
      });
      throw new Error(
        `FedEx tracking failed: ${
          err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.error_description ||
          err.message
        }`
      );
    }
  }
    async createReturnShipment(order, shopId, originalTrackingId) {
    logger.info("[FedEx:createReturnShipment] Start", { orderId: order._id, shopId });

    const shop = await Shop.findById(shopId).populate("owner");
    if (!shop) throw new Error("Shop not found");
    const shopkeeperId = shop.owner._id;
    const token = await this.getToken(shopkeeperId);
    const integration = await FedexIntegration.findOne({ shopkeeper: shopkeeperId });
    if (!integration) throw new Error("FedEx integration not found");

    const populatedOrder = await Order.findById(order._id).populate("address");
    const customerAddress = populatedOrder.address;
    if (!customerAddress) throw new Error("Order address not found");

    // Payload is essentially reversed: customer → shop
    const payload = {
      accountNumber: integration.accountNumber,
      customerTransactionId: `${order._id}-${shopId}-RETURN`,
      shipper: {
        contact: {
          personName: `${customerAddress.firstName} ${customerAddress.lastName}`,
          phoneNumber: customerAddress.phone,
        },
        address: {
          streetLines: [customerAddress.addressLine],
          city: customerAddress.city,
          stateOrProvinceCode: customerAddress.state,
          postalCode: customerAddress.zipCode,
          countryCode: customerAddress.country || "IN",
        },
      },
      recipient: {
        contact: {
          personName: integration.pickupContactName,
          phoneNumber: integration.pickupPhone,
        },
        address: {
          streetLines: [integration.pickupAddress],
          city: integration.pickupCity,
          stateOrProvinceCode: integration.pickupState,
          postalCode: integration.pickupPincode,
          countryCode: integration.pickupCountry,
        },
      },
      packages: [
        {
          weight: { units: "KG", value: 1 },
          dimensions: { length: 10, width: 10, height: 10, units: "CM" },
          items: [{ name: "Return Package", quantity: 1 }],
        },
      ],
      serviceType: "FEDEX_GROUND",
      packagingType: "YOUR_PACKAGING",
      returnShipmentIndicator: true,
      originalTrackingNumber: originalTrackingId,
      labelSpecification: {
        labelFormatType: "PDF",
        imageType: "PDF",
      },
    };

    try {
      const url = this.getFedexUrl(integration, "ship");
      const res = await axios.post(url, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const returnTracking =
        res.data.output.transactionShipments[0].masterTrackingNumber;

      await Order.updateOne(
        { _id: order._id, "shipments.shop": shopId },
        {
          $set: {
            "shipments.$.returnTrackingId": returnTracking,
            "shipments.$.returnCourierName": "FedEx",
            "shipments.$.returnStatus": "pickup_scheduled",
            "shipments.$.lastUpdated": new Date(),
          },
        }
      );

      logger.info("[FedEx:Return] Reverse shipment created", {
        orderId: order._id,
        returnTracking,
      });

      return res.data;
    } catch (err) {
      logger.error("[FedEx:Return] Failed", {
        error: err.message,
        response: err.response?.data,
      });
      throw new Error(
        `FedEx return shipment failed: ${
          err.response?.data?.errors?.[0]?.message ||
          err.response?.data?.error_description ||
          err.message
        }`
      );
    }
  }

  async cancelShipment(trackingNumber) {
  logger.info("[FedEx:cancelShipment] Start", { trackingNumber });

  try {
    
    const integration = await FedexIntegration.findOne();
    if (!integration) throw new Error("FedEx integration not found");

    const shopkeeperId = integration.shopkeeper;
    const token = await this.getToken(shopkeeperId);
    const url = this.getFedexUrl(integration, "ship");

    const cancelUrl = `${url}/cancel`;
    logger.debug("[FedEx:cancelShipment] Sending cancel request", { cancelUrl });

    const res = await axios.post(
      cancelUrl,
      { trackingNumber },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    logger.info("[FedEx:cancelShipment] Success", {
      trackingNumber,
      status: res.data?.status || "unknown",
    });

    return { status: res.data?.status || "cancelled" };
  } catch (err) {
    logger.error("[FedEx:cancelShipment] Failed", {
      trackingNumber,
      error: err.message,
      response: err.response?.data,
    });
    throw new Error(
      `FedEx cancellation failed: ${
        err.response?.data?.errors?.[0]?.message ||
        err.response?.data?.error_description ||
        err.message
      }`
    );
  }
}


}

module.exports = new FedexApiService();
