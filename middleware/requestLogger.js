const expressWinston = require('express-winston');
const logger = require('../config/logger');

const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  meta: true, // log request metadata
  msg: "HTTP {{req.method}} {{req.url}}",
  expressFormat: false,
  colorize: false,
  ignoreRoute: (req) => req.url.startsWith('/health'), // skip health checks
});

module.exports = requestLogger;
