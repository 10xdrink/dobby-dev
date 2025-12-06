const axios = require("axios");
const { default: axiosRetry } = require("axios-retry");
const qs = require("qs");
const UpsIntegration = require("../models/UpsIntegration");
const UpsAuth = require("../models/UpsAuth");
const Shop = require("../models/Shop");
const Order = require("../models/Order");
const logger = require("../config/logger");


axiosRetry(axios, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    const retryAfter = error.response?.headers?.["retry-after"];
    if (retryAfter) return parseInt(retryAfter) * 1000; // UPS rate-limit respect
    return Math.pow(2, retryCount) * 1000; // exponential backoff: 1s, 2s, 4s
  },
  retryCondition: (error) => {
    if (!error.response) return true; // network error
    const status = error.response.status;
    return [429, 500, 502, 503, 504].includes(status);
  },
});

class UpsApiService {
  getUpsUrl(key) {
    const map = {
      token: process.env.UPS_TOKEN_URL,
      ship: process.env.UPS_SHIP_URL,
      track: process.env.UPS_TRACK_URL,
      webhook: process.env.UPS_WEBHOOK_URL,
    };
    return map[key];
  }

  async getToken(shopkeeperId) {
    const integration = await UpsIntegration.findOne({ shopkeeper: shopkeeperId });
    if (!integration) throw new Error("No UPS integration found");

    const secret = integration.getDecryptedSecret();
    const existing = await UpsAuth.findOne({ shopkeeper: shopkeeperId });

    if (existing && existing.tokenExpiry > new Date()) return existing.token;

    const data = qs.stringify({
      grant_type: "client_credentials",
      client_id: integration.clientId,
      client_secret: secret,
    });

    let res;
    try {
      res = await axios.post(this.getUpsUrl("token"), data, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 10000,
      });
    } catch (err) {
      logger.error("[UPS:Auth] Token request failed", {
        message: err.message,
        status: err.response?.status,
      });
      throw new Error("UPS token fetch failed after retries");
    }

    const token = res.data.access_token;
    const expiry = new Date(Date.now() + res.data.expires_in * 1000 - 5 * 60 * 1000);

    if (existing) {
      existing.token = token;
      existing.tokenExpiry = expiry;
      await existing.save();
    } else {
      await UpsAuth.create({ shopkeeper: shopkeeperId, token, tokenExpiry: expiry });
    }

