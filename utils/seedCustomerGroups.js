const CustomerGroup = require("../models/CustomerGroup");
const logger = require("../config/logger");


async function seedCustomerGroups() {
  try {
    // Skip seeding - customer groups are now created per customer
    logger.info("Customer group seeding skipped (groups are now customer-specific)");
    console.log(" Customer group seeding skipped (groups are now customer-specific)");
    return;
  } catch (error) {
    logger.error("Error in seedCustomerGroups:", error.message);
    console.error(" Error in seedCustomerGroups:", error.message);
  }
}

module.exports = seedCustomerGroups;
