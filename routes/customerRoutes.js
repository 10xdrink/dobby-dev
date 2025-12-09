const express = require("express");
const passport = require("passport");
const {
  sendSignupOtp,
  verifySignupOtp,
  completeSignup,
  sendLoginOtp,
  verifyLoginOtp,
  forgotPasswordSendOtp,
  forgotPasswordVerifyOtp,
  forgotPasswordReset,
  getProfile,
  updateProfile,
  forgotPassword,
  resetPassword,
  generateToken,
  submitReview,
  getProductReviews,
  logout,
  blockCustomer,
  unblockCustomer,
  deleteAccount,
  verifyForgotOtp,
  sendDeleteOtp,
  verifyDeleteOtpAndDelete,
  sendPasswordResetLink,
  verifyResetToken,
  resetPasswordWithToken,
} = require("../controllers/customerController");
const {
  getRefundMethod,
  saveRefundMethod,
  deleteRefundMethod,
} = require("../controllers/refundMethodController");
const { protect } = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const logger = require("../config/logger");
const {
  sendSignupOtpValidation,
  verifySignupOtpValidation,
  completeSignupValidation,
  sendLoginOtpValidation,
  verifyLoginOtpValidation,
  sendPasswordResetLinkValidation,
  resetPasswordWithTokenValidation,
  customerForgotSendValidation,
  customerForgotVerifyValidation,
  customerForgotResetValidation,
} = require("../validators/customerValidator");
const { validate } = require("../middleware/validate");
const cartService = require("../services/cartService");
const router = express.Router();

//signup
router.post(
  "/signup/send-otp",
  sendSignupOtpValidation,
  validate,
  sendSignupOtp
);
router.post(
  "/signup/verify-otp",
  verifySignupOtpValidation,
  validate,
  verifySignupOtp
);
router.post(
  "/signup/complete",
  completeSignupValidation,
  validate,
  completeSignup
);

// login
router.post("/login/send-otp", sendLoginOtpValidation, validate, sendLoginOtp);
router.post(
  "/login/verify-otp",
  verifyLoginOtpValidation,
  validate,
  verifyLoginOtp
);

// forgot password

router.post(
  "/forgot-password",
  customerForgotSendValidation,
  validate,
  forgotPassword
);
router.post(
  "/verify-forgot",
  customerForgotVerifyValidation,
  validate,
  verifyForgotOtp
);
router.post(
  "/password-reset",
  customerForgotResetValidation,
  validate,
  resetPassword
);

router.post("/customer-review", protect(["customer"]), submitReview),
  router.get("/product-review/:productId", getProductReviews);

// Get profile

router.get("/profile", protect(["customer"]), getProfile);
router.put(
  "/profile",
  protect(["customer"]),
  upload.single("profilePhoto"),
  updateProfile
);

router.post("/logout", protect(["customer"]), logout);

router.put("/block/:customerId", blockCustomer);

// UNBLOCK CUSTOMER
router.put("/unblock/:customerId", unblockCustomer);

router.delete("/account", protect(["customer"]), deleteAccount);

router.delete("/delete/send-otp", protect(["customer"]), sendDeleteOtp);

router.delete(
  "/delete/verify",
  protect(["customer"]),
  verifyDeleteOtpAndDelete
);

router.post(
  "/app/forgot-password",
  sendPasswordResetLinkValidation,
  validate,
  sendPasswordResetLink
);

router.get("/app/verify-reset-token", verifyResetToken);

router.post(
  "/app/reset-password",
  resetPasswordWithTokenValidation,
  validate,
  resetPasswordWithToken
);
logger.info("NODE_ENV:", process.env.NODE_ENV);
logger.info("FRONTEND_PROD:", process.env.FRONTEND_PROD);
logger.info("FRONTEND_LOCAL:", process.env.FRONTEND_LOCAL);

router.get(
  "/auth/google",
  (req, res, next) => {
    logger.info("Google OAuth login attempt started");
    const sessionId = req.query.sessionId;
    const state = sessionId ? JSON.stringify({ sessionId }) : undefined;
    
    passport.authenticate("google", { 
      scope: ["profile", "email"],
      state: state
    })(req, res, next);
  }
);

router.get(
  "/auth/google/callback",
  (req, res, next) => {
    logger.info("Google OAuth callback hit");
    next();
  },
  passport.authenticate("google", { failureRedirect: "/login" }),
  async (req, res) => {
    try {
      logger.info("Passport authenticate passed");

      if (!req.user) {
        logger.error("Google callback: req.user is undefined!");
        return res.status(500).send("Authentication failed: no user returned");
      }

      logger.info(
        `Google callback: req.user found - ${req.user.email || req.user.id}`
      );

      // Handle Cart Merge
      if (req.query.state) {
        try {
          const state = JSON.parse(req.query.state);
          if (state.sessionId) {
            logger.info(`Merging guest cart ${state.sessionId} for Google user ${req.user._id}`);
            await cartService.mergeGuestCart({ 
              user: req.user, 
              body: { sessionId: state.sessionId } 
            });
          }
        } catch (err) {
          logger.warn(`Failed to merge cart during Google callback: ${err.message}`);
        }
      }

      const token = generateToken(req.user);
      logger.info("Token generated successfully");

      const frontendUrl =
        process.env.NODE_ENV === "production"
          ? process.env.FRONTEND_PROD
          : process.env.FRONTEND_LOCAL;

      logger.info(`Redirecting to frontend: ${frontendUrl}/?token=${token}`);
      res.redirect(`${frontendUrl}/?token=${token}`);
    } catch (err) {
      logger.error(`Error in Google callback handler: ${err.message}`, err);
      res.status(500).send("Internal Server Error");
    }
  }
);

// FACEBOOK
router.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);

router.get(
  "/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  (req, res) => {
    const token = generateToken(req.user);
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_PROD
        : process.env.FRONTEND_LOCAL;

    res.redirect(`${frontendUrl}/auth-success?token=${token}`);
  }
);

// AMAZON
router.get(
  "/auth/amazon",
  passport.authenticate("amazon", { scope: ["profile"] })
);

router.get(
  "/auth/amazon/callback",
  passport.authenticate("amazon", { failureRedirect: "/login" }),
  (req, res) => {
    const token = generateToken(req.user);
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_PROD
        : process.env.FRONTEND_LOCAL;

    res.redirect(`${frontendUrl}/auth-success?token=${token}`);
  }
);

// APPLE
router.get("/auth/apple", passport.authenticate("apple"));

router.post(
  "/auth/apple/callback",
  passport.authenticate("apple", { failureRedirect: "/login" }),
  (req, res) => {
    const token = generateToken(req.user);
    const frontendUrl =
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_PROD
        : process.env.FRONTEND_LOCAL;

    res.redirect(`${frontendUrl}/auth-success?token=${token}`);
  }
);

// ==================== REFUND METHOD ROUTES ====================
// Get customer's refund method
router.get("/refund-method", protect(["customer"]), getRefundMethod);

// Save or update customer's refund method
router.post("/refund-method", protect(["customer"]), saveRefundMethod);

// Delete customer's refund method
router.delete("/refund-method", protect(["customer"]), deleteRefundMethod);

module.exports = router;