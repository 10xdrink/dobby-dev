const ShiprocketApiService = require("../services/shiprocketApiService");
const Order = require("../models/Order");
const ShiprocketIntegration = require("../models/ShiprocketIntegration");

exports.getTrackingDetails = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { orderId } = req.params;

    
    const order = await Order.findOne({ _id: orderId, customer: customerId })
      .populate("items.product", "name")
      .populate("items.shop", "shopName owner");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    
    const shopGroups = {};
    for (const item of order.items) {
      const shopId = item.shop?._id?.toString();
      if (!shopId) continue;

      if (!shopGroups[shopId]) {
        shopGroups[shopId] = {
          shop: item.shop,
          products: [],
        };
      }

      shopGroups[shopId].products.push(item.name);
    }

    
    const trackingResults = await Promise.all(
      Object.values(shopGroups).map(async ({ shop, products }) => {
        try {
          const shopkeeperId = shop?.owner?._id || shop?.owner;

          
          const integration = await ShiprocketIntegration.findOne({
            shopkeeper: shopkeeperId,
          });
          if (!integration) {
            return {
              shop: shop?.shopName || "Unknown Shop",
              products,
              trackingId: null,
              shipmentId: null,
              tracking: null,
              message: "Shopkeeper has not integrated Shiprocket yet",
            };
          }

         
          const shipment = order.shipments?.find(
            (s) => s.shop?.toString() === shop._id.toString()
          );

          if (!shipment || !shipment.trackingId) {
            return {
              shop: shop?.shopName || "Unknown Shop",
              products,
              trackingId: null,
              shipmentId: null,
              tracking: null,
              message: "Shipment not created yet by the shopkeeper",
            };
          }

          
          const tracking = await ShiprocketApiService.getTracking(
            shipment.trackingId,
            shopkeeperId
          );

          
          if (!tracking || tracking.status_code === 404) {
            return {
              shop: shop?.shopName || "Unknown Shop",
              products,
              trackingId: shipment.trackingId,
              shipmentId: shipment.shipmentId || null,
              tracking: null,
              message: "Tracking information not found for this shipment",
            };
          }

          return {
            shop: shop?.shopName || "Unknown Shop",
            products,
            trackingId: shipment.trackingId,
            shipmentId: shipment.shipmentId || null,
            tracking,
            message: "Tracking fetched successfully",
          };
        } catch (err) {
          console.error("Tracking fetch error:", err.message);
          return {
            shop: shop?.shopName || "Unknown Shop",
            products,
            trackingId: null,
            shipmentId: null,
            tracking: null,
            message: "Error fetching tracking details",
          };
        }
      })
    );

    
    return res.status(200).json({
      success: true,
      orderId: order._id,
      overallStatus: order.status,
      shipments: trackingResults,
    });
  } catch (err) {
    console.error("Error fetching tracking info:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error while fetching tracking info",
      error: err.message,
    });
  }
};
