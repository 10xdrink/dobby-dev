// seedShopkeeperTemplate.js
// Run: node seedShopkeeperTemplate.js

require('dotenv').config();
const mongoose = require('mongoose');

// Template Schema (same as your model)
const supplierMailTemplateSchema = new mongoose.Schema({
  templateType: {
    type: String,
    enum: [
      "registration_complete",
      "registration_approved",
      "registration_rejected",
      "account_activated",
      "account_suspended",
      "forgot_password",
      "order_recieved"
    ],
    required: true,
    unique: true
  },
  iconUrl: { type: String },
  iconPublicId: { type: String },
  logoUrl: { type: String },
  logoPublicId: { type: String },
  title: { type: String, required: true },
  mailBody: { type: String, required: true },
  footerSectionText: { type: String },
  pageLinks: {
    privacyPolicy: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "https://test-dobby.vercel.app/privacy-policy" }
    },
    refundPolicy: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "https://test-dobby.vercel.app/refund-policy" }
    },
    cancellationPolicy: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "https://test-dobby.vercel.app/cancellation-policy" }
    },
    contactUs: {
      enabled: { type: Boolean, default: false },
      url: { type: String, default: "https://test-dobby.vercel.app/contact-us" }
    }
  },
  socialMediaLinks: {
    facebook: { enabled: { type: Boolean, default: false }, url: { type: String, default: "" } },
    instagram: { enabled: { type: Boolean, default: false }, url: { type: String, default: "" } },
    X: { enabled: { type: Boolean, default: false }, url: { type: String, default: "" } },
    linkedin: { enabled: { type: Boolean, default: false }, url: { type: String, default: "" } },
    youtube: { enabled: { type: Boolean, default: false }, url: { type: String, default: "" } }
  },
  copyrightText: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const SupplierMailTemplate = mongoose.model("SupplierMailTemplate", supplierMailTemplateSchema);

// Template Data
const shopkeeperOrderTemplate = {
  templateType: "order_recieved",
  title: "New Order Received",
  logoUrl: "https://res.cloudinary.com/dwgvqj3q5/image/upload/v1762410907/dobbyMall/d6cogylmb1ddk5i9mmdw.png",
  iconUrl: "https://res.cloudinary.com/dwgvqj3q5/image/upload/v1762410907/dobbyMall/x3i9wririq4irp8p8lrm.jpg",
  mailBody: `Hi {Shopkeeper Name},

🎉 Congratulations! You've received a new order from {CustomerName}.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📦 ORDER INFORMATION

• Order Number: {OrderNumber}
• Order Date: {OrderDate}
• Shop: {ShopName}
• Shipment Status: {ShipmentStatus}
• Tracking ID: {TrackingId}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👤 CUSTOMER DETAILS

• Name: {CustomerName}
• Email: {CustomerEmail}
• Phone: {CustomerPhone}

📍 DELIVERY ADDRESS
{DeliveryAddress}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{OrderItemsHTML}

⚠️ IMPORTANT NOTE
This shows only items from YOUR shop. The customer may have ordered from multiple shops in the same order.

{LoginButton}

📦 Next Steps:
1. Login to your panel
2. Review order details
3. Prepare items for shipment
4. Update shipment status

Thank you for being a valued partner!`,
  footerSectionText: "If you have any questions about this order, please contact our support team. We're here to help!",
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
    facebook: {
      enabled: true,
      url: "https://facebook.com/dobbymall"
    },
    instagram: {
      enabled: true,
      url: "https://instagram.com/dobbymall"
    },
    X: {
      enabled: true,
      url: "https://twitter.com/dobbymall"
    },
    linkedin: {
      enabled: true,
      url: "https://linkedin.com/company/dobbymall"
    },
    youtube: {
      enabled: false,
      url: ""
    }
  },
  copyrightText: "© 2025 Dobby Mall. All rights reserved.",
  isActive: true
};

// Main Function
async function seedTemplate() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/dobby-mall', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('✅ Connected to MongoDB');

    // Check if template already exists
    const existingTemplate = await SupplierMailTemplate.findOne({ 
      templateType: "order_recieved" 
    });

    if (existingTemplate) {
      console.log('⚠️  Template already exists. Updating...');
      
      // Update existing template
      await SupplierMailTemplate.updateOne(
        { templateType: "order_recieved" },
        { $set: shopkeeperOrderTemplate }
      );
      
      console.log('✅ Template updated successfully!');
    } else {
      console.log('📝 Creating new template...');
      
      // Create new template
      await SupplierMailTemplate.create(shopkeeperOrderTemplate);
      
      console.log('✅ Template created successfully!');
    }

    // Fetch and display the template
    const savedTemplate = await SupplierMailTemplate.findOne({ 
      templateType: "order_recieved" 
    });

    console.log('\n📄 Template Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Template Type:', savedTemplate.templateType);
    console.log('Title:', savedTemplate.title);
    console.log('Is Active:', savedTemplate.isActive);
    console.log('Created At:', savedTemplate.createdAt);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n✅ Script completed successfully!');
    console.log('🚀 Now place an order to test the email template.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the script
seedTemplate();