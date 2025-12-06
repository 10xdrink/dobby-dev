const mongoose = require("mongoose");
const Product = require("../models/productModel");
const Review = require("../models/Review");
const Customer = require("../models/Customer");
require("dotenv").config();

// Sample review templates
const reviewTemplates = [
  {
    rating: 5,
    title: "Excellent product! Highly recommend",
    content: "This product exceeded my expectations. The quality is outstanding and it works perfectly. I've been using it for a few weeks now and couldn't be happier with my purchase. Worth every penny!",
  },
  {
    rating: 5,
    title: "Perfect! Exactly what I needed",
    content: "Amazing quality and fast delivery. The product matches the description perfectly. I'm very satisfied with this purchase and would definitely buy from this seller again. Great value for money!",
  },
  {
    rating: 4,
    title: "Very good product",
    content: "Good quality product overall. It works well and serves its purpose. The only minor issue is that delivery took a bit longer than expected, but the product itself is great. Would recommend!",
  },
  {
    rating: 5,
    title: "Outstanding quality!",
    content: "I'm thoroughly impressed with this product. The build quality is excellent, and it performs exactly as advertised. Customer service was also very helpful. Definitely worth the investment!",
  },
  {
    rating: 4,
    title: "Great value for money",
    content: "This is a solid product at a reasonable price. It does exactly what it's supposed to do. The quality is good and it looks even better in person. Very happy with this purchase!",
  },
  {
    rating: 5,
    title: "Couldn't be happier!",
    content: "Absolutely love this product! It's well-made, durable, and looks fantastic. The packaging was also excellent. This is definitely one of my best purchases this year. Highly recommended!",
  },
  {
    rating: 4,
    title: "Satisfied with purchase",
    content: "Good product with decent quality. It meets my expectations and works well. The price point is fair for what you get. Would consider buying from this brand again in the future.",
  },
  {
    rating: 5,
    title: "Five stars! Amazing product",
    content: "This product is simply amazing! Superior quality, great design, and excellent functionality. It arrived quickly and was packaged securely. I've already recommended it to my friends and family!",
  },
  {
    rating: 4,
    title: "Nice quality, good buy",
    content: "Pretty happy with this purchase. The product quality is nice and it works as expected. Setup was easy and straightforward. It's a good buy for the price. Would definitely recommend to others!",
  },
  {
    rating: 5,
    title: "Best purchase ever!",
    content: "This is hands down the best product I've bought in this category. Exceptional quality, perfect functionality, and great customer support. It's clear that a lot of thought went into designing this. Absolutely worth it!",
  },
];

// Sample customer names
const customerNames = [
  { firstName: "Rajesh", lastName: "Kumar" },
  { firstName: "Priya", lastName: "Sharma" },
  { firstName: "Amit", lastName: "Patel" },
  { firstName: "Sneha", lastName: "Singh" },
  { firstName: "Vikram", lastName: "Reddy" },
  { firstName: "Anita", lastName: "Verma" },
  { firstName: "Ravi", lastName: "Gupta" },
  { firstName: "Pooja", lastName: "Mehta" },
  { firstName: "Suresh", lastName: "Iyer" },
  { firstName: "Neha", lastName: "Kapoor" },
];

async function createDummyCustomers() {
  console.log("Creating dummy customers for reviews...");
  const customers = [];

  for (const name of customerNames) {
    try {
      // Check if customer already exists
      let customer = await Customer.findOne({
        firstName: name.firstName,
        lastName: name.lastName,
        email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@reviewer.com`,
      });

      if (!customer) {
        customer = await Customer.create({
          firstName: name.firstName,
          lastName: name.lastName,
          email: `${name.firstName.toLowerCase()}.${name.lastName.toLowerCase()}@reviewer.com`,
          password: "dummy123", // This won't be used as these are dummy accounts
          phone: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
          role: "customer",
        });
        console.log(`✅ Created customer: ${name.firstName} ${name.lastName}`);
      } else {
        console.log(`➡️  Customer exists: ${name.firstName} ${name.lastName}`);
      }

      customers.push(customer);
    } catch (err) {
      console.error(`Error creating customer ${name.firstName}:`, err.message);
    }
  }

  return customers;
}

function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

async function addProductReviews() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");

    // Create dummy customers first
    const customers = await createDummyCustomers();
    console.log(`\n✅ ${customers.length} customers ready for reviews\n`);

    // Get all active products
    const products = await Product.find({ status: "active" });
    console.log(`Found ${products.length} active products\n`);

    let totalReviewsAdded = 0;

    for (const product of products) {
      // Random number of reviews (3-4 per product)
      const numReviews = Math.floor(Math.random() * 2) + 3; // 3 or 4
      
      // Shuffle templates and customers for variety
      const shuffledTemplates = shuffleArray(reviewTemplates);
      const shuffledCustomers = shuffleArray(customers);

      console.log(`📝 Adding ${numReviews} reviews for: ${product.productName}`);

      for (let i = 0; i < numReviews; i++) {
        const template = shuffledTemplates[i];
        const customer = shuffledCustomers[i];

        try {
          // Check if review already exists
          const existingReview = await Review.findOne({
            product: product._id,
            customer: customer._id,
          });

          if (existingReview) {
            console.log(`   ➡️  Review already exists for customer ${customer.firstName}`);
            continue;
          }

          // Create review
          const review = await Review.create({
            product: product._id,
            customer: customer._id,
            rating: template.rating,
            title: template.title,
            content: template.content,
            status: "published", // Make it visible immediately
          });

          totalReviewsAdded++;
          console.log(`   ✅ Added ${template.rating}⭐ review by ${customer.firstName} ${customer.lastName}`);

        } catch (err) {
          if (err.code === 11000) {
            console.log(`   ➡️  Duplicate review skipped`);
          } else {
            console.error(`   ❌ Error adding review:`, err.message);
          }
        }
      }

      // Update product's average rating and review count
      const productReviews = await Review.find({ 
        product: product._id, 
        status: "published" 
      });
      
      if (productReviews.length > 0) {
        const avgRating = productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length;
        product.averageRating = Math.round(avgRating * 10) / 10;
        product.reviewCount = productReviews.length;
        await product.save();
        
        console.log(`   📊 Updated product: ${product.averageRating}⭐ (${product.reviewCount} reviews)\n`);
      }
    }

    console.log(`\n✨ Successfully added ${totalReviewsAdded} reviews across ${products.length} products!`);
    console.log(`📊 Average: ${(totalReviewsAdded / products.length).toFixed(1)} reviews per product\n`);
    
  } catch (error) {
    console.error("Error adding reviews:", error);
  } finally {
    await mongoose.connection.close();
    console.log("Database connection closed");
  }
}

// Run the script
addProductReviews();
