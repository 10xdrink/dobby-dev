const mongoose = require("mongoose");
const dotenv = require("dotenv");
const SupplierMailTemplate = require("../models/SupplierMailTemplate");

// Load env vars
dotenv.config({ path: "../.env" });
// Also try default path in case script is run from root
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test-dobby";

const templateData = {
  templateType: "order_received",
  title: "You Have Received a New Order! 🎉",
  isActive: true,
  mailBody: `
    <p>Dear <strong>{VendorName}</strong>,</p>
    
    <p>Great news! You have received a new order on <strong>{ShopName}</strong>.</p>
    
    <p><strong>Order Number:</strong> {OrderNumber}<br>
    <strong>Order Date:</strong> {OrderDate}</p>
    
    <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
    
    <h3 style="color:#333;">Customer Details</h3>
    <p>
      <strong>Name:</strong> {CustomerName}<br>
      <strong>Phone:</strong> {CustomerPhone}<br>
      <strong>Email:</strong> {CustomerEmail}
    </p>
    
    <h3 style="color:#333;">Shipping Address</h3>
    <p style="background:#f9f9f9; padding:10px; border-radius:5px;">
      {DeliveryAddress}
    </p>
    
    <h3 style="color:#333;">Order Items</h3>
    {OrderItemsHTML}
    
    {LoginButton}
    
    <p>Please login to your dashboard to process this order and schedule the shipment.</p>
  `,
  footerSectionText: "Need help? Contact our support team at support@dobby.com",
  copyrightText: "© 2024 Dobby. All rights reserved.",
  pageLinks: {
    privacyPolicy: { enabled: true, url: "https://test-dobby.vercel.app/privacy-policy" },
    refundPolicy: { enabled: true, url: "https://test-dobby.vercel.app/refund-policy" },
    cancellationPolicy: { enabled: true, url: "https://test-dobby.vercel.app/cancellation-policy" },
    contactUs: { enabled: true, url: "https://test-dobby.vercel.app/contact-us" }
  },
  socialMediaLinks: {
    facebook: { enabled: true, url: "https://facebook.com" },
    instagram: { enabled: true, url: "https://instagram.com" }
  }
};

async function seedTemplate() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    // 1. Check for old typo version and delete it
    const oldTypo = await SupplierMailTemplate.findOne({ templateType: "order_recieved" });
    if (oldTypo) {
      console.log("Found template with typo 'order_recieved'. Deleting...");
      await SupplierMailTemplate.deleteOne({ _id: oldTypo._id });
      console.log("Deleted old typo template.");
    }

    // 2. Check if correct version exists
    let template = await SupplierMailTemplate.findOne({ templateType: "order_received" });

    if (template) {
      console.log("Template 'order_received' already exists. Updating content...");
      template.set(templateData);
      await template.save();
      console.log("Template updated successfully.");
    } else {
      console.log("Creating new 'order_received' template...");
      template = await SupplierMailTemplate.create(templateData);
      console.log("Template created successfully.");
    }

    console.log("Done.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding template:", error);
    process.exit(1);
  }
}

seedTemplate();
