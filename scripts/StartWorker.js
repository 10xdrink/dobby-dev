#!/usr/bin/env node
require("dotenv").config();
const logger = require("../config/logger");

logger.info("Starting Bulk Upload Worker...");

require("../workers/bulkUploadWorker");

logger.info("Bulk Upload Worker is running. Press Ctrl+C to stop.");