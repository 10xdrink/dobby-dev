require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/productModel");

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

// Product name to image URL mapping
const productImages = {
  "iPhone 15 Pro": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500",
  "Samsung Galaxy S24": "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500",
  "MacBook Pro M3": "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500",
  "Dell XPS 15": "https://images.unsplash.com/photo-1593642632823-8f785ba67e45?w=500",
  "Sony WH-1000XM5": "https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500",
  "Canon EOS R6": "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500",
  "Levi's Men's Jeans": "https://images.unsplash.com/photo-1542272604-787c3835535d?w=500",
  "Nike Air Max": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
  "Zara Women's Dress": "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=500",
  "Adidas Tracksuit": "https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=500",
  "Ray-Ban Sunglasses": "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=500",
  "Leather Wallet": "https://images.unsplash.com/photo-1627123424574-724758594e93?w=500",
  "IKEA Study Table": "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=500",
  "Urban Ladder Sofa": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500",
  "Prestige Induction Cooktop": "https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=500",
  "Hawkins Pressure Cooker": "https://images.unsplash.com/photo-1584990347449-39b5e33e5b0a?w=500",
  "Wall Painting Set": "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=500",
  "LG Washing Machine": "https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?w=500",
  "The Alchemist": "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=500",
  "Atomic Habits": "https://images.unsplash.com/photo-1589829085413-56de8ae18c73?w=500",
  "Harry Potter Collection": "https://images.unsplash.com/photo-1621351183012-e2f9972dd9bf?w=500",
  "Physics NCERT Class 12": "https://images.unsplash.com/photo-1532012197267-da84d127e765?w=500",
  "Marvel Comics Bundle": "https://images.unsplash.com/photo-1612036782180-6f0b6cd846fe?w=500",
  "Adjustable Dumbbells": "https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=500",
  "Yoga Mat": "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500",
  "Nike Dri-FIT T-Shirt": "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500",
  "Camping Tent": "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?w=500",
  "Whey Protein 1kg": "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500",
  "Resistance Bands Set": "https://images.unsplash.com/photo-1598289431512-b97b0917affc?w=500",
  "Cricket Bat": "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=500",
};

// Update product images
const updateProductImages = async () => {
  try {
    await connectDB();

    console.log("\n🖼️  Starting Product Image Update Process...\n");

    let updateCount = 0;
    let skipCount = 0;
    let notFoundCount = 0;

    for (const [productName, imageUrl] of Object.entries(productImages)) {
      try {
        const product = await Product.findOne({ productName });

        if (!product) {
          console.log(`  ⚠️  Product not found: ${productName}`);
          notFoundCount++;
          continue;
        }

        if (product.icon1) {
          console.log(`  ⏭️  Skipped (already has image): ${productName}`);
          skipCount++;
          continue;
        }

        product.icon1 = imageUrl;
        await product.save();

        console.log(`  ✅ Updated: ${productName}`);
        updateCount++;
      } catch (error) {
        console.error(`  ❌ Failed to update ${productName}:`, error.message);
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 Product Image Update Complete!");
    console.log("=".repeat(60));
    console.log(`✅ Successfully updated: ${updateCount} products`);
    console.log(`⏭️  Skipped (already have images): ${skipCount} products`);
    console.log(`⚠️  Not found: ${notFoundCount} products`);
    console.log("=".repeat(60) + "\n");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Update Error:", error);
    process.exit(1);
  }
};

// Run update
updateProductImages();
