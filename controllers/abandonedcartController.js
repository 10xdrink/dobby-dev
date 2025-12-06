const mongoose = require("mongoose");
const AbandonedCart = require("../models/AbandonedCart");
const Shop = require("../models/Shop");
const cacheService = require("../services/cacheService");

exports.getMyShopAbandonedStats = async (req, res) => {
  try {
    const userId = req.user.id;

    
    const shop = await Shop.findOne({ owner: userId, status: "active" });
    if (!shop) {
      return res.status(403).json({
        success: false,
        message: "Your shop is not active. Please activate your shop to view inventory.",
      });
    }

    const shopId = shop._id;

    const cacheKey = `shop:${shopId}:abandonedStats`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const abandonedCount = await AbandonedCart.countDocuments({
        shop: shopId,
        status: { $in: ["pending", "sent"] },
      });

      const recoveredCount = await AbandonedCart.countDocuments({
        shop: shopId,
        status: "recovered",
      });

      const potentialRevenueAgg = await AbandonedCart.aggregate([
        { $match: { shop: new mongoose.Types.ObjectId(shopId), status: { $in: ["pending", "sent"] } } },
        { $group: { _id: null, total: { $sum: "$value" } } },
      ]);
      const potentialRevenue = potentialRevenueAgg.length ? potentialRevenueAgg[0].total : 0;

      const totalCarts = abandonedCount + recoveredCount;
      const avgCartValue = totalCarts > 0 ? (potentialRevenue / totalCarts).toFixed(2) : 0;

      return {
        success: true,
        shopId,
        shopName: shop.shopName,
        data: {
          abandonedCount,
          recoveredCount,
          potentialRevenue,
          avgCartValue,
        },
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Error getting abandoned cart stats:", err);
    res.status(500).json({
      success: false,
      message: "Error getting stats",
      error: err.message,
    });
  }
};

exports.getShopAbandonedCarts = async (req, res) => {
  try {
    const userId = req.user.id; // shopkeeper
    const shop = await Shop.findOne({ owner: userId, status: "active" });

    if (!shop) {
      return res.status(403).json({
        success: false,
        message: "Active shop not found for this user",
      });
    }

    const shopId = shop._id;

    const cacheKey = `shop:${shopId}:abandonedCarts`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      // Fetch all abandoned carts for this shop
      const abandonedCarts = await AbandonedCart.find({ shop: shopId })
        .populate("customer", "firstName lastName email")
        .populate("product", "productName unitPrice")
        .sort({ abandonedAt: -1 });

      // Format response for UI
      const formatted = abandonedCarts.map((item, index) => ({
        sno: index + 1,
        customer:
          item.customer?.firstName ||
          item.customer?.email ||
          "Guest User",
        product: item.product?.productName || "Deleted Product",
        value: item.value,
        abandoned: item.abandonedAt,
        status: item.status,
      }));

      return {
        success: true,
        shopId,
        shopName: shop.shopName,
        total: formatted.length,
        data: formatted,
      };
    });

    res.status(200).json(responseData);
  } catch (err) {
    console.error("Error in getShopAbandonedCarts:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching abandoned carts",
      error: err.message,
    });
  }
};
