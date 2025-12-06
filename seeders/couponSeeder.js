const mongoose = require("mongoose");
const Coupon = require("../models/Coupon");
const Shop = require("../models/Shop");
require("dotenv").config();

const seedCoupons = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    // Get the first shop from database
    const shop = await Shop.findOne();
    if (!shop) {
      console.error("❌ No shop found! Please create a shop first.");
      process.exit(1);
    }

    console.log(`📦 Using shop: ${shop.shopName} (${shop._id})`);

    // Delete existing coupons for this shop
    await Coupon.deleteMany({ shop: shop._id });
    console.log("🗑️  Deleted existing coupons");

    // Sample coupons
    const coupons = [
      {
        shop: shop._id,
        name: "Flat 20% Off",
        code: "SAVE20",
        type: "promotional",
        description: "Get 20% off on all products",
        value: 20,
        discountType: "percentage",
        startDate: new Date(),
        endDate: new Date("2025-12-31"),
        status: "active",
        usageCount: 0,
        usedBy: [],
      },
      {
        shop: shop._id,
        name: "First Order Special",
        code: "FIRST50",
        type: "promotional",
        description: "Save ₹500 on your first order",
        value: 500,
        discountType: "flat",
        startDate: new Date(),
        endDate: new Date("2025-12-31"),
        status: "active",
        usageCount: 0,
        usedBy: [],
      },
      {
        shop: shop._id,
        name: "Free Shipping",
        code: "FREESHIP",
        type: "promotional",
        description: "Get free shipping on all orders",
        value: 100,
        discountType: "flat",
        startDate: new Date(),
        endDate: new Date("2025-12-31"),
        status: "active",
        usageCount: 0,
        usedBy: [],
      },
      {
        shop: shop._id,
        name: "Welcome Discount",
        code: "WELCOME10",
        type: "promotional",
        description: "Get 10% off on your order",
        value: 10,
        discountType: "percentage",
        startDate: new Date(),
        endDate: new Date("2025-12-31"),
        status: "active",
        usageCount: 0,
        usedBy: [],
      },
      {
        shop: shop._id,
        name: "Mega Savings",
        code: "MEGA100",
        type: "occasional",
        description: "Save big with ₹1000 off",
        value: 1000,
        discountType: "flat",
        startDate: new Date(),
        endDate: new Date("2025-12-31"),
        status: "active",
        usageCount: 0,
        usedBy: [],
      },
    ];

    // Insert coupons
    const insertedCoupons = await Coupon.insertMany(coupons);
    console.log(`✅ Successfully seeded ${insertedCoupons.length} coupons:`);
    
    insertedCoupons.forEach((coupon) => {
      console.log(`   - ${coupon.code}: ${coupon.name}`);
    });

    console.log("\n🎉 Coupon seeding completed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding coupons:", error);
    process.exit(1);
  }
};

seedCoupons();
