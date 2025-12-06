require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
const ProductSubCategory = require("../models/SubProductCategory");
const Shop = require("../models/Shop");
const User = require("../models/User");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Connected Successfully");
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
};

// Sample categories with subcategories
const categories = [
  {
    name: "Electronics",
    subcategories: ["Mobile Phones", "Laptops", "Headphones", "Cameras"],
  },
  {
    name: "Fashion",
    subcategories: ["Men's Clothing", "Women's Clothing", "Footwear", "Accessories"],
  },
  {
    name: "Home & Kitchen",
    subcategories: ["Furniture", "Kitchenware", "Home Decor", "Appliances"],
  },
  {
    name: "Books",
    subcategories: ["Fiction", "Non-Fiction", "Educational", "Comics"],
  },
  {
    name: "Sports & Fitness",
    subcategories: ["Gym Equipment", "Sports Wear", "Outdoor Gear", "Nutrition"],
  },
];

// Product templates with CDN image URLs
const productTemplates = [
  // Electronics
  { name: "iPhone 15 Pro", category: "Electronics", subCategory: "Mobile Phones", price: 99999, description: "Latest Apple iPhone with A17 Pro chip", unit: "piece", stock: 50, discount: 5000, image: "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500" },
  { name: "Samsung Galaxy S24", category: "Electronics", subCategory: "Mobile Phones", price: 79999, description: "Premium Android smartphone", unit: "piece", stock: 45, discount: 4000, image: "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500" },
  { name: "MacBook Pro M3", category: "Electronics", subCategory: "Laptops", price: 199999, description: "Professional laptop with M3 chip", unit: "piece", stock: 30, discount: 10000, image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500" },
  { name: "Dell XPS 15", category: "Electronics", subCategory: "Laptops", price: 149999, description: "High-performance Windows laptop", unit: "piece", stock: 25, discount: 8000, image: "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500" },
  { name: "Sony WH-1000XM5", category: "Electronics", subCategory: "Headphones", price: 29999, description: "Premium noise-cancelling headphones", unit: "piece", stock: 60, discount: 2000, image: "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500" },
  { name: "Canon EOS R6", category: "Electronics", subCategory: "Cameras", price: 249999, description: "Professional mirrorless camera", unit: "piece", stock: 15, discount: 15000, image: "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500" },
  
  // Fashion
  { name: "Levi's Men's Jeans", category: "Fashion", subCategory: "Men's Clothing", price: 2999, description: "Classic denim jeans", unit: "piece", stock: 100, discount: 300, image: "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500" },
  { name: "Nike Air Max", category: "Fashion", subCategory: "Footwear", price: 8999, description: "Comfortable running shoes", unit: "piece", stock: 80, discount: 1000, image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500" },
  { name: "Zara Women's Dress", category: "Fashion", subCategory: "Women's Clothing", price: 3499, description: "Elegant summer dress", unit: "piece", stock: 70, discount: 400, image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500" },
  { name: "Adidas Tracksuit", category: "Fashion", subCategory: "Men's Clothing", price: 4999, description: "Sporty tracksuit set", unit: "piece", stock: 65, discount: 500, image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500" },
  { name: "Ray-Ban Sunglasses", category: "Fashion", subCategory: "Accessories", price: 12999, description: "Classic aviator sunglasses", unit: "piece", stock: 55, discount: 1500, image: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500" },
  { name: "Leather Wallet", category: "Fashion", subCategory: "Accessories", price: 1999, description: "Genuine leather bifold wallet", unit: "piece", stock: 90, discount: 200, image: "https://images.unsplash.com/photo-1627123424574-724758594e93?w=500" },
  
  // Home & Kitchen
  { name: "IKEA Study Table", category: "Home & Kitchen", subCategory: "Furniture", price: 8999, description: "Ergonomic wooden study table", unit: "piece", stock: 40, discount: 1000, image: "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500" },
  { name: "Urban Ladder Sofa", category: "Home & Kitchen", subCategory: "Furniture", price: 34999, description: "3-seater comfortable sofa", unit: "piece", stock: 20, discount: 3000, image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500" },
  { name: "Prestige Induction Cooktop", category: "Home & Kitchen", subCategory: "Kitchenware", price: 3499, description: "Energy-efficient induction cooker", unit: "piece", stock: 50, discount: 400, image: "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500" },
  { name: "Hawkins Pressure Cooker", category: "Home & Kitchen", subCategory: "Kitchenware", price: 2499, description: "5L aluminum pressure cooker", unit: "piece", stock: 75, discount: 250, image: "https://images.unsplash.com/photo-1584990347449-39b5e33e5b0a?w=500" },
  { name: "Wall Painting Set", category: "Home & Kitchen", subCategory: "Home Decor", price: 2999, description: "Set of 3 canvas paintings", unit: "piece", stock: 45, discount: 300, image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500" },
  { name: "LG Washing Machine", category: "Home & Kitchen", subCategory: "Appliances", price: 24999, description: "7kg fully automatic front load", unit: "piece", stock: 25, discount: 2500, image: "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500" },
  
  // Books
  { name: "The Alchemist", category: "Books", subCategory: "Fiction", price: 399, description: "Paulo Coelho's bestselling novel", unit: "piece", stock: 150, discount: 40, image: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500" },
  { name: "Atomic Habits", category: "Books", subCategory: "Non-Fiction", price: 499, description: "James Clear's habit-forming guide", unit: "piece", stock: 120, discount: 50, image: "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=500" },
  { name: "Harry Potter Collection", category: "Books", subCategory: "Fiction", price: 2999, description: "Complete 7-book box set", unit: "piece", stock: 60, discount: 300, image: "https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=500" },
  { name: "Physics NCERT Class 12", category: "Books", subCategory: "Educational", price: 299, description: "NCERT textbook for class 12", unit: "piece", stock: 200, discount: 30, image: "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500" },
  { name: "Marvel Comics Bundle", category: "Books", subCategory: "Comics", price: 1999, description: "10 classic Marvel comics", unit: "piece", stock: 80, discount: 200, image: "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=500" },
  
  // Sports & Fitness
  { name: "Adjustable Dumbbells", category: "Sports & Fitness", subCategory: "Gym Equipment", price: 4999, description: "10kg adjustable weight set", unit: "piece", stock: 40, discount: 500, image: "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500" },
  { name: "Yoga Mat", category: "Sports & Fitness", subCategory: "Gym Equipment", price: 799, description: "Anti-slip exercise yoga mat", unit: "piece", stock: 100, discount: 80, image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500" },
  { name: "Nike Dri-FIT T-Shirt", category: "Sports & Fitness", subCategory: "Sports Wear", price: 1499, description: "Moisture-wicking sports t-shirt", unit: "piece", stock: 85, discount: 150, image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500" },
  { name: "Camping Tent", category: "Sports & Fitness", subCategory: "Outdoor Gear", price: 8999, description: "4-person waterproof camping tent", unit: "piece", stock: 30, discount: 1000, image: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=500" },
  { name: "Whey Protein 1kg", category: "Sports & Fitness", subCategory: "Nutrition", price: 2999, description: "Premium whey protein powder", unit: "piece", stock: 70, discount: 300, image: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500" },
  { name: "Resistance Bands Set", category: "Sports & Fitness", subCategory: "Gym Equipment", price: 999, description: "5-piece resistance band set", unit: "piece", stock: 95, discount: 100, image: "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500" },
  { name: "Cricket Bat", category: "Sports & Fitness", subCategory: "Outdoor Gear", price: 3499, description: "English willow cricket bat", unit: "piece", stock: 50, discount: 350, image: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500" },
];

// Create or get shop
const getOrCreateShop = async () => {
  try {
    // Check if shop exists
    let shop = await Shop.findOne({ status: "active" });
    
    if (shop) {
      console.log("✅ Found existing active shop:", shop.shopName);
      return shop;
    }

    // Check if user exists
    let user = await User.findOne({ role: "shopkeeper" });
    
    if (!user) {
      // Create a sample shopkeeper user
      const bcrypt = require("bcrypt");
      const hashedPassword = await bcrypt.hash("password123", 10);
      
      user = await User.create({
        firstName: "Sample",
        lastName: "Shopkeeper",
        email: "shopkeeper@example.com",
        phone: "9999999999",
        password: hashedPassword,
        role: "shopkeeper",
        isVerified: true,
      });
      console.log("✅ Created sample shopkeeper user");
    }

    // Create shop
    shop = await Shop.create({
      shopName: "Dobby Marketplace",
      phoneNumber: user.phone,
      address: "123 Main Street, City Center, State - 123456",
      status: "active",
      owner: user._id,
      averageRating: 4.5,
      totalReviews: 100,
    });

    console.log("✅ Created new shop:", shop.shopName);
    return shop;
  } catch (error) {
    console.error("❌ Error creating shop:", error.message);
    throw error;
  }
};

// Create categories and subcategories
const setupCategories = async () => {
  const categoryMap = {};

  for (const catData of categories) {
    // Create or find category
    let category = await ProductCategory.findOne({ name: catData.name });
    if (!category) {
      category = await ProductCategory.create({
        name: catData.name,
        status: "active",
      });
      console.log(`✅ Created category: ${catData.name}`);
    } else {
      console.log(`✓ Category exists: ${catData.name}`);
    }

    categoryMap[catData.name] = { _id: category._id, subcategories: {} };

    // Create subcategories
    for (const subCatName of catData.subcategories) {
      let subCategory = await ProductSubCategory.findOne({
        name: subCatName,
        category: category._id,
      });

      if (!subCategory) {
        subCategory = await ProductSubCategory.create({
          name: subCatName,
          category: category._id,
        });
        console.log(`  ✅ Created subcategory: ${subCatName}`);
      } else {
        console.log(`  ✓ Subcategory exists: ${subCatName}`);
      }

      categoryMap[catData.name].subcategories[subCatName] = subCategory._id;
    }
  }

  return categoryMap;
};

// Generate unique SKU
const generateSKU = (productName) => {
  const prefix = productName
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .substring(0, 4);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${random}`;
};

// Generate unique Product ID
const generateProductId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PRD-${timestamp}-${random}`;
};

// Seed products
const seedProducts = async () => {
  try {
    await connectDB();

    console.log("\n🌱 Starting Product Seeding Process...\n");

    // Check existing products
    const existingCount = await Product.countDocuments();
    console.log(`📦 Existing products in database: ${existingCount}`);

    if (existingCount >= 30) {
      console.log("\n⚠️  Database already has 30+ products. Do you want to:");
      console.log("   1. Skip seeding");
      console.log("   2. Add more products anyway");
      console.log("   3. Clear existing and reseed");
      console.log("\n💡 To clear existing products, run: await Product.deleteMany({})");
      console.log("   For now, skipping seed process.\n");
      return;
    }

    // Setup categories
    console.log("\n📁 Setting up categories and subcategories...\n");
    const categoryMap = await setupCategories();

    // Get or create shop
    console.log("\n🏪 Setting up shop...\n");
    const shop = await getOrCreateShop();

    // Create products
    console.log("\n📦 Creating products...\n");
    let successCount = 0;
    let skipCount = 0;

    for (const template of productTemplates) {
      try {
        const categoryId = categoryMap[template.category]._id;
        const subCategoryId = categoryMap[template.category].subcategories[template.subCategory];

        // Check if product already exists
        const existing = await Product.findOne({
          productName: template.name,
          shop: shop._id,
        });

        if (existing) {
          console.log(`  ⏭️  Skipped (exists): ${template.name}`);
          skipCount++;
          continue;
        }

        const product = await Product.create({
          productId: generateProductId(),
          shop: shop._id,
          productName: template.name,
          description: template.description,
          category: categoryId,
          subCategory: subCategoryId,
          unit: template.unit,
          sku: generateSKU(template.name),
          unitPrice: template.price,
          currentStock: template.stock,
          minStockQty: 5,
          minOrderQty: 1,
          discountType: "flat",
          discountValue: template.discount,
          taxType: "inclusive",
          shippingCost: template.price > 5000 ? 0 : 100,
          status: "active",
          searchTags: template.name.toLowerCase().split(" "),
          icon1: template.image, // Primary product image from CDN
        });

        console.log(`  ✅ Created: ${product.productName} (SKU: ${product.sku})`);
        successCount++;
      } catch (error) {
        console.error(`  ❌ Failed to create ${template.name}:`, error.message);
      }
    }

    // Summary
    const totalProducts = await Product.countDocuments();
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Product Seeding Complete!");
    console.log("=".repeat(60));
    console.log(`✅ Successfully created: ${successCount} products`);
    console.log(`⏭️  Skipped (already exist): ${skipCount} products`);
    console.log(`📦 Total products in database: ${totalProducts}`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Seeding Error:", error);
    process.exit(1);
  }
};

// Run seeding
seedProducts();
