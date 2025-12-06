// controllers/returnRequestController.js
const returnRequestService = require('../services/returnrequestService');
const logger = require('../config/logger');

class ReturnRequestController {
  
  // Customer creates return request (Only logged-in customers)
  async createReturnRequest(req, res) {
    try {
      const returnRequest = await returnRequestService.createReturnRequest({
        user: req.user,
        body: req.body
      });

      res.status(201).json({
        success: true,
        message: 'Return request submitted successfully',
        data: returnRequest
      });
    } catch (error) {
      logger.error(`Create return request error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Customer views their return requests (Only logged-in customers)
  async getCustomerReturnRequests(req, res) {
    try {
      const result = await returnRequestService.getCustomerReturnRequests({
        user: req.user,
        query: req.query
      });

      res.status(200).json({
        success: true,
        count: result.requests.length,
        pagination: result.pagination,
        data: result.requests
      });
    } catch (error) {
      logger.error(`Get customer return requests error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Shopkeeper views return requests (Only for their active shop)
  async getShopReturnRequests(req, res) {
    try {
      const result = await returnRequestService.getShopReturnRequests({
        user: req.user,
        shop: req.shop,
        query: req.query
      });

      res.status(200).json({
        success: true,
        count: result.requests.length,
        pagination: result.pagination,
        data: result.requests
      });
    } catch (error) {
      logger.error(`Get shop return requests error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Shopkeeper approves/rejects return request (Only for their active shop)
  async updateReturnRequestStatus(req, res) {
    try {
      const returnRequest = await returnRequestService.updateReturnRequestStatus({
        user: req.user,
        shop: req.shop,
        body: req.body
      });

      res.status(200).json({
        success: true,
        message: `Return request ${req.body.status} successfully`,
        data: returnRequest
      });
    } catch (error) {
      logger.error(`Update return request status error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get single return request details
  async getReturnRequestById(req, res) {
    try {
      const request = await returnRequestService.getReturnRequestById({
        user: req.user,
        requestId: req.params.id,
        role: req.user.role,
        shop: req.shop || null
      });

      res.status(200).json({
        success: true,
        data: request
      });
    } catch (error) {
      logger.error(`Get return request by ID error: ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new ReturnRequestController();