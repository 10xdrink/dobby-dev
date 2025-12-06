const mongoose = require("mongoose");
const dotenv = require("dotenv");
const CustomerMailTemplate = require("../models/CustomerMailTemplate");

// Load env vars
dotenv.config({ path: "../.env" });
// Also try default path in case script is run from root
dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/test-dobby";

const templates = [
  {
    templateType: "account_block",
    title: "Your Account Has Been Suspended ",
    mailBody: `
      <p>Dear <strong>{CustomerName}</strong>,</p>
      <p>We regret to inform you that your account has been suspended due to a violation of our terms of service or suspicious activity.</p>
      <p>During this suspension, you will not be able to place new orders or access your account profile.</p>
      <p>If you believe this action was taken in error, please contact our support team for assistance.</p>
    `,
    buttonName: "Contact Support",
    buttonRedirectLink: "https://test-dobby.vercel.app/contact-us",
    isActive: true
  },
  {
    templateType: "account_unblock",
    title: "Your Account Has Been Reactivated! ",
    mailBody: `
      <p>Dear <strong>{CustomerName}</strong>,</p>
      <p>Good news! Your account suspension has been lifted.</p>
      <p>You can now log in, browse our catalog, and place orders as usual. We are happy to have you back!</p>
    `,
    buttonName: "Login Now",
    buttonRedirectLink: "https://test-dobby.vercel.app/login",
    isActive: true
  }
];

async function seed() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGODB_URI);
    console.log("Connected.");

    for (const t of templates) {
      const exists = await CustomerMailTemplate.findOne({ templateType: t.templateType });
      
      if (!exists) {
        await CustomerMailTemplate.create(t);
        console.log(`Created template: ${t.templateType}`);
      } else {
        console.log(`Template already exists: ${t.templateType}. Skipping...`);
      }
    }

    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Error seeding templates:", err);
    process.exit(1);
  }
}

seed();
