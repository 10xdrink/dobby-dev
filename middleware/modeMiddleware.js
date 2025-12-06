const EnvironmentSettings = require("../models/Environment");
const cors = require("cors");

async function modeMiddleware(req, res, next) {
  try {
    const settings = await EnvironmentSettings.findOne();

    if (settings) {
      let allowedOrigins = [];

      if (settings.appMode === "dev") {
        console.log("Development Mode Active");
        // Allow localhost AND production in development
        allowedOrigins = [
          "http://localhost:3000",
          "http://localhost:8081",      // Expo web
          "http://localhost:19006",     // Expo web alternative
          "https://test-dobby.vercel.app"
        ];
      } else if (settings.appMode === "live") {
        console.log("Live Mode Active");
        // Allow only production in live
        allowedOrigins = ["https://test-dobby.vercel.app"];
      }

      return applyCors(req, res, next, allowedOrigins);
    }

    next();
  } catch (err) {
    console.error("Mode middleware error:", err.message);
    next();
  }
}

// helper CORS function
function applyCors(req, res, next, allowedOrigins) {
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow tools like Postman
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      } else {
        console.warn("Blocked by CORS:", origin);
        return callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
  })(req, res, next);
}

module.exports = modeMiddleware;
