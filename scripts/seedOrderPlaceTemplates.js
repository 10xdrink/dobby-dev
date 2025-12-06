const mongoose = require("mongoose");
const CustomerMailTemplate = require("../models/CustomerMailTemplate");
require("dotenv").config();

async function seedOrderPlaceTemplate() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to database");

    const existingTemplate = await CustomerMailTemplate.findOne({
      templateType: "order_place",
    });

    if (existingTemplate) {
      console.log("Order place template already exists. Skipping seed.");
      process.exit(0);
    }

    const defaultTemplate = new CustomerMailTemplate({
      templateType: "order_place",
      title: "Order has been placed successfully!",
      
      mailBody: `
        <p>Hi {Name},</p>
        <p>Thank you for your order! Your order has been confirmed and is being processed.</p>
        <p><strong>Order Number:</strong> {OrderNumber}</p>
        <p><strong>Order Date:</strong> {OrderDate}</p>
        <p>To track the current status of your order, click the button below:</p>
        {TrackOrderButton}

      `,

      footerSectionText: "Please contact us for any queries, we're always happy to help.",
      
      copyrightText: "Copyright 2025 Dobby Mall. All rights reserved.",
      
      pageLinks: {
        privacyPolicy: {
          enabled: true,
          url: "https://test-dobby.vercel.app/privacy-policy"
        },
        refundPolicy: {
          enabled: true,
          url: "https://test-dobby.vercel.app/refund-policy"
        },
        cancellationPolicy: {
          enabled: true,
          url: "https://test-dobby.vercel.app/cancellation-policy"
        },
        contactUs: {
          enabled: true,
          url: "https://test-dobby.vercel.app/contact-us"
        }
      },
      
      socialMediaLinks: {
        facebook: { enabled: true, url: "https://www.facebook.com/dobby" },
        instagram: { enabled: true , url: "https://www.instagram.com/dobby" },
        X: { enabled: true, url: "https://www.x.com/dobby" },
        linkedin: { enabled: true, url: "https://www.linkedin.com/dobby" },
        youtube: { enabled: true, url: "https://www.youtube.com/dobby" }
      },
      
      isActive: true
    });

    await defaultTemplate.save();
    console.log(" Default order place template created successfully");
    
    process.exit(0);
  } catch (error) {
    console.error("Error seeding template:", error);
    process.exit(1);
  }
}

seedOrderPlaceTemplate();