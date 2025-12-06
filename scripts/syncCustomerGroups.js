require("dotenv").config();
const mongoose = require("mongoose");
const Customer = require("../models/Customer");
const CustomerGroup = require("../models/CustomerGroup");
const Order = require("../models/Order");
const logger = require("../config/logger");

async function syncCustomerGroups() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("Connected to MongoDB for customer group sync");

    const customers = await Customer.find({}).lean();
    logger.info(`Found ${customers.length} customers to process`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const customer of customers) {
      try {
        const existingGroup = await CustomerGroup.findOne({
          customer: customer._id,
        });

        const orders = await Order.find({
          customer: customer._id,
          status: { $nin: ["cancelled", "refunded"] },
        }).lean();

        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, order) => sum + (order.total || 0), 0);
        const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
        const highestOrderValue = orders.length > 0
          ? Math.max(...orders.map(o => o.total || 0))
          : 0;

        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const last30DaysOrders = orders.filter(
          (o) => new Date(o.createdAt) >= thirtyDaysAgo
        ).length;
        const last30DaysSpent = orders
          .filter((o) => new Date(o.createdAt) >= thirtyDaysAgo)
          .reduce((sum, o) => sum + (o.total || 0), 0);

        const lastOrder = orders.length > 0
          ? orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0]
          : null;

        const accountAgeMonths = customer.createdAt
          ? Math.floor(
              (now - new Date(customer.createdAt)) / (30 * 24 * 60 * 60 * 1000)
            )
          : 0;

        let currentGroup = "retail";
        if (totalSpent >= 50000 || (totalOrders >= 10 && avgOrderValue >= 3000)) {
          currentGroup = "vip";
        } else if (totalOrders >= 5 || avgOrderValue >= 5000) {
          currentGroup = "wholesale";
        }

        const metrics = {
          totalOrders,
          totalSpent,
          avgOrderValue,
          highestOrderValue,
          last30DaysOrders,
          last30DaysSpent,
          lastOrderDate: lastOrder ? lastOrder.createdAt : null,
          accountAgeMonths,
        };

        if (existingGroup) {
          existingGroup.currentGroup = currentGroup;
          existingGroup.groups = [currentGroup];
          existingGroup.metrics = metrics;
          existingGroup.lastEvaluatedAt = new Date();
          await existingGroup.save();
          updated++;
          logger.debug(`Updated customer group for ${customer.email || customer._id}`);
        } else {
          await CustomerGroup.create({
            customer: customer._id,
            currentGroup,
            groups: [currentGroup],
            metrics,
            lastEvaluatedAt: new Date(),
          });
          created++;
          logger.debug(`Created customer group for ${customer.email || customer._id}`);
        }
      } catch (err) {
        logger.error(`Error processing customer ${customer._id}: ${err.message}`);
        skipped++;
      }
    }

    logger.info({
      event: "CUSTOMER_GROUP_SYNC_COMPLETED",
      total: customers.length,
      created,
      updated,
      skipped,
    });

    console.log(`\n Customer Group Sync Completed:`);
    console.log(`   Total Customers: ${customers.length}`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}\n`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    logger.error("Customer group sync failed:", err);
    console.error("✗ Sync failed:", err.message);
    process.exit(1);
  }
}

syncCustomerGroups();