    return token;
  }

  // async createWebhook(shopkeeperId) {
  //   if (process.env.UPS_AUTO_WEBHOOK !== "true") {
  //     logger.info("[UPS:Webhook] Auto-create disabled by env");
  //     return true;
  //   }

  //   const token = await this.getToken(shopkeeperId);
  //   const existingAuth = await UpsAuth.findOne({ shopkeeper: shopkeeperId });
  //   if (existingAuth?.webhookCreated) return true;

  //   try {
  //     await axios.post(
  //       `${this.getUpsUrl("webhook")}`,
  //       { callbackUrl: process.env.UPS_WEBHOOK_ENDPOINT },
  //       { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
  //     );
  //     if (existingAuth) {
  //       existingAuth.webhookCreated = true;
  //       await existingAuth.save();
  //     } else {
  //       await UpsAuth.create({ shopkeeper: shopkeeperId, webhookCreated: true });
  //     }
  //     logger.info("[UPS:Webhook] Created successfully");
  //   } catch (err) {
  //     logger.error("[UPS:Webhook] Creation failed", { message: err.message });
  //   }

  //   return true;
  // }

  async createShipment(order, shopId, shopItems) {
    const shop = await Shop.findById(shopId).populate("owner");
    const shopkeeperId = shop.owner._id;
    const token = await this.getToken(shopkeeperId);
    // await this.createWebhook(shopkeeperId);

    const integration = await UpsIntegration.findOne({ shopkeeper: shopkeeperId });
    if (!integration) throw new Error("Shopkeeper not integrated with UPS");

    const populatedOrder = await Order.findById(order._id).populate("address");
    const address = populatedOrder.address;

    const payload = {
      shipment: {
        shipper: {
          name: integration.pickupContactName,
          phone: integration.pickupPhone,
          address: {
            addressLine: integration.pickupAddress,
            city: integration.pickupCity,
            stateProvince: integration.pickupState,
            postalCode: integration.pickupPincode,
            countryCode: integration.pickupCountry,
          },
        },
        recipient: {
          name: `${address.firstName} ${address.lastName}`,
          phone: address.phone,
          address: {
            addressLine: address.addressLine,
            city: address.city,
            stateProvince: address.state,
            postalCode: address.zipCode,
            countryCode: address.country || "IN",
          },
        },
        packages: shopItems.map((i) => ({
          description: i.name,
          weight: { unit: "KGS", value: i.weight || 1 },
        })),
      },
    };

    let res;
    try {
      res = await axios.post(this.getUpsUrl("ship"), payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
    } catch (err) {
      logger.error("[UPS:Ship] Failed after retries", {
        message: err.message,
        status: err.response?.status,
      });
      throw new Error("UPS shipment creation failed after retries");
    }

    const trackingNumber = res.data.trackingNumber;

    await Order.updateOne(
      { _id: order._id, "shipments.shop": shopId },
      {
        $set: {
          "shipments.$.trackingId": trackingNumber,
          "shipments.$.courierName": "UPS",
          "shipments.$.status": "confirmed",
          "shipments.$.lastUpdated": new Date(),
        },
      }
    );

    return res.data;
  }

  async trackShipment(trackingNumber, shopkeeperId) {
    const token = await this.getToken(shopkeeperId);

    let res;
    try {
      res = await axios.post(
        this.getUpsUrl("track"),
        { trackingNumber },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
    } catch (err) {
      logger.error("[UPS:Track] Failed after retries", {
        message: err.message,
        status: err.response?.status,
      });
      throw new Error("UPS tracking failed after retries");
    }

    return res.data;
  }

  async createReturnShipment(order, shopId, originalTrackingId) {
  const startTime = Date.now();

  logger.info("[UPS:Return] Initiating return shipment", {
    orderId: order?._id,
    shopId,
    originalTrackingId,
  });

  if (!order?._id || !shopId || !originalTrackingId) {
    logger.warn("[UPS:Return] Missing required parameters", {
      hasOrder: !!order?._id,
      hasShop: !!shopId,
      hasTracking: !!originalTrackingId,
    });
    throw new Error("Order, shop ID, and original tracking ID are required");
  }

  try {
    
    const shop = await Shop.findById(shopId).populate("owner");
    if (!shop) {
      logger.error("[UPS:Return] Shop not found", { shopId });
      throw new Error("Shop not found for return shipment");
    }

    const shopkeeperId = shop.owner?._id;
    if (!shopkeeperId) {
      logger.error("[UPS:Return] Shopkeeper ID missing", { shopId });
      throw new Error("Shopkeeper not linked to shop");
    }

    const integration = await UpsIntegration.findOne({ shopkeeper: shopkeeperId });
    if (!integration) {
      logger.error("[UPS:Return] UPS integration not found", { shopkeeperId });
      throw new Error("UPS integration not configured for this shopkeeper");
    }

    
    let token;
    try {
      token = await this.getToken(shopkeeperId);
      if (!token) {
        throw new Error("Token empty or invalid");
      }
    } catch (authErr) {
      logger.error("[UPS:Return] Token retrieval failed", {
        shopkeeperId,
        message: authErr.message,
      });
      throw new Error("Failed to authenticate UPS API");
    }

    
    const populatedOrder = await Order.findById(order._id).populate("address");
    if (!populatedOrder?.address) {
      logger.error("[UPS:Return] Missing customer address", { orderId: order._id });
      throw new Error("Customer address not found for return shipment");
    }

    const customerAddress = populatedOrder.address;

    
    const payload = {
      returnShipment: true,
      originalTracking: originalTrackingId,
      shipper: {
        name: `${customerAddress.firstName || ""} ${customerAddress.lastName || ""}`.trim(),
        phone: customerAddress.phone,
        address: {
          addressLine: customerAddress.addressLine,
          city: customerAddress.city,
          stateProvince: customerAddress.state,
          postalCode: customerAddress.zipCode,
          countryCode: customerAddress.country || "IN",
        },
      },
      recipient: {
        name: integration.pickupContactName,
        phone: integration.pickupPhone,
        address: {
          addressLine: integration.pickupAddress,
          city: integration.pickupCity,
          stateProvince: integration.pickupState,
          postalCode: integration.pickupPincode,
          countryCode: integration.pickupCountry,
        },
      },
    };

    logger.debug("[UPS:Return] Prepared payload", { payload });

    
    const res = await axios.post(this.getUpsUrl("ship"), payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
      validateStatus: () => true,
    });

    const duration = Date.now() - startTime;

    
    if (!res || res.status >= 400) {
      logger.error("[UPS:Return] UPS API responded with error", {
        orderId: order._id,
        status: res?.status,
        data: res?.data,
        durationMs: duration,
      });
      throw new Error(`UPS API returned status ${res?.status || "unknown"}`);
    }

    if (!res.data?.trackingNumber) {
      logger.warn("[UPS:Return] Missing tracking number in UPS response", {
        orderId: order._id,
        response: res.data,
      });
    }

    const returnTracking = res.data.trackingNumber || "UNKNOWN";
    logger.info("[UPS:Return] Return shipment created successfully", {
      orderId: order._id,
      trackingNumber: returnTracking,
      durationMs: duration,
    });

    
    const updateRes = await Order.updateOne(
      { _id: order._id, "shipments.shop": shopId },
      {
        $set: {
          "shipments.$.returnTrackingId": returnTracking,
          "shipments.$.returnCourierName": "UPS",
          "shipments.$.returnStatus": "pickup_scheduled",
          "shipments.$.lastUpdated": new Date(),
        },
      }
    );

    logger.debug("[UPS:Return] Order updated with return shipment", {
      orderId: order._id,
      updateResult: updateRes,
    });

    return {
      success: true,
      trackingNumber: returnTracking,
      durationMs: duration,
      response: res.data,
    };

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error("[UPS:Return] Failed", {
      orderId: order?._id,
      message: err.message,
      stack: err.stack,
      durationMs: duration,
    });

    if (err.code === "ECONNABORTED") {
      logger.warn("[UPS:Return] UPS request timed out", {
        orderId: order?._id,
        timeout: true,
      });
    }

    if (err.response?.data) {
      logger.error("[UPS:Return] UPS error payload", {
        orderId: order?._id,
        payload: err.response.data,
      });
    }

    throw new Error("UPS reverse shipment creation failed");
  }
}


async cancelShipment(trackingNumber) {
  const startTime = Date.now();

  if (!trackingNumber) {
    logger.warn("[UPS:Cancel] Called without tracking number");
    throw new Error("Tracking number is required");
  }

  const url = `${this.getUpsUrl("ship")}/${trackingNumber}/cancel`;
  logger.info(`[UPS:Cancel] Initiating cancellation for tracking ${trackingNumber}`, { url });

  try {
    
    const order = await Order.findOne({ "shipments.trackingId": trackingNumber })
      .populate("shipments.shop")
      .exec();

    if (!order) {
      logger.warn("[UPS:Cancel] No order found for tracking number", { trackingNumber });
      throw new Error("Order not found for tracking number");
    }

    const shopkeeperId = order.shipments[0]?.shop?.owner?._id || order.shipments[0]?.shop?.owner;
    if (!shopkeeperId) {
      logger.error("[UPS:Cancel] Missing shopkeeper ID", {
        trackingNumber,
        shop: order.shipments[0]?.shop?._id || "unknown",
      });
      throw new Error("Shopkeeper information missing for cancellation");
    }

    
    let token;
    try {
      token = await this.getToken(shopkeeperId);
    } catch (tokenErr) {
      logger.error("[UPS:Cancel] Token retrieval failed", {
        shopkeeperId,
        message: tokenErr.message,
        trackingNumber,
      });
      throw new Error("Failed to authenticate UPS API");
    }

    
    const res = await axios.post(
      url,
      {},
      {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
        validateStatus: () => true, 
      }
    );

    const duration = Date.now() - startTime;

    
    if (!res || res.status >= 400) {
      logger.error("[UPS:Cancel] API returned error", {
        trackingNumber,
        status: res?.status,
        data: res?.data,
        durationMs: duration,
      });
      throw new Error(`UPS API responded with status ${res?.status || "unknown"}`);
    }

    
    if (!res.data || !res.data.status) {
      logger.warn("[UPS:Cancel] UPS response missing expected fields", {
        trackingNumber,
        response: res.data,
      });
    }

    logger.info("[UPS:Cancel] Success", {
      trackingNumber,
      status: res.data?.status || "cancelled",
      httpStatus: res.status,
      durationMs: duration,
    });

    return {
      success: true,
      status: res.data?.status || "cancelled",
      durationMs: duration,
    };

  } catch (err) {
    const duration = Date.now() - startTime;

    logger.error("[UPS:Cancel] Failure", {
      trackingNumber,
      message: err.message,
      stack: err.stack,
      durationMs: duration,
    });

    
    if (err.code === "ECONNABORTED") {
      logger.warn("[UPS:Cancel] UPS request timed out", {
        trackingNumber,
        timeout: true,
      });
    }

    if (err.response?.data) {
      logger.error("[UPS:Cancel] UPS error payload", {
        trackingNumber,
        payload: err.response.data,
      });
    }

    throw new Error("UPS shipment cancellation failed");
  }
}

}

module.exports = new UpsApiService();
