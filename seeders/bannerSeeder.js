const mongoose = require("mongoose");
const Banner = require("../models/banner");
const logger = require("../config/logger");
require("dotenv").config();

const bannerData = [
  {
    bannerType: "Slider",
    bannerUrl: "/products",
    resourceType: "Category",
    image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=1200&h=600&fit=crop",
    imagePublicId: "dobby_banner_1",
    title: "Uncover",
    subtitle: "Happiness",
    description: "Discover amazing products for your daily needs",
    buttonText: "Shop Now",
    buttonUrl: "/products",
    textColor: "#FFFFFF",
    buttonColor: "#2563EB",
    overlayOpacity: 0.4,
    displayOrder: 1,
    published: true,
  },
  {
    bannerType: "Slider",
    bannerUrl: "/products?category=electronics",
    resourceType: "Category",
    image: "https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=1200&h=600&fit=crop",
    imagePublicId: "dobby_banner_2",
    title: "Discover",
    subtitle: "Quality",
    description: "Premium products at unbeatable prices",
    buttonText: "Explore Now",
    buttonUrl: "/products?category=electronics",
    textColor: "#FFFFFF",
    buttonColor: "#059669",
    overlayOpacity: 0.3,
    displayOrder: 2,
    published: true,
  },
  {
    bannerType: "Slider",
    bannerUrl: "/products?featured=true",
    resourceType: "Product",
    image: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&h=600&fit=crop",
    imagePublicId: "dobby_banner_3",
    title: "Explore",
    subtitle: "Beauty",
    description: "Curated collections just for you",
    buttonText: "View Collection",
    buttonUrl: "/products?featured=true",
    textColor: "#FFFFFF",
    buttonColor: "#DC2626",
    overlayOpacity: 0.35,
    displayOrder: 3,
    published: true,
  },
  {
    bannerType: "Slider",
    bannerUrl: "/products?deals=true",
    resourceType: "Product",
    image: "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=1200&h=600&fit=crop",
    imagePublicId: "dobby_banner_4",
    title: "Find",
    subtitle: "Perfection",
    description: "Everything you need in one place",
    buttonText: "Browse Deals",
    buttonUrl: "/products?deals=true",
    textColor: "#FFFFFF",
    buttonColor: "#7C3AED",
    overlayOpacity: 0.4,
    displayOrder: 4,
    published: true,
  },
  {
    bannerType: "Slider",
    bannerUrl: "/products?new=true",
    resourceType: "Product",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=600&fit=crop",
    imagePublicId: "dobby_banner_5",
    title: "New Arrivals",
    subtitle: "Fresh Collection",
    description: "Check out the latest products",
    buttonText: "See What's New",
    buttonUrl: "/products?new=true",
    textColor: "#FFFFFF",
    buttonColor: "#F59E0B",
    overlayOpacity: 0.45,
    displayOrder: 5,
    published: true,
  },
];

async function seedBanners() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URL;
    
    if (!mongoUri) {
      console.error("❌ Error: MONGO_URI or MONGO_URL not found in environment variables");
      console.error("Please check your .env file");
      process.exit(1);
    }
    
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(mongoUri);
    logger.info("✅ Connected to MongoDB for seeding");

    // Clear existing banners
    await Banner.deleteMany({ bannerType: "Slider" });
    logger.info("🗑️  Cleared existing slider banners");

    // Insert new banners
    const insertedBanners = await Banner.insertMany(bannerData);
    logger.info(`✅ Successfully seeded ${insertedBanners.length} banners`);

    // Display created banners
    console.log("\n📋 Created Banners:");
    insertedBanners.forEach((banner, index) => {
      console.log(`\n${index + 1}. ${banner.title} - ${banner.subtitle}`);
      console.log(`   Image: ${banner.image}`);
      console.log(`   Button: "${banner.buttonText}" → ${banner.buttonUrl}`);
      console.log(`   Published: ${banner.published}`);
      console.log(`   Display Order: ${banner.displayOrder}`);
    });

    console.log("\n✅ Banner seeding completed successfully!\n");

    // Close connection
    await mongoose.connection.close();
    logger.info("🔌 MongoDB connection closed");
    
    process.exit(0);
  } catch (error) {
    logger.error("❌ Error seeding banners:", error);
    console.error(error);
    process.exit(1);
  }
}

// Run seeder
seedBanners();
