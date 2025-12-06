const RefundMethod = require('../models/RefundMethod');
const logger = require('../config/logger');

/**
 * @desc    Get customer's refund method
 * @route   GET /api/customer/refund-method
 * @access  Private (Customer)
 */
exports.getRefundMethod = async (req, res) => {
  try {
    const customerId = req.user._id;

    const refundMethod = await RefundMethod.findOne({ customer: customerId });

    if (!refundMethod) {
      return res.status(404).json({
        success: false,
        message: 'No refund method found',
      });
    }

    res.status(200).json({
      success: true,
      data: refundMethod,
    });
  } catch (error) {
    logger.error('Error fetching refund method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch refund method',
      error: error.message,
    });
  }
};

/**
 * @desc    Save or update customer's refund method
 * @route   POST /api/customer/refund-method
 * @access  Private (Customer)
 */
exports.saveRefundMethod = async (req, res) => {
  try {
    const customerId = req.user._id;
    const { preferredMethod, bankAccountDetails, upiDetails } = req.body;

    // Validation
    if (!preferredMethod || !['account', 'upi'].includes(preferredMethod)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid preferred method. Must be "account" or "upi"',
      });
    }

    // Validate bank account details if method is account
    if (preferredMethod === 'account') {
      if (!bankAccountDetails) {
        return res.status(400).json({
          success: false,
          message: 'Bank account details are required for account method',
        });
      }

      const { accountHolderName, bankName, accountNumber, ifscCode } = bankAccountDetails;

      if (!accountHolderName || !bankName || !accountNumber || !ifscCode) {
        return res.status(400).json({
          success: false,
          message: 'All bank account fields are required',
        });
      }

      if (ifscCode.length !== 11) {
        return res.status(400).json({
          success: false,
          message: 'IFSC code must be 11 characters',
        });
      }
    }

    // Validate UPI details if method is UPI
    if (preferredMethod === 'upi') {
      if (!upiDetails || !upiDetails.upiId) {
        return res.status(400).json({
          success: false,
          message: 'UPI ID is required for UPI method',
        });
      }

      // Basic UPI ID validation
      const upiRegex = /^[\w.-]+@[\w.-]+$/;
      if (!upiRegex.test(upiDetails.upiId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid UPI ID format',
        });
      }
    }

    // Find existing refund method or create new one
    let refundMethod = await RefundMethod.findOne({ customer: customerId });

    if (refundMethod) {
      // Update existing refund method
      refundMethod.preferredMethod = preferredMethod;
      
      if (preferredMethod === 'account') {
        refundMethod.bankAccountDetails = bankAccountDetails;
        refundMethod.upiDetails = undefined; // Clear UPI details
      } else {
        refundMethod.upiDetails = upiDetails;
        refundMethod.bankAccountDetails = undefined; // Clear bank details
      }

      await refundMethod.save();
    } else {
      // Create new refund method
      refundMethod = await RefundMethod.create({
        customer: customerId,
        preferredMethod,
        bankAccountDetails: preferredMethod === 'account' ? bankAccountDetails : undefined,
        upiDetails: preferredMethod === 'upi' ? upiDetails : undefined,
      });
    }

    logger.info(`Refund method saved for customer: ${customerId}`);

    res.status(200).json({
      success: true,
      message: 'Refund method saved successfully',
      data: refundMethod,
    });
  } catch (error) {
    logger.error('Error saving refund method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save refund method',
      error: error.message,
    });
  }
};

/**
 * @desc    Delete customer's refund method
 * @route   DELETE /api/customer/refund-method
 * @access  Private (Customer)
 */
exports.deleteRefundMethod = async (req, res) => {
  try {
    const customerId = req.user._id;

    const refundMethod = await RefundMethod.findOneAndDelete({ customer: customerId });

    if (!refundMethod) {
      return res.status(404).json({
        success: false,
        message: 'No refund method found to delete',
      });
    }

    logger.info(`Refund method deleted for customer: ${customerId}`);

    res.status(200).json({
      success: true,
      message: 'Refund method deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting refund method:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete refund method',
      error: error.message,
    });
  }
};
