const invoiceService = require("../services/invoiceService");
const { successResponse, errorResponse } = require("../utils/responseHandler");
const logger = require("../config/logger");

exports.getInvoice = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user._id;

    logger.info({
      event: "GET_INVOICE_REQUEST",
      orderId,
      customerId: customerId.toString(),
    });

    const invoiceData = await invoiceService.generateInvoiceData(
      orderId,
      customerId
    );

    successResponse(res, invoiceData);
  } catch (err) {
    logger.error({
      event: "GET_INVOICE_ERROR",
      orderId: req.params.orderId,
      error: err.message,
    });
    errorResponse(res, err);
  }
};

exports.downloadInvoicePDF = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user._id;

    const invoiceData = await invoiceService.generateInvoiceData(
      orderId,
      customerId
    );

    

    res.json({
      message: "Invoice data ready for PDF generation",
      data: invoiceData,
    });
  } catch (err) {
    logger.error({
      event: "DOWNLOAD_INVOICE_ERROR",
      orderId: req.params.orderId,
      error: err.message,
    });
    errorResponse(res, err);
  }
};