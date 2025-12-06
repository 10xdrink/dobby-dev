const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const customerGroupingService = require("../services/customergroupingService");
require("dotenv").config();

const migrateCustomerGroups = async () => {
  try {
    console.log(" Starting customer groups migration...");

    // Connect to database
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" Connected to database");

    // Get all customers
    const customers = await Customer.find({}).select("_id");
    console.log(` Found ${customers.length} customers to process`);

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];
      
      try {
        // Check if customer group already exists
        const existing = await CustomerGroup.findOne({ customer: customer._id });
        if (existing) {
          console.log(`  [${i + 1}/${customers.length}] Skipped (already exists): ${customer._id}`);
          skippedCount++;
          continue;
        }

        // Evaluate customer group
        await customerGroupingService.evaluateCustomerGroup(customer._id);
        successCount++;
        console.log(` [${i + 1}/${customers.length}] Processed: ${customer._id}`);
      } catch (err) {
        errorCount++;
        console.error(` [${i + 1}/${customers.length}] Error processing ${customer._id}:`, err.message);
      }

      // Add small delay to avoid overwhelming database
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Get final distribution
    const distribution = await CustomerGroup.getGroupDistribution();

    console.log("\n Migration Complete!");
    console.log(` Successfully processed: ${successCount}`);
    console.log(` Errors: ${errorCount}`);
    console.log(`  Skipped (already existed): ${skippedCount}`);
    console.log("\n Customer Group Distribution:");
    console.log(`   Retail: ${distribution.retail}`);
    console.log(`   Wholesale: ${distribution.wholesale}`);
    console.log(`   VIP: ${distribution.vip}`);

    await mongoose.disconnect();
    console.log("\n Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("\n Migration failed:", err);
    process.exit(1);
  }
};

// Run migration
migrateCustomerGroups();