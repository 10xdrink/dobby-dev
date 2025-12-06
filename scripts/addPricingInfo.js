const mongoose = require("mongoose");
const Product = require("../models/productModel");
const ProductCategory = require("../models/ProductCategory");
require("dotenv").config();

// Sample pricing information templates by category
const pricingTemplates = {
  electronics: {
    description: "We offer competitive pricing with full transparency. All costs are clearly displayed upfront, including any applicable taxes and warranties.",
    features: [
      { icon: 'shield', text: 'Extended warranty options available at checkout' },
      { icon: 'gift', text: 'Free accessories with select models' },
      { icon: 'tag', text: 'Price match guarantee - we match any competitor price' },
      { icon: 'truck', text: 'Free express shipping on orders above a threshold' },
    ]
  },
  
  fashion: {
    description: "Transparent pricing with seasonal offers. Our prices reflect premium quality materials and craftsmanship. Special bulk discounts available.",
    features: [
      { icon: 'tag', text: 'Seasonal discounts up to 50% off' },
      { icon: 'gift', text: 'Buy 2, get 10% off additional items' },
      { icon: 'truck', text: 'Free shipping on orders above threshold' },
      { icon: 'shield', text: 'Easy 30-day return and exchange policy' },
    ]
  },
  
  books: {
    description: "Fair pricing for quality content. Bulk purchase discounts available for educational institutions. Digital versions available at reduced prices.",
    features: [
      { icon: 'tag', text: 'Bulk discounts for orders of 10+ books' },
      { icon: 'gift', text: 'Combo offers on series and collections' },
      { icon: 'truck', text: 'Free delivery across India' },
      { icon: 'shield', text: 'Secure packaging to prevent damage' },
    ]
  },
  
  furniture: {
    description: "Premium quality furniture at competitive prices. Custom sizing available. Installation services included for select items.",
    features: [
      { icon: 'ruler', text: 'Custom dimensions available at additional cost' },
      { icon: 'wrench', text: 'Professional installation included' },
      { icon: 'shield', text: '1-year warranty on manufacturing defects' },
      { icon: 'truck', text: 'White glove delivery service' },
    ]
  },
  
  sports: {
    description: "Quality sports equipment at honest prices. Professional-grade products with beginners welcome. Bulk discounts for teams and academies.",
    features: [
      { icon: 'star', text: 'Professional-grade quality at affordable prices' },
      { icon: 'tag', text: 'Team and academy bulk discounts available' },
      { icon: 'gift', text: 'Combo deals on related equipment' },
      { icon: 'truck', text: 'Fast dispatch and delivery' },
    ]
  },
  
  homeKitchen: {
    description: "Premium home and kitchen products at fair prices. All products come with manufacturer warranty. Installation guides included.",
    features: [
      { icon: 'shield', text: 'Manufacturer warranty included' },
      { icon: 'wrench', text: 'Free installation support via video call' },
      { icon: 'tag', text: 'Festival offers and seasonal discounts' },
      { icon: 'truck', text: 'Careful packaging and handling' },
    ]
  },
  
  general: {
    description: "We believe in fair and transparent pricing. All costs are clearly displayed upfront with no hidden charges. Quality products at competitive prices.",
    features: [
      { icon: 'tag', text: 'Best price guarantee - competitive market rates' },
      { icon: 'gift', text: 'Special offers and bundle deals' },
      { icon: 'truck', text: 'Free shipping on eligible orders' },
      { icon: 'shield', text: 'Quality assurance and easy returns' },
    ]
  }
};

// Function to determine template based on category name
function getPricingTemplate(categoryName) {
  const categoryLower = categoryName.toLowerCase();
  
  if (categoryLower.includes('electronic') || categoryLower.includes('mobile') || categoryLower.includes('laptop') || categoryLower.includes('phone')) {
    return pricingTemplates.electronics;
  } else if (categoryLower.includes('fashion') || categoryLower.includes('cloth') || categoryLower.includes('shoe') || categoryLower.includes('apparel')) {
    return pricingTemplates.fashion;
  } else if (categoryLower.includes('book') || categoryLower.includes('novel') || categoryLower.includes('magazine')) {
    return pricingTemplates.books;
  } else if (categoryLower.includes('furniture') || categoryLower.includes('sofa') || categoryLower.includes('table') || categoryLower.includes('chair')) {
    return pricingTemplates.furniture;
  } else if (categoryLower.includes('sport') || categoryLower.includes('fitness') || categoryLower.includes('gym') || categoryLower.includes('yoga')) {
    return pricingTemplates.sports;
  } else if (categoryLower.includes('home') || categoryLower.includes('kitchen') || categoryLower.includes('appliance')) {
    return pricingTemplates.homeKitchen;
  } else {
    return pricingTemplates.general;
  }
}

async function addPricingInfo() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Get all active products with category populated
    const products = await Product.find({ status: "active" }).populate('category');
    console.log(`Found ${products.length} active products\n`);

    let updatedCount = 0;

    for (const product of products) {
      try {
        // Skip if already has pricing info
        if (product.pricingInfo && product.pricingInfo.description) {
          console.log(`➡️  Skipping ${product.productName} - already has pricing info`);
          continue;
        }

        // Get appropriate template based on category
        const categoryName = product.category?.name || 'General';
        const template = getPricingTemplate(categoryName);

        // Add pricing info to product
        product.pricingInfo = {
          description: template.description,
          features: template.features
        };

        await product.save();
        updatedCount++;

        console.log(`✅ Updated ${product.productName} (${categoryName})`);

      } catch (err) {
        console.error(`❌ Error updating ${product.productName}:`, err.message);
      }
    }

    console.log(`\n✨ Successfully added pricing info to ${updatedCount} products!`);
    
  } catch (error) {
    console.error("Error adding pricing info:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the script
addPricingInfo();
