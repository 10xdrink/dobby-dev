const orderCancelService = require("../services/orderCancelService");
const logger = require("../config/logger");

class OrderCancelController {
  async cancelOrder(req, res) {
    try {
      const result = await orderCancelService.cancelOrder({
        user: req.user,
        body: req.body,
      });

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.order,
      });
    } catch (error) {
      logger.error(`[CancelOrderController] ${error.message}`);
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new OrderCancelController();
