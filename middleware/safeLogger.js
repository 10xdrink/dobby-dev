const logger = require('../config/logger');

function safeLogger(err, req, res, next) {
  logger.error({
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    route: req.originalUrl,
    method: req.method,
    ip: req.ip,
    headers: {
      'user-agent': req.headers['user-agent']
    },
    body: req.body ? { ...req.body, password: '***', token: '***' } : undefined,
    params: req.params,
    query: req.query,
    timestamp: new Date().toISOString()
  });

  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
  });
}

module.exports = safeLogger;
