const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Review = require("../models/Review");
require("dotenv").config();

async function updateProductRatings() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all products
    const products = await Product.find({});
    console.log(`Found ${products.length} products\n`);

    let updatedCount = 0;

    for (const product of products) {
      try {
        // Get all published reviews for this product
        const reviews = await Review.find({ 
          product: product._id, 
          status: "published" 
        });

        if (reviews.length > 0) {
          // Calculate average rating
          const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
          
          // Update product
          product.averageRating = Math.round(avgRating * 10) / 10;
          product.reviewCount = reviews.length;
          await product.save();

          updatedCount++;
          console.log(`✅ ${product.productName}: ${product.averageRating}⭐ (${product.reviewCount} reviews)`);
        } else {
          // No reviews - set to 0
          if (product.averageRating !== 0 || product.reviewCount !== 0) {
            product.averageRating = 0;
            product.reviewCount = 0;
            await product.save();
            console.log(`➡️  ${product.productName}: No reviews (reset to 0)`);
          }
        }
      } catch (err) {
        console.error(`❌ Error updating ${product.productName}:`, err.message);
      }
    }

    console.log(`\n✨ Successfully updated ratings for ${updatedCount} products!`);
    
  } catch (error) {
    console.error("Error updating ratings:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the script
updateProductRatings();
