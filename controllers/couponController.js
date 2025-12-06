const Coupon = require("../models/Coupon");
const logger = require("../config/logger");
const cacheService = require("../services/cacheService");

// Create Coupon
exports.createCoupon = async (req, res) => {
  try {
    const shop = req.shop;
    const { name, code, type, description, value, discountType, startDate, endDate } = req.body;

    if (req.body.shop && req.body.shop.toString() !== shop._id.toString()) {
      return res.status(403).json({ message: "Cannot create coupon for another shop" });
    }

    if (!name || !code || !type || value === undefined || !startDate || !endDate) {
      return res.status(400).json({ message: "Please provide all required fields: name, code, type, value, startDate, endDate" });
    }

    if (discountType === "percentage" && (value < 0 || value > 100)) {
      return res.status(400).json({ message: "Percentage must be between 0 and 100" });
    }

    if (discountType === "flat" && value < 0) {
      return res.status(400).json({ message: "Discount cannot be negative" });
    }

    const existing = await Coupon.findOne({ code: code.toUpperCase(), shop: shop._id });
    if (existing) {
      return res.status(400).json({ message: "Coupon code already exists for your shop!" });
    }

    const coupon = new Coupon({
      shop: shop._id,  // Force use req.shop (not req.body.shop)
      name,
      code: code.toUpperCase(),
      type,
      description,
      value,
      discountType,
      startDate,
      endDate,
      status: "active",
    });

    await coupon.save();
    await cacheService.deletePattern(`shop:${shop._id}:coupons:*`);
    logger.info(`Coupon created: ${coupon.code} for shop ${shop._id}`);
    res.status(201).json({ message: "Coupon created successfully!", coupon });
  } catch (err) {
    logger.error("Create Coupon Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get All Coupons
exports.getCoupons = async (req, res) => {
  try {
    const shop = req.shop;
    const { search, status, type } = req.query;

    const cacheKey = `shop:${shop._id}:coupons:${search || 'all'}:${status || 'all'}:${type || 'all'}`;
    const responseData = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const query = { shop: shop._id };

      if (search) query.code = { $regex: search, $options: "i" };
      if (status && status !== "all") query.status = status;
      if (type && type !== "all") query.type = type;

      const coupons = await Coupon.find(query).sort({ createdAt: -1 });

      const stats = {
        totalCoupons: coupons.length,
        activeCoupons: coupons.filter(c => c.status === "active").length,
        totalRedeemed: coupons.reduce((sum, c) => sum + c.usageCount, 0),
        totalRevenue: coupons.reduce((sum, c) => {
          return sum + c.usedBy.reduce((s, u) => s + (u.discountAmount || 0), 0);
        }, 0),
      };

      return { coupons, stats };
    });

    res.status(200).json(responseData);
  } catch (err) {
    logger.error("Get Coupons Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Update Coupon
exports.updateCoupon = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const data = req.body;

    if (data.discountType === "percentage" && data.value && (data.value < 0 || data.value > 100)) {
      return res.status(400).json({ message: "Percentage must be between 0 and 100" });
    }

    const coupon = await Coupon.findOne({ _id: id, shop: shop._id });
    if (!coupon) return res.status(404).json({ message: "Coupon not found!" });

    const allowed = ['name', 'code', 'type', 'description', 'value', 'discountType', 'startDate', 'endDate', 'status'];
    const sanitizedData = {};
    for (const key of Object.keys(data)) {
      if (allowed.includes(key)) {
        sanitizedData[key] = data[key];
      }
    }

    Object.assign(coupon, sanitizedData);
    await coupon.save();
    await cacheService.deletePattern(`shop:${shop._id}:coupons:*`);
    logger.info(`Coupon updated: ${coupon.code} for shop ${shop._id}`);
    res.status(200).json({ message: "Coupon updated!", coupon });
  } catch (err) {
    logger.error("Update Coupon Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Coupon
exports.deleteCoupon = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const coupon = await Coupon.findOneAndDelete({ _id: id, shop: shop._id });
    if (!coupon) return res.status(404).json({ message: "Coupon not found!" });
    await cacheService.deletePattern(`shop:${shop._id}:coupons:*`);
    logger.info(`Coupon deleted: ${coupon.code} for shop ${shop._id}`);
    res.status(200).json({ message: "Coupon deleted successfully!" });
  } catch (err) {
    logger.error("Delete Coupon Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Deactivate Coupon
exports.deactivateCoupon = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const coupon = await Coupon.findOne({ _id: id, shop: shop._id });
    if (!coupon) return res.status(404).json({ message: "Coupon not found!" });

    coupon.status = "inactive";
    await coupon.save();
    await cacheService.deletePattern(`shop:${shop._id}:coupons:*`);
    logger.info(`Coupon deactivated: ${coupon.code} for shop ${shop._id}`);
    res.status(200).json({ message: "Coupon deactivated!", coupon });
  } catch (err) {
    logger.error("Deactivate Coupon Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Duplicate Coupon
exports.duplicateCoupon = async (req, res) => {
  try {
    const shop = req.shop;
    const { id } = req.params;
    const oldCoupon = await Coupon.findOne({ _id: id, shop: shop._id });
    if (!oldCoupon) return res.status(404).json({ message: "Coupon not found!" });

    const newCode = `${oldCoupon.code}_${Date.now().toString().slice(-4)}`;
    const duplicate = new Coupon({
      shop: shop._id,
      name: oldCoupon.name,
      code: newCode,
      type: oldCoupon.type,
      description: oldCoupon.description,
      value: oldCoupon.value,
      discountType: oldCoupon.discountType,
      startDate: new Date(),
      endDate: oldCoupon.endDate,
      status: "active",
    });

    await duplicate.save();
    await cacheService.deletePattern(`shop:${shop._id}:coupons:*`);
    logger.info(`Coupon duplicated: ${newCode} from ${oldCoupon.code} for shop ${shop._id}`);
    res.status(201).json({ message: "Coupon duplicated successfully!", duplicate });
  } catch (err) {
    logger.error("Duplicate Coupon Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

// Auto deactivate expired coupons
exports.autoDeactivateExpired = async () => {
  try {
    const now = new Date();
    const result = await Coupon.updateMany(
      { endDate: { $lt: now }, status: "active" },
      { $set: { status: "inactive" } }
    );
    logger.info(`Auto-deactivated ${result.modifiedCount} expired coupons`);
    return result.modifiedCount;
  } catch (err) {
    logger.error("Auto-deactivate Error:", err);
    throw err;
  }
};

// Get Public Available Coupons (for customers)
exports.getAvailableCoupons = async (req, res) => {
  try {
    const { shopId } = req.query;
    
    const query = {
      status: "active",
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    };
    
    if (shopId) {
      query.shop = shopId;
    }

    const coupons = await Coupon.find(query)
      .populate('shop', 'shopName logo')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: coupons.length,
      coupons,
    });
  } catch (err) {
    logger.error("Get Available Coupons Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

exports.getCouponStats = async (req, res) => {
  try {
    const shop = req.shop;

    const cacheKey = `shop:${shop._id}:coupon-stats`;
    const stats = await cacheService.remember(cacheKey, cacheService.TTL.SHORT, async () => {
      const coupons = await Coupon.find({ shop: shop._id });

      // Calculate current month start date
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      // Calculate last week start date
      const lastWeekStart = new Date(now);
      lastWeekStart.setDate(now.getDate() - 7);

      // Total and active coupons
      const totalCoupons = coupons.length;
      const activeCoupons = coupons.filter(c => c.status === "active").length;
      
      // Calculate percentage of active coupons
      const activePercentage = totalCoupons > 0 
        ? ((activeCoupons / totalCoupons) * 100).toFixed(2) 
        : 0;

      // Total redemptions
      const totalRedeemed = coupons.reduce((sum, c) => sum + c.usageCount, 0);
      
      // Redemptions this month
      const redeemedThisMonth = coupons.reduce((sum, c) => {
        const monthRedemptions = c.usedBy.filter(u => 
          new Date(u.usedAt) >= monthStart
        ).length;
        return sum + monthRedemptions;
      }, 0);
      
      // Calculate percentage change from last month
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      const redeemedLastMonth = coupons.reduce((sum, c) => {
        const lastMonthRedemptions = c.usedBy.filter(u => {
          const usedDate = new Date(u.usedAt);
          return usedDate >= lastMonthStart && usedDate <= lastMonthEnd;
        }).length;
        return sum + lastMonthRedemptions;
      }, 0);
      
      const redemptionChangePercentage = redeemedLastMonth > 0
        ? (((redeemedThisMonth - redeemedLastMonth) / redeemedLastMonth) * 100).toFixed(2)
        : redeemedThisMonth > 0 ? 100 : 0;

      // Total discount revenue (total discount given)
      const totalDiscountRevenue = coupons.reduce((sum, c) => {
        return sum + c.usedBy.reduce((s, u) => s + (u.discountAmount || 0), 0);
      }, 0);
      
      // Discount revenue last week
      const discountRevenueLastWeek = coupons.reduce((sum, c) => {
        return sum + c.usedBy
          .filter(u => new Date(u.usedAt) >= lastWeekStart)
          .reduce((s, u) => s + (u.discountAmount || 0), 0);
      }, 0);
      
      // Discount revenue week before last
      const weekBeforeLastStart = new Date(lastWeekStart);
      weekBeforeLastStart.setDate(lastWeekStart.getDate() - 7);
      const discountRevenuePreviousWeek = coupons.reduce((sum, c) => {
        return sum + c.usedBy
          .filter(u => {
            const usedDate = new Date(u.usedAt);
            return usedDate >= weekBeforeLastStart && usedDate < lastWeekStart;
          })
          .reduce((s, u) => s + (u.discountAmount || 0), 0);
      }, 0);
      
      const discountRevenueChangePercentage = discountRevenuePreviousWeek > 0
        ? (((discountRevenueLastWeek - discountRevenuePreviousWeek) / discountRevenuePreviousWeek) * 100).toFixed(2)
        : discountRevenueLastWeek > 0 ? 100 : 0;

      // Average discount per coupon
      const avgDiscount = activeCoupons > 0
        ? coupons
            .filter(c => c.status === "active")
            .reduce((sum, c) => {
              // Calculate average discount given per coupon usage
              if (c.usageCount > 0) {
                const totalCouponDiscount = c.usedBy.reduce((s, u) => s + (u.discountAmount || 0), 0);
                return sum + (totalCouponDiscount / c.usageCount);
              }
              // If not used yet, show the discount value
              return sum + c.value;
            }, 0) / activeCoupons
        : 0;
      
      // Percentage across all coupons (comparing to theoretical max discount)
      const theoreticalMaxDiscount = coupons.reduce((sum, c) => {
        if (c.discountType === "percentage") {
          return sum + c.value; // Already a percentage
        } else {
          // For flat discounts, calculate as percentage of average order value
          // We'll use the average order amount from usedBy
          if (c.usedBy.length > 0) {
            const avgOrderValue = c.usedBy.reduce((s, u) => s + (u.orderAmount || 0), 0) / c.usedBy.length;
            return sum + (avgOrderValue > 0 ? (c.value / avgOrderValue) * 100 : 0);
          }
          return sum + 10; // Default assumption: 10% if no usage data
        }
      }, 0);
      
      const avgDiscountPercentage = coupons.length > 0
        ? (theoreticalMaxDiscount / coupons.length).toFixed(2)
        : 0;

      return {
        activeCoupons: {
          value: activeCoupons,
          percentage: activePercentage,
          label: "Active",
          description: `${activePercentage}% of total coupons are active`
        },
        couponRedeemed: {
          value: totalRedeemed,
          thisMonth: redeemedThisMonth,
          percentage: redemptionChangePercentage,
          label: "New This Month",
          description: `${redemptionChangePercentage}% ${parseFloat(redemptionChangePercentage) >= 0 ? 'increase' : 'decrease'} from last month`
        },
        discountRevenue: {
          value: Math.round(totalDiscountRevenue),
          lastWeek: Math.round(discountRevenueLastWeek),
          percentage: discountRevenueChangePercentage,
          label: "From Last Week",
          description: `${discountRevenueChangePercentage}% ${parseFloat(discountRevenueChangePercentage) >= 0 ? 'increase' : 'decrease'} from previous week`
        },
        avgDiscount: {
          value: Math.round(avgDiscount),
          percentage: avgDiscountPercentage,
          label: "Across All Coupons",
          description: `Average ${avgDiscountPercentage}% discount across all coupons`
        },
        totalCoupons
      };
    });

    res.status(200).json({ stats });
  } catch (err) {
    logger.error("Get Coupon Stats Error:", err);
    res.status(500).json({ message: "Server Error" });
  }
};