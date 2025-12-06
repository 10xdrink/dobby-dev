const winston = require('winston');
require('winston-daily-rotate-file');
const { combine, timestamp, errors, printf, colorize, json } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] : ${stack || message}`;
});

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  filename: 'logs/%DATE%-combined.log',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

const errorRotateFile = new winston.transports.DailyRotateFile({
  filename: 'logs/%DATE%-error.log',
  level: 'error',
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '10m',
  maxFiles: '30d'
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    process.env.NODE_ENV === 'production' ? json() : colorize({ all: true }),
    process.env.NODE_ENV === 'production' ? winston.format.uncolorize() : logFormat
  ),
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
    dailyRotateFileTransport,
    errorRotateFile,
  ],
  exitOnError: false,
});

// Catch unhandled errors globally
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION', err);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION', reason);
});

module.exports = logger;
