const CustomerGroup = require("../models/CustomerGroup");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const logger = require("../config/logger");

class CustomerGroupingService {
  /**
   * Evaluate and update customer group after order completion
   */
  async evaluateCustomerGroup(customerId) {
    const context = {
      service: "CustomerGroupingService.evaluateCustomerGroup",
      customerId: customerId.toString(),
    };

    try {
      logger.info({
        ...context,
        event: "GROUP_EVALUATION_START",
      });

      // Get or create customer group record
      let customerGroup = await CustomerGroup.findOne({ customer: customerId });
      if (!customerGroup) {
        customerGroup = new CustomerGroup({
          customer: customerId,
          currentGroup: "retail",
          groups: ["retail"],
        });
      }

      // Calculate metrics
      const metrics = await this.calculateCustomerMetrics(customerId);

      logger.debug({
        ...context,
        event: "METRICS_CALCULATED",
        metrics,
      });

      // Update metrics in customer group
      customerGroup.metrics = metrics;

      // Determine groups based on criteria
      const qualifiedGroups = this.determineQualifiedGroups(metrics);

      logger.info({
        ...context,
        event: "QUALIFIED_GROUPS_DETERMINED",
        qualifiedGroups,
        previousGroup: customerGroup.currentGroup,
      });

      // Determine primary group (highest tier)
      let newPrimaryGroup = "retail";
      if (qualifiedGroups.includes("vip")) {
        newPrimaryGroup = "vip";
      } else if (qualifiedGroups.includes("wholesale")) {
        newPrimaryGroup = "wholesale";
      }

      // Check if group changed
      if (customerGroup.currentGroup !== newPrimaryGroup) {
        const reason = this.getGroupChangeReason(
          customerGroup.currentGroup,
          newPrimaryGroup,
          metrics
        );

        customerGroup.addGroupChange(newPrimaryGroup, reason, metrics);

        logger.info({
          ...context,
          event: "GROUP_CHANGED",
          oldGroup: customerGroup.currentGroup,
          newGroup: newPrimaryGroup,
          reason,
        });
      }

      // Update customer group
      customerGroup.currentGroup = newPrimaryGroup;
      customerGroup.groups = qualifiedGroups;
      customerGroup.lastEvaluatedAt = new Date();
      customerGroup.nextEvaluationAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000
      );

      await customerGroup.save();

      logger.info({
        ...context,
        event: "GROUP_EVALUATION_COMPLETE",
        currentGroup: customerGroup.currentGroup,
        allGroups: customerGroup.groups,
      });

      return customerGroup;
    } catch (err) {
      logger.error({
        ...context,
        event: "GROUP_EVALUATION_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }

  /**
   * Calculate customer metrics from orders
   */
  async calculateCustomerMetrics(customerId) {
    const customer = await Customer.findById(customerId);
    if (!customer) {
      throw new Error("Customer not found");
    }

    // Calculate account age in months
    const accountAgeMonths = Math.floor(
      (Date.now() - customer.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
    );

    // Get all completed orders
    const allOrders = await Order.find({
      customer: customerId,
      status: { $in: ["delivered", "confirmed", "shipped", "in_transit"] },
    }).sort({ createdAt: -1 });

    const totalOrders = allOrders.length;
    const totalSpent = allOrders.reduce((sum, order) => sum + order.total, 0);
    const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const highestOrderValue = totalOrders > 0
      ? Math.max(...allOrders.map((o) => o.total))
      : 0;

    // Last 30 days orders
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last30DaysOrders = allOrders.filter(
      (o) => o.createdAt >= thirtyDaysAgo
    );
    const last30DaysOrderCount = last30DaysOrders.length;
    const last30DaysSpent = last30DaysOrders.reduce(
      (sum, order) => sum + order.total,
      0
    );

    // Current month orders
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ordersThisMonth = allOrders.filter(
      (o) => o.createdAt >= monthStart
    ).length;

    // Bulk order count (orders with 10+ units per SKU)
    let bulkOrderCount = 0;
    for (const order of last30DaysOrders) {
      const hasBulkItem = order.items.some((item) => item.quantity >= 10);
      if (hasBulkItem) {
        bulkOrderCount++;
      }
    }

    // Last 3 order values
    const last3OrdersValues = allOrders.slice(0, 3).map((o) => o.total);

    // Last order date
    const lastOrderDate =
      allOrders.length > 0 ? allOrders[0].createdAt : null;

    return {
      totalOrders,
      totalSpent,
      avgOrderValue,
      highestOrderValue,
      last30DaysOrders: last30DaysOrderCount,
      last30DaysSpent,
      ordersThisMonth,
      bulkOrderCount,
      lastOrderDate,
      accountAgeMonths,
      last3OrdersValues,
    };
  }

  /**
   * Determine which groups customer qualifies for
   */
  determineQualifiedGroups(metrics) {
    const groups = ["retail"]; // Everyone is retail by default

    // Check VIP criteria
    if (this.meetsVIPCriteria(metrics)) {
      groups.push("vip");
    }

    // Check Wholesale criteria
    if (this.meetsWholesaleCriteria(metrics)) {
      groups.push("wholesale");
    }

    return groups;
  }

  /**
   * Check if customer meets VIP criteria
   */
  meetsVIPCriteria(metrics) {
    // Total spent > ₹100,000
    if (metrics.totalSpent <= 100000) {
      return false;
    }

    // Minimum 25 orders in one month
    if (metrics.ordersThisMonth < 25) {
      return false;
    }

    // High-value orders consistently (average order > ₹10,000)
    if (metrics.avgOrderValue < 10000) {
      return false;
    }

    // Additional VIP criteria: At least 50 total orders
    if (metrics.totalOrders < 50) {
      return false;
    }

    return true;
  }

  /**
   * Check if customer meets Wholesale criteria
   */
  meetsWholesaleCriteria(metrics) {
    // Check if meets downgrade conditions first
    if (this.meetsWholesaleDowngradeCriteria(metrics)) {
      return false;
    }

    // Criteria 1: Average order value > ₹10,000
    const hasHighAvgValue = metrics.avgOrderValue > 10000;

    // Criteria 2: At least 1 order > ₹15,000
    const hasHighOrder = metrics.highestOrderValue > 15000;

    // Criteria 3: Minimum 5 orders in last 30 days
    const hasMinOrders = metrics.last30DaysOrders >= 5;

    // Criteria 4: At least 2 bulk orders (10+ units/SKU)
    const hasBulkOrders = metrics.bulkOrderCount >= 2;

    // Path A: Standard wholesale criteria
    if (hasHighAvgValue && hasHighOrder && hasMinOrders && hasBulkOrders) {
      return true;
    }

    // Path B: Single large order with mature account
    const hasMatureAccount = metrics.accountAgeMonths >= 8;
    const hasSingleLargeOrder = metrics.highestOrderValue >= 25000;
    if (hasMatureAccount && hasSingleLargeOrder) {
      return true;
    }

    // Path C: High lifetime spend (but not qualifying for VIP)
    // This ensures customer with ₹25,000+ lifetime spent stays retail
    // unless they meet other wholesale criteria
    const hasHighLifetimeSpend = metrics.totalSpent > 25000;
    if (
      hasHighLifetimeSpend &&
      (hasHighAvgValue || hasHighOrder) &&
      hasMinOrders
    ) {
      return true;
    }

    return false;
  }

  /**
   * Check if customer meets wholesale downgrade criteria
   */
  meetsWholesaleDowngradeCriteria(metrics) {
    // No orders in last 30 days
    if (metrics.last30DaysOrders === 0) {
      return true;
    }

    // Last 3 orders all less than ₹15,000
    if (
      metrics.last3OrdersValues.length >= 3 &&
      metrics.last3OrdersValues.every((val) => val < 15000)
    ) {
      return true;
    }

    return false;
  }

  /**
   * Generate reason for group change
   */
  getGroupChangeReason(oldGroup, newGroup, metrics) {
    if (oldGroup === "retail" && newGroup === "wholesale") {
      return `Upgraded to Wholesale: ${metrics.totalOrders} orders, ₹${metrics.totalSpent.toFixed(
        2
      )} total spent, avg order ₹${metrics.avgOrderValue.toFixed(2)}`;
    }

    if (oldGroup === "wholesale" && newGroup === "retail") {
      return `Downgraded to Retail: Low recent activity or order values below threshold`;
    }

    if (newGroup === "vip") {
      return `Upgraded to VIP: ${metrics.totalOrders} orders, ₹${metrics.totalSpent.toFixed(
        2
      )} total spent, ${metrics.ordersThisMonth} orders this month`;
    }

    if (oldGroup === "vip" && newGroup === "wholesale") {
      return `Downgraded to Wholesale: VIP criteria no longer met`;
    }

    if (oldGroup === "vip" && newGroup === "retail") {
      return `Downgraded to Retail: VIP criteria no longer met`;
    }

    return `Group changed from ${oldGroup} to ${newGroup}`;
  }

  /**
   * Bulk evaluate all customers (for scheduled job)
   */
  async evaluateAllCustomers() {
    const context = {
      service: "CustomerGroupingService.evaluateAllCustomers",
    };

    try {
      logger.info({
        ...context,
        event: "BULK_EVALUATION_START",
      });

      // Get all customers who need evaluation
      const customerGroups = await CustomerGroup.find({
        nextEvaluationAt: { $lte: new Date() },
      }).limit(100);

      logger.info({
        ...context,
        event: "CUSTOMERS_TO_EVALUATE",
        count: customerGroups.length,
      });

      let successCount = 0;
      let errorCount = 0;

      for (const cg of customerGroups) {
        try {
          await this.evaluateCustomerGroup(cg.customer);
          successCount++;
        } catch (err) {
          logger.error({
            ...context,
            event: "CUSTOMER_EVALUATION_ERROR",
            customerId: cg.customer.toString(),
            error: err.message,
          });
          errorCount++;
        }
      }

      logger.info({
        ...context,
        event: "BULK_EVALUATION_COMPLETE",
        successCount,
        errorCount,
      });

      return { successCount, errorCount };
    } catch (err) {
      logger.error({
        ...context,
        event: "BULK_EVALUATION_ERROR",
        error: err.message,
        stack: err.stack,
      });
      throw err;
    }
  }
}

module.exports = new CustomerGroupingService();

// const CustomerGroup = require("../models/CustomerGroup");
// const Order = require("../models/Order");
// const Customer = require("../models/Customer");
// const logger = require("../config/logger");

// class CustomerGroupingService {
//   /**
//    * Evaluate and update customer group after order completion
//    */
//   async evaluateCustomerGroup(customerId) {
//     const context = {
//       service: "CustomerGroupingService.evaluateCustomerGroup",
//       customerId: customerId.toString(),
//     };

//     try {
//       logger.info({
//         ...context,
//         event: "GROUP_EVALUATION_START",
//       });

//       // Get or create customer group record
//       let customerGroup = await CustomerGroup.findOne({ customer: customerId });
//       if (!customerGroup) {
//         customerGroup = new CustomerGroup({
//           customer: customerId,
//           currentGroup: "retail",
//           groups: ["retail"],
//         });
//       }

//       // Calculate metrics
//       const metrics = await this.calculateCustomerMetrics(customerId);

//       logger.debug({
//         ...context,
//         event: "METRICS_CALCULATED",
//         metrics,
//       });

//       // Update metrics in customer group
//       customerGroup.metrics = metrics;

//       // Determine groups based on criteria
//       const qualifiedGroups = this.determineQualifiedGroups(metrics);

//       logger.info({
//         ...context,
//         event: "QUALIFIED_GROUPS_DETERMINED",
//         qualifiedGroups,
//         previousGroup: customerGroup.currentGroup,
//       });

//       // Determine primary group (highest tier)
//       let newPrimaryGroup = "retail";
//       if (qualifiedGroups.includes("vip")) {
//         newPrimaryGroup = "vip";
//       } else if (qualifiedGroups.includes("wholesale")) {
//         newPrimaryGroup = "wholesale";
//       }

//       // Check if group changed
//       if (customerGroup.currentGroup !== newPrimaryGroup) {
//         const reason = this.getGroupChangeReason(
//           customerGroup.currentGroup,
//           newPrimaryGroup,
//           metrics
//         );

//         customerGroup.addGroupChange(newPrimaryGroup, reason, metrics);

//         logger.info({
//           ...context,
//           event: "GROUP_CHANGED",
//           oldGroup: customerGroup.currentGroup,
//           newGroup: newPrimaryGroup,
//           reason,
//         });
//       }

//       // Update customer group
//       customerGroup.currentGroup = newPrimaryGroup;
//       customerGroup.groups = qualifiedGroups;
//       customerGroup.lastEvaluatedAt = new Date();
//       customerGroup.nextEvaluationAt = new Date(
//         Date.now() + 24 * 60 * 60 * 1000
//       );

//       await customerGroup.save();

//       logger.info({
//         ...context,
//         event: "GROUP_EVALUATION_COMPLETE",
//         currentGroup: customerGroup.currentGroup,
//         allGroups: customerGroup.groups,
//       });

//       return customerGroup;
//     } catch (err) {
//       logger.error({
//         ...context,
//         event: "GROUP_EVALUATION_ERROR",
//         error: err.message,
//         stack: err.stack,
//       });
//       throw err;
//     }
//   }

//   /**
//    * Calculate customer metrics from orders
//    */
//   async calculateCustomerMetrics(customerId) {
//     const customer = await Customer.findById(customerId);
//     if (!customer) {
//       throw new Error("Customer not found");
//     }

//     // Calculate account age in months
//     const accountAgeMonths = Math.floor(
//       (Date.now() - customer.createdAt.getTime()) / (30 * 24 * 60 * 60 * 1000)
//     );

//     // Get all relevant orders (including pending for immediate gratification)
//     const allOrders = await Order.find({
//       customer: customerId,
//       status: { 
//         $in: [
//           "pending", // Include pending to capture immediate high-value orders
//           "confirmed", 
//           "packed", 
//           "shipped", 
//           "in_transit", 
//           "delivered"
//         ] 
//       },
//     }).sort({ createdAt: -1 });

//     const totalOrders = allOrders.length;
//     const totalSpent = allOrders.reduce((sum, order) => sum + order.total, 0);
//     const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
//     const highestOrderValue = totalOrders > 0
//       ? Math.max(...allOrders.map((o) => o.total))
//       : 0;

//     // Last 30 days orders
//     const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
//     const last30DaysOrders = allOrders.filter(
//       (o) => o.createdAt >= thirtyDaysAgo
//     );
//     const last30DaysOrderCount = last30DaysOrders.length;
//     const last30DaysSpent = last30DaysOrders.reduce(
//       (sum, order) => sum + order.total,
//       0
//     );

//     // Current month orders
//     const now = new Date();
//     const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
//     const ordersThisMonth = allOrders.filter(
//       (o) => o.createdAt >= monthStart
//     ).length;

//     // Bulk order count (orders with 10+ units per SKU)
//     let bulkOrderCount = 0;
//     for (const order of last30DaysOrders) {
//       const hasBulkItem = order.items.some((item) => item.quantity >= 10);
//       if (hasBulkItem) {
//         bulkOrderCount++;
//       }
//     }

//     // Last 3 order values
//     const last3OrdersValues = allOrders.slice(0, 3).map((o) => o.total);

//     // Last order date
//     const lastOrderDate =
//       allOrders.length > 0 ? allOrders[0].createdAt : null;

//     return {
//       totalOrders,
//       totalSpent,
//       avgOrderValue,
//       highestOrderValue,
//       last30DaysOrders: last30DaysOrderCount,
//       last30DaysSpent,
//       ordersThisMonth,
//       bulkOrderCount,
//       lastOrderDate,
//       accountAgeMonths,
//       last3OrdersValues,
//     };
//   }

//   /**
//    * Determine which groups customer qualifies for
//    * Hierarchy: VIP > Wholesale > Retail
//    */
//   determineQualifiedGroups(metrics) {
//     const groups = ["retail"]; // Everyone is retail by default

//     // Check VIP criteria (Enterprise Grade)
//     if (this.meetsVIPCriteria(metrics)) {
//       groups.push("vip");
//       // If VIP, they likely also qualify for Wholesale benefits, but we handle primary group later
//       groups.push("wholesale"); 
//     }
//     // Check Wholesale criteria if not VIP (or in addition to)
//     else if (this.meetsWholesaleCriteria(metrics)) {
//       groups.push("wholesale");
//     }

//     return [...new Set(groups)]; // Remove duplicates
//   }

//   /**
//    * Check if customer meets VIP criteria
//    * 1. Platinum Status: Lifetime Spend > ₹5,00,000 (Permanent)
//    * 2. Gold Status: Lifetime Spend > ₹1,00,000 AND Active (Order in last 6 months)
//    * 3. High Roller: Single Order > ₹50,000
//    * 4. Frequent Flyer: > 20 Orders/Month AND Spend > ₹50,000 (last 30 days)
//    */
//   meetsVIPCriteria(metrics) {
//     const ONE_LAKH = 100000;
//     const FIVE_LAKHS = 500000;
//     const FIFTY_THOUSAND = 50000;

//     // 1. Platinum Status (High Lifetime Spend - Permanent-ish)
//     if (metrics.totalSpent >= FIVE_LAKHS) {
//       return true;
//     }

//     // Check Recency (Active in last 6 months) for lower tiers
//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
//     const isActive = metrics.lastOrderDate && metrics.lastOrderDate > sixMonthsAgo;

//     // 2. Gold Status
//     if (metrics.totalSpent >= ONE_LAKH && isActive) {
//       return true;
//     }

//     // 3. High Roller (Immediate upgrade on big spend)
//     // Using highestOrderValue ensures 11 Lac order triggers this immediately
//     if (metrics.highestOrderValue >= FIFTY_THOUSAND) {
//       return true;
//     }

//     // 4. High Velocity
//     if (metrics.last30DaysOrders >= 20 && metrics.last30DaysSpent >= FIFTY_THOUSAND) {
//       return true;
//     }

//     return false;
//   }

//   /**
//    * Check if customer meets Wholesale criteria
//    * 1. Bulk Buyer: 2+ Bulk Orders (10+ qty) AND Lifetime Spend > ₹20,000
//    * 2. Volume Buyer: Lifetime Spend > ₹50,000 AND Active
//    * 3. Enterprise Account: Account Age > 1 year AND Lifetime Spend > ₹30,000
//    */
//   meetsWholesaleCriteria(metrics) {
//     const TWENTY_THOUSAND = 20000;
//     const FIFTY_THOUSAND = 50000;
//     const THIRTY_THOUSAND = 30000;

//     // 1. Bulk Buyer
//     if (metrics.bulkOrderCount >= 2 && metrics.totalSpent >= TWENTY_THOUSAND) {
//       return true;
//     }

//     // Check Recency
//     const sixMonthsAgo = new Date();
//     sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
//     const isActive = metrics.lastOrderDate && metrics.lastOrderDate > sixMonthsAgo;

//     // 2. Volume Buyer
//     if (metrics.totalSpent >= FIFTY_THOUSAND && isActive) {
//       return true;
//     }

//     // 3. Enterprise/Loyal Account
//     if (metrics.accountAgeMonths >= 12 && metrics.totalSpent >= THIRTY_THOUSAND) {
//       return true;
//     }

//     return false;
//   }

//   /**
//    * Generate reason for group change
//    */
//   getGroupChangeReason(oldGroup, newGroup, metrics) {
//     if (oldGroup === "retail" && newGroup === "wholesale") {
//       return `Upgraded to Wholesale: ${metrics.totalOrders} orders, ₹${metrics.totalSpent.toFixed(
//         2
//       )} total spent, avg order ₹${metrics.avgOrderValue.toFixed(2)}`;
//     }

//     if (oldGroup === "wholesale" && newGroup === "retail") {
//       return `Downgraded to Retail: No active orders in last 6 months or spend below threshold`;
//     }

//     if (newGroup === "vip") {
//       return `Upgraded to VIP: High lifetime spend (₹${metrics.totalSpent}) or high value order`;
//     }

//     if (oldGroup === "vip" && newGroup === "wholesale") {
//       return `Downgraded to Wholesale: VIP criteria no longer met (inactive > 6 months)`;
//     }

//     if (oldGroup === "vip" && newGroup === "retail") {
//       return `Downgraded to Retail: VIP criteria no longer met (inactive > 6 months)`;
//     }

//     return `Group changed from ${oldGroup} to ${newGroup}`;
//   }

//   /**
//    * Bulk evaluate all customers (for scheduled job)
//    */
//   async evaluateAllCustomers() {
//     const context = {
//       service: "CustomerGroupingService.evaluateAllCustomers",
//     };

//     try {
//       logger.info({
//         ...context,
//         event: "BULK_EVALUATION_START",
//       });

//       // Get all customers who need evaluation
//       const customerGroups = await CustomerGroup.find({
//         nextEvaluationAt: { $lte: new Date() },
//       }).limit(100);

//       logger.info({
//         ...context,
//         event: "CUSTOMERS_TO_EVALUATE",
//         count: customerGroups.length,
//       });

//       let successCount = 0;
//       let errorCount = 0;

//       for (const cg of customerGroups) {
//         try {
//           await this.evaluateCustomerGroup(cg.customer);
//           successCount++;
//         } catch (err) {
//           logger.error({
//             ...context,
//             event: "CUSTOMER_EVALUATION_ERROR",
//             customerId: cg.customer.toString(),
//             error: err.message,
//           });
//           errorCount++;
//         }
//       }

//       logger.info({
//         ...context,
//         event: "BULK_EVALUATION_COMPLETE",
//         successCount,
//         errorCount,
//       });

//       return { successCount, errorCount };
//     } catch (err) {
//       logger.error({
//         ...context,
//         event: "BULK_EVALUATION_ERROR",
//         error: err.message,
//         stack: err.stack,
//       });
//       throw err;
//     }
//   }
// }

// module.exports = new CustomerGroupingService();