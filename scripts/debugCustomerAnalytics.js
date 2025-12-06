require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const Order = require("../models/Order");

async function debugAnalytics() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB\n");

    // 1. Check Customers
    const customerCount = await Customer.countDocuments();
    console.log(`Total Customers: ${customerCount}`);
    
    if (customerCount > 0) {
      const sampleCustomers = await Customer.find().limit(3).lean();
      console.log("\nSample Customers:");
      sampleCustomers.forEach((c, i) => {
        console.log(`   ${i + 1}. ID: ${c._id}`);
        console.log(`      Email: ${c.email || "N/A"}`);
        console.log(`      Name: ${c.firstName} ${c.lastName || ""}`);
      });
    }

    // 2. Check CustomerGroups
    const groupCount = await CustomerGroup.countDocuments();
    console.log(`\nTotal CustomerGroups: ${groupCount}`);
    
    if (groupCount > 0) {
      const sampleGroups = await CustomerGroup.find()
        .populate("customer", "firstName lastName email")
        .limit(3)
        .lean();
      console.log("\nSample CustomerGroups:");
      sampleGroups.forEach((g, i) => {
        console.log(`   ${i + 1}. Group: ${g.currentGroup}`);
        console.log(`      Customer ID: ${g.customer?._id || "N/A"}`);
        console.log(`      Customer Email: ${g.customer?.email || "N/A"}`);
        console.log(`      Total Orders: ${g.metrics?.totalOrders || 0}`);
        console.log(`      Total Spent: ₹${g.metrics?.totalSpent || 0}`);
      });
    } else {
      console.log("\n WARNING: No CustomerGroups found!");
      console.log("   Run: node scripts/syncCustomerGroups.js");
    }

    // 3. Check Orders
    const orderCount = await Order.countDocuments();
    console.log(`\nTotal Orders: ${orderCount}`);
    
    if (orderCount > 0) {
      const sampleOrders = await Order.find()
        .populate("customer", "firstName email")
        .limit(3)
        .lean();
      console.log("\nSample Orders:");
      sampleOrders.forEach((o, i) => {
        console.log(`   ${i + 1}. Order ID: ${o._id}`);
        console.log(`      Customer: ${o.customer?.email || o.customer?._id || "N/A"}`);
        console.log(`      Status: ${o.status}`);
        console.log(`      Total: ₹${o.total || 0}`);
      });
    }

    // 4. Test the query that controller uses
    console.log("\nTesting Controller Query...");
    const page = 1;
    const limit = 10;
    const skip = (page - 1) * limit;
    
    const customerGroups = await CustomerGroup.find({})
      .populate("customer", "firstName lastName email phone")
      .skip(skip)
      .limit(limit)
      .lean();

    console.log(`   Found ${customerGroups.length} customer groups with pagination`);
    
    if (customerGroups.length > 0) {
      console.log("\n Query working! Sample result:");
      const sample = customerGroups[0];
      console.log(`   Customer: ${sample.customer?.firstName || "Unknown"}`);
      console.log(`   Email: ${sample.customer?.email || "N/A"}`);
      console.log(`   Group: ${sample.currentGroup}`);
      
      // Check if customer has orders
      if (sample.customer?._id) {
        const customerOrders = await Order.countDocuments({
          customer: sample.customer._id,
        });
        console.log(`   Orders: ${customerOrders}`);
      }
    } else {
      console.log("\n No results from controller query!");
      console.log("   Possible issues:");
      console.log("   1. CustomerGroup collection is empty");
      console.log("   2. Customers not linked to groups");
      console.log("\n   Solution: Run sync script");
      console.log("   → node scripts/syncCustomerGroups.js");
    }

    // 5. Group Distribution
    if (groupCount > 0) {
      const distribution = await CustomerGroup.aggregate([
        {
          $group: {
            _id: "$currentGroup",
            count: { $sum: 1 },
          },
        },
      ]);
      
      console.log("\n Group Distribution:");
      distribution.forEach((d) => {
        console.log(`   ${d._id}: ${d.count} customers`);
      });
    }

    console.log("\n Debug Complete!");
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(" Debug Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

debugAnalytics();
