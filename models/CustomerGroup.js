const mongoose = require("mongoose");

const groupHistorySchema = new mongoose.Schema({
  group: {
    type: String,
    enum: ["retail", "wholesale", "vip"],
    required: true,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  reason: {
    type: String,
    required: true,
  },
  metrics: {
    totalOrders: Number,
    totalSpent: Number,
    avgOrderValue: Number,
    last30DaysOrders: Number,
    highestOrderValue: Number,
    accountAgeMonths: Number,
  },
});

const customerGroupSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "customerModel",
      required: true,
      unique: true,
    },
    customerModel: {
      type: String,
      enum: ["Customer", "Student"],
      default: "Customer",
    },

    // Current group
    currentGroup: {
      type: String,
      enum: ["retail", "wholesale", "vip"],
      default: "retail",
    },

    // Multiple groups - customer can be in multiple groups simultaneously
    groups: [
      {
        type: String,
        enum: ["retail", "wholesale", "vip"],
      },
    ],

    // Metrics for grouping decisions
    metrics: {
      totalOrders: {
        type: Number,
        default: 0,
      },
      totalSpent: {
        type: Number,
        default: 0,
      },
      avgOrderValue: {
        type: Number,
        default: 0,
      },
      highestOrderValue: {
        type: Number,
        default: 0,
      },
      last30DaysOrders: {
        type: Number,
        default: 0,
      },
      last30DaysSpent: {
        type: Number,
        default: 0,
      },
      ordersThisMonth: {
        type: Number,
        default: 0,
      },
      bulkOrderCount: {
        type: Number,
        default: 0,
      }, // Orders with 10+ units/SKU
      lastOrderDate: {
        type: Date,
        default: null,
      },
      accountAgeMonths: {
        type: Number,
        default: 0,
      },
      last3OrdersValues: [
        {
          type: Number,
        },
      ], // Track last 3 order values
    },

    // History of group changes
    groupHistory: [groupHistorySchema],

    // Last evaluation
    lastEvaluatedAt: {
      type: Date,
      default: Date.now,
    },

    // Next evaluation (for scheduled checks)
    nextEvaluationAt: {
      type: Date,
      default: function () {
        return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      },
    },
  },
  { timestamps: true }
);

// Indexes for efficient querying
customerGroupSchema.index({ currentGroup: 1 });
customerGroupSchema.index({ "groups": 1 });
customerGroupSchema.index({ customer: 1, currentGroup: 1 });
customerGroupSchema.index({ nextEvaluationAt: 1 });

// Method to add group change to history
customerGroupSchema.methods.addGroupChange = function (group, reason, metrics) {
  this.groupHistory.push({
    group,
    reason,
    metrics,
    changedAt: new Date(),
  });

  // Keep only last 50 entries
  if (this.groupHistory.length > 50) {
    this.groupHistory = this.groupHistory.slice(-50);
  }
};

// Method to check if customer has a specific group
customerGroupSchema.methods.hasGroup = function (groupName) {
  return this.groups.includes(groupName);
};

// Static method to get group distribution
customerGroupSchema.statics.getGroupDistribution = async function () {
  const distribution = await this.aggregate([
    {
      $group: {
        _id: "$currentGroup",
        count: { $sum: 1 },
      },
    },
  ]);

  const result = {
    retail: 0,
    wholesale: 0,
    vip: 0,
  };

  distribution.forEach((item) => {
    result[item._id] = item.count;
  });

  return result;
};

// Static method to get customers by group
customerGroupSchema.statics.getCustomersByGroup = async function (
  groupName,
  page = 1,
  limit = 50
) {
  const skip = (page - 1) * limit;

  const customers = await this.find({ currentGroup: groupName })
    .populate("customer", "firstName lastName email phone")
    .sort({ "metrics.totalSpent": -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await this.countDocuments({ currentGroup: groupName });

  return {
    customers,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
};

module.exports = mongoose.model("CustomerGroup", customerGroupSchema);