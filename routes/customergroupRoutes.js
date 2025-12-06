const express = require("express");
const router = express.Router();
const {
  getGroupDistribution,
  getCustomersByGroup,
  getCustomerGroupDetails,
  reevaluateCustomerGroup,
  getGroupStatistics,
  bulkReevaluateGroups,
} = require("../controllers/customergroupController");
const { protect } = require("../middleware/adminMiddleware");

// All routes require admin authentication
router.use(protect());

/**
 * @route   GET /api/admin/customer-groups/distribution
 * @desc    Get customer group distribution (retail, wholesale, VIP counts)
 * @access  Admin
 */
router.get("/distribution", getGroupDistribution);

/**
 * @route   GET /api/admin/customer-groups/statistics
 * @desc    Get detailed group statistics with revenue metrics
 * @access  Admin
 */
router.get("/statistics", getGroupStatistics);

/**
 * @route   GET /api/admin/customer-groups/:group
 * @desc    Get customers by group (retail/wholesale/vip) with pagination
 * @query   page, limit
 * @access  Admin
 */
router.get("/:group", getCustomersByGroup);

/**
 * @route   GET /api/admin/customer-groups/customer/:customerId
 * @desc    Get detailed customer group info
 * @access  Admin
 */
router.get("/customer/:customerId", getCustomerGroupDetails);

/**
 * @route   POST /api/admin/customer-groups/reevaluate/:customerId
 * @desc    Manually trigger group re-evaluation for a customer
 * @access  Admin
 */
router.post("/reevaluate/:customerId", reevaluateCustomerGroup);

/**
 * @route   POST /api/admin/customer-groups/bulk-reevaluate
 * @desc    Trigger bulk re-evaluation for all customers (background job)
 * @access  Admin
 */
router.post("/bulk-reevaluate", bulkReevaluateGroups);

module.exports = router;