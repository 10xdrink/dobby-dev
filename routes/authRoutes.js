const express = require("express");
const jwt = require("jsonwebtoken");

const upload = require("../middleware/upload")
const {protect} = require("../middleware/authMiddleware")
const {  verifyOTP, shopkeeperLogin, forgotPasswordSendOtp, forgotPasswordVerifyOtp, forgotPasswordReset, getProfile, updateProfile, completeProfile, sendSignupOtp, verifyLoginOtp, logout } = require('../controllers/authController');
const { signupValidation, verifyOtpValidation, shopkeeperLoginValidation, verifyLoginOtpValidation, completeProfileValidation, forgotPasswordSendValidation, forgotPasswordVerifyValidation, forgotPasswordResetValidation } = require("../validators/authValidator");
const { validate } = require("../middleware/validate");

const router = express.Router();

router.post('/send-otp', signupValidation, validate, sendSignupOtp);
router.post('/verify-otp', verifyOtpValidation, validate, verifyOTP);
router.post('/shopkeeper-login', shopkeeperLoginValidation, validate, shopkeeperLogin);
router.post("/verify-login", verifyLoginOtpValidation, validate, verifyLoginOtp)


router.post("/forgot-password/send-otp", forgotPasswordSendValidation, validate, forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyValidation, validate, forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", forgotPasswordResetValidation, validate, forgotPasswordReset);

router.get("/profile", protect(["shopkeeper"]), getProfile);
router.put("/profile", protect(["shopkeeper"]), upload.single("profile"), updateProfile);
router.post('/logout', protect(['shopkeeper']), logout);

router.post("/completeProfile", completeProfileValidation, validate, completeProfile)

module.exports = router;


/*  const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { sendOTPToEmail, verifyOTP, shopkeeperLogin } = require('../controllers/authController');

const router = express.Router();

// OTP
router.post('/send-otp', sendOTPToEmail);
router.post('/verify-otp', verifyOTP);
router.post('/shopkeeper-login', shopkeeperLogin);

// Google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_PROD}/shopkeeper?token=${token}`);
  }
);

// Facebook
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
router.get('/facebook/callback', passport.authenticate('facebook', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_PROD}/shopkeeper?token=${token}`);
  }
);

// Amazon
router.get('/amazon', passport.authenticate('amazon', { scope: ['profile'] }));
router.get('/amazon/callback', passport.authenticate('amazon', { failureRedirect: '/login' }),
  (req, res) => {
    const token = jwt.sign({ id: req.user._id, email: req.user.email, role: req.user.role },
      process.env.JWT_SECRET, { expiresIn: '7d' });
    res.redirect(`${process.env.FRONTEND_PROD}/shopkeeper?token=${token}`);
  }
);

module.exports = router; */ 
