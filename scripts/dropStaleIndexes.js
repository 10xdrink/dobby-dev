require("dotenv").config();
const mongoose = require("mongoose");

async function dropStaleIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB\n");

    const db = mongoose.connection.db;
    const collection = db.collection("customergroups");

    // Get all indexes
    console.log("📋 Current Indexes on customergroups collection:");
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    // Drop the problematic groupName index
    try {
      console.log("\n🔧 Dropping stale 'groupName_1' index...");
      await collection.dropIndex("groupName_1");
      console.log("✅ Successfully dropped groupName_1 index");
    } catch (err) {
      if (err.code === 27) {
        console.log("⚠️  Index 'groupName_1' not found (already dropped)");
      } else {
        console.error("❌ Error dropping index:", err.message);
      }
    }

    // Check for any other stale indexes
    const staleIndexes = indexes.filter(
      (idx) =>
        idx.name !== "_id_" &&
        idx.name !== "customer_1" &&
        idx.name !== "currentGroup_1" &&
        idx.name !== "groups_1" &&
        idx.name !== "customer_1_currentGroup_1" &&
        idx.name !== "nextEvaluationAt_1"
    );

    if (staleIndexes.length > 1) {
      // Excluding the one we just dropped
      console.log("\n⚠️  Other potentially stale indexes found:");
      staleIndexes.forEach((idx) => {
        if (idx.name !== "groupName_1") {
          console.log(`   - ${idx.name}`);
        }
      });
    }

    console.log("\n📋 Final Indexes:");
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach((index, i) => {
      console.log(`   ${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log("\n✅ Index cleanup complete!");
    console.log("\n🚀 Now run: node scripts/syncCustomerGroups.js\n");

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

dropStaleIndexes();
