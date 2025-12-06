require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const Order = require("../models/Order");

async function completeReset() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(" Connected to MongoDB\n");

    // Step 1: Delete ALL CustomerGroups
    const deleted = await CustomerGroup.deleteMany({});
    console.log(`  Deleted ${deleted.deletedCount} CustomerGroups\n`);

    // Step 2: Get all customers
    const customers = await Customer.find({}).lean();
    console.log(` Found ${customers.length} customers\n`);

    let created = 0;
    for (const customer of customers) {
      const orders = await Order.find({
        customer: customer._id,
        status: { $nin: ["cancelled", "refunded"] },
      }).lean();

      const totalOrders = orders.length;
      const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
      const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;

      let currentGroup = "retail";
      if (totalSpent >= 50000 || (totalOrders >= 10 && avgOrderValue >= 3000)) {
        currentGroup = "vip";
      } else if (totalOrders >= 5 || avgOrderValue >= 5000) {
        currentGroup = "wholesale";
      }

      await CustomerGroup.create({
        customer: customer._id,
        currentGroup,
        groups: [currentGroup],
        metrics: {
          totalOrders,
          totalSpent,
          avgOrderValue,
          highestOrderValue: orders.length > 0 ? Math.max(...orders.map(o => o.total || 0)) : 0,
          last30DaysOrders: 0,
          last30DaysSpent: 0,
          accountAgeMonths: 0,
        },
      });

      created++;
      console.log(` Created group for ${customer.email || customer._id}: ${currentGroup} (Orders: ${totalOrders}, Spent: ₹${totalSpent})`);
    }

    console.log(`\n Reset complete! Created ${created} customer groups`);

    // Verify
    const groups = await CustomerGroup.find()
      .populate("customer", "firstName email")
      .lean();

    console.log(`\n Verification:`);
    groups.forEach((g, i) => {
      console.log(`   ${i + 1}. ${g.customer?.email || "No customer"} → ${g.currentGroup}`);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error(" Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

completeReset();
