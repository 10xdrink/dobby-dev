require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const logger = require("../config/logger");

async function cleanInvalidGroups() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" Connected to MongoDB\n");

    // Delete groups without customer reference
    const result1 = await CustomerGroup.deleteMany({
      $or: [
        { customer: null },
        { customer: { $exists: false } },
      ],
    });
    console.log(`  Deleted ${result1.deletedCount} groups without customer reference`);

    // Delete groups with undefined currentGroup
    const result2 = await CustomerGroup.deleteMany({
      $or: [
        { currentGroup: null },
        { currentGroup: { $exists: false } },
        { currentGroup: undefined },
      ],
    });
    console.log(`  Deleted ${result2.deletedCount} groups with undefined currentGroup`);

    // Check remaining
    const remaining = await CustomerGroup.countDocuments();
    console.log(`\n Remaining valid groups: ${remaining}`);

    if (remaining > 0) {
      const sample = await CustomerGroup.findOne()
        .populate("customer", "firstName email")
        .lean();
      console.log("\n Sample valid group:");
      console.log(`   Customer: ${sample.customer?.firstName || "N/A"}`);
      console.log(`   Email: ${sample.customer?.email || "N/A"}`);
      console.log(`   Group: ${sample.currentGroup}`);
    }

    console.log("\n Cleanup complete!");
    console.log(" Now run: node scripts/syncCustomerGroups.js\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(" Error:", err.message);
    process.exit(1);
  }
}

cleanInvalidGroups();
