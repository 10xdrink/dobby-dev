const mongoose = require("mongoose");
const Product = require("../models/productModel");
require("dotenv").config();

// Sample feature images and FAQs to add to products
const sampleFeatureImages = [
  [
    {
      url: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop",
      title: "Tailored for a perfect fit",
    },
    {
      url: "https://images.unsplash.com/photo-1567016432779-094069958ea5?w=600&h=400&fit=crop",
      title: "Resistant to water, UV radiation and wear",
    },
  ],
  [
    {
      url: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop",
      title: "Premium quality materials",
    },
    {
      url: "https://images.unsplash.com/photo-1540574163026-643ea20ade25?w=600&h=400&fit=crop",
      title: "Easy to clean and maintain",
    },
  ],
];

const sampleFAQs = [
  [
    {
      question: "What materials is this product made from?",
      answer: "This product is made from high-quality, durable materials designed to last. The specific materials vary by product but are chosen for their durability and comfort.",
    },
    {
      question: "How do I clean this product?",
      answer: "Most of our products can be cleaned with a damp cloth and mild soap. For specific cleaning instructions, please refer to the care label attached to the product.",
    },
    {
      question: "What is the warranty period?",
      answer: "We offer a standard 1-year warranty on all our products, covering manufacturing defects. Extended warranties may be available for certain items.",
    },
    {
      question: "Can I return this product if I'm not satisfied?",
      answer: "Yes, we offer a 30-day return policy. If you're not completely satisfied with your purchase, you can return it within 30 days for a full refund or exchange.",
    },
  ],
  [
    {
      question: "How long will shipping take?",
      answer: "Standard shipping typically takes 3-5 business days. Express shipping options are available for faster delivery.",
    },
    {
      question: "Is this product suitable for outdoor use?",
      answer: "Many of our products are designed for both indoor and outdoor use. Check the product description for specific outdoor suitability.",
    },
    {
      question: "What sizes are available?",
      answer: "We offer a variety of sizes to fit different needs. Please check the product specifications for available size options.",
    },
  ],
];

async function addProductFeatures() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all active products
    const products = await Product.find({ status: "active" });
    console.log(`Found ${products.length} active products`);

    let updatedCount = 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      
      // Randomly select feature images and FAQs
      const featureImages = sampleFeatureImages[i % sampleFeatureImages.length];
      const faqs = sampleFAQs[i % sampleFAQs.length];

      // Update product with feature images and FAQs
      product.featureImages = featureImages;
      product.faqs = faqs;

      await product.save();
      updatedCount++;

      console.log(`✅ Updated product: ${product.productName}`);
    }

    console.log(`\n✨ Successfully updated ${updatedCount} products with feature images and FAQs!`);
    
  } catch (error) {
    console.error("Error updating products:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the script
addProductFeatures();
