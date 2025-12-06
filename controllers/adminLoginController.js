const Admin = require("../models/adminLogin");
const verifyCaptcha = require("../utils/verifyCaptcha");
const { sendOTP } = require("../utils/mailer");
const { sendSMS } = require("../utils/sms");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const logger = require("../config/logger");
const crypto = require("crypto");

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) || 1;
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 3;

// function generateToken(email) {
//   return jwt.sign({ email }, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_EXPIRES_IN || "1d",
//   });
// }

function generateToken(admin) {
  return jwt.sign(
    {
      id: admin._id,
      email: admin.email,
      phone: admin.phone,
      role: "admin",
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

// Helper to detect if input is email or phone
const resolveIdentifier = (input) => {
  if (!input || typeof input !== "string") {
    return { type: "unknown", value: input };
  }

  const trimmedInput = input.trim();
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/i;
  const phoneRegex = /^\+?[0-9]{10,15}$/;

  if (emailRegex.test(trimmedInput)) {
    return { type: "email", value: trimmedInput.toLowerCase() };
  }
  if (phoneRegex.test(trimmedInput)) {
    return { type: "phone", value: trimmedInput };
  }

  return { type: "unknown", value: trimmedInput };
};

const getPhoneVariations = (phone) => {
  const variations = new Set();
  variations.add(phone);

  const digits = phone.replace(/\D/g, "");
  variations.add(digits);

  if (digits.length === 10) {
    variations.add(`91${digits}`);
    variations.add(`+91${digits}`);
  } else if (digits.length === 12 && digits.startsWith("91")) {
    variations.add(digits.substring(2));
    variations.add(`+${digits}`);
  }

  return Array.from(variations);
};

exports.adminLogin = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.adminLogin", requestId };

  try {
    const { email: identifier, password } = req.body;

    logger.info({
      ...context,
      event: "ADMIN_LOGIN_ATTEMPT",
      identifier: identifier ? identifier.substring(0, 3) + "***" : null,
    });

    if (!identifier || !password) {
      logger.warn({ ...context, event: "ADMIN_LOGIN_MISSING_FIELDS" });
      return res.status(400).json({
        success: false,
        message: "Email/Phone and password are required",
      });
    }

    // if (!captchaToken) {
    //   return res.status(400).json({ message: "captcha is required" });
    // }

    // const captchaOk = await verifyCaptcha(captchaToken);
    // if (!captchaOk)
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Captcha verification failed" });

    const { type, value } = resolveIdentifier(identifier);

    if (type === "unknown") {
      logger.warn({
        ...context,
        event: "ADMIN_LOGIN_INVALID_IDENTIFIER_FORMAT",
      });
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email or phone number",
      });
    }

    // Build query based on identifier type
    let query = {};
    if (type === "email") {
      query.email = value;
    } else if (type === "phone") {
      query.phone = { $in: getPhoneVariations(value) };
    }

    const admin = await Admin.findOne(query);
    if (!admin) {
      logger.warn({
        ...context,
        event: "ADMIN_LOGIN_FAILED",
        reason: "User not found",
        identifierType: type,
      });
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      logger.warn({
        ...context,
        event: "ADMIN_LOGIN_FAILED",
        reason: "Password mismatch",
        adminId: admin._id,
      });
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const token = generateToken(admin);
    logger.info({
      ...context,
      event: "ADMIN_LOGIN_SUCCESS",
      adminId: admin._id,
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_LOGIN_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.adminLogout = (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  logger.info({
    requestId,
    route: "adminController.adminLogout",
    event: "ADMIN_LOGOUT",
    adminId: req.user?.id,
  });
  res.json({ success: true, message: "Logged out" });
};

exports.forgotPassword = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.forgotPassword", requestId };

  try {
    const { email: identifier } = req.body;

    logger.info({
      ...context,
      event: "ADMIN_FORGOT_PASSWORD_REQUEST",
      identifier: identifier ? identifier.substring(0, 3) + "***" : null,
    });

    if (!identifier) {
      logger.warn({
        ...context,
        event: "ADMIN_FORGOT_PASSWORD_MISSING_IDENTIFIER",
      });
      return res
        .status(400)
        .json({ success: false, message: "Email or phone is required" });
    }

    const { type, value } = resolveIdentifier(identifier);

    if (type === "unknown") {
      logger.warn({
        ...context,
        event: "ADMIN_FORGOT_PASSWORD_INVALID_FORMAT",
      });
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email or phone number",
      });
    }

    // Build query based on identifier type
    let query = {};
    if (type === "email") {
      query.email = value;
    } else if (type === "phone") {
      query.phone = { $in: getPhoneVariations(value) };
    }

    const admin = await Admin.findOne(query);

    // Secure: Always return success even if user not found (prevents enumeration)
    if (!admin) {
      logger.warn({
        ...context,
        event: "ADMIN_FORGOT_PASSWORD_USER_NOT_FOUND",
        identifierType: type,
      });
      return res
        .status(200)
        .json({ success: true, message: "If account exists, OTP sent" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    admin.resetOtpHash = otpHash;
    admin.resetOtpExpiry = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
    admin.resetOtpVerified = false;
    admin.resetOtpAttempts = 0;
    await admin.save();

    // Send OTP to the method specified (email -> email, phone -> SMS)
    try {
      if (type === "email" && admin.email) {
        await sendOTP(admin.email, otp);
        logger.info({
          ...context,
          event: "ADMIN_OTP_SENT_EMAIL",
          adminId: admin._id,
        });
      } else if (type === "phone" && admin.phone) {
        await sendSMS(admin.phone, otp);
        logger.info({
          ...context,
          event: "ADMIN_OTP_SENT_SMS",
          adminId: admin._id,
        });
      } else {
        // If identifier type doesn't match admin's registered method, send to available method
        if (admin.email) {
          await sendOTP(admin.email, otp);
          logger.info({
            ...context,
            event: "ADMIN_OTP_SENT_EMAIL_FALLBACK",
            adminId: admin._id,
          });
        } else if (admin.phone) {
          await sendSMS(admin.phone, otp);
          logger.info({
            ...context,
            event: "ADMIN_OTP_SENT_SMS_FALLBACK",
            adminId: admin._id,
          });
        }
      }
    } catch (sendError) {
      logger.error({
        ...context,
        event: "ADMIN_OTP_SEND_ERROR",
        error: sendError.message,
        adminId: admin._id,
      });
      return res
        .status(500)
        .json({ success: false, message: "Failed to send OTP" });
    }

    return res
      .status(200)
      .json({ success: true, message: "If account exists, OTP sent" });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_FORGOT_PASSWORD_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.verifyOtp = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.verifyOtp", requestId };

  try {
    const { email: identifier, otp } = req.body;

    logger.info({
      ...context,
      event: "ADMIN_OTP_VERIFY_ATTEMPT",
      identifier: identifier ? identifier.substring(0, 3) + "***" : null,
    });

    if (!identifier || !otp) {
      logger.warn({ ...context, event: "ADMIN_OTP_VERIFY_MISSING_FIELDS" });
      return res
        .status(400)
        .json({ success: false, message: "Email/Phone and OTP required" });
    }

    const { type, value } = resolveIdentifier(identifier);

    if (type === "unknown") {
      logger.warn({ ...context, event: "ADMIN_OTP_VERIFY_INVALID_FORMAT" });
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email or phone number",
      });
    }

    // Build query based on identifier type
    let query = {};
    if (type === "email") {
      query.email = value;
    } else if (type === "phone") {
      query.phone = { $in: getPhoneVariations(value) };
    }

    const admin = await Admin.findOne(query);
    if (!admin || !admin.resetOtpHash) {
      logger.warn({
        ...context,
        event: "ADMIN_OTP_VERIFY_INVALID_OR_EXPIRED",
        identifierType: type,
      });
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    if (Date.now() > new Date(admin.resetOtpExpiry).getTime()) {
      admin.resetOtpHash = null;
      admin.resetOtpExpiry = null;
      admin.resetOtpAttempts = 0;
      admin.resetOtpVerified = false;
      await admin.save();
      logger.warn({
        ...context,
        event: "ADMIN_OTP_VERIFY_EXPIRED",
        adminId: admin._id,
      });
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    if (admin.resetOtpAttempts >= OTP_MAX_ATTEMPTS) {
      logger.warn({
        ...context,
        event: "ADMIN_OTP_VERIFY_MAX_ATTEMPTS",
        adminId: admin._id,
      });
      return res
        .status(429)
        .json({ success: false, message: "Max OTP attempts exceeded" });
    }

    const match = await bcrypt.compare(otp, admin.resetOtpHash);
    if (!match) {
      admin.resetOtpAttempts += 1;
      await admin.save();
      logger.warn({
        ...context,
        event: "ADMIN_OTP_VERIFY_INVALID",
        adminId: admin._id,
        attempts: admin.resetOtpAttempts,
      });
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    admin.resetOtpVerified = true;
    await admin.save();

    logger.info({
      ...context,
      event: "ADMIN_OTP_VERIFIED",
      adminId: admin._id,
    });

    return res
      .status(200)
      .json({ success: true, message: "OTP verified. Now reset password." });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_OTP_VERIFY_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.resetPassword = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.resetPassword", requestId };

  try {
    const { email: identifier, newPassword } = req.body;

    logger.info({
      ...context,
      event: "ADMIN_RESET_PASSWORD_ATTEMPT",
      identifier: identifier ? identifier.substring(0, 3) + "***" : null,
    });

    if (!identifier || !newPassword) {
      logger.warn({ ...context, event: "ADMIN_RESET_PASSWORD_MISSING_FIELDS" });
      return res.status(400).json({
        success: false,
        message: "Email/Phone and newPassword required",
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      logger.warn({ ...context, event: "ADMIN_RESET_PASSWORD_WEAK" });
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    const { type, value } = resolveIdentifier(identifier);

    if (type === "unknown") {
      logger.warn({ ...context, event: "ADMIN_RESET_PASSWORD_INVALID_FORMAT" });
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email or phone number",
      });
    }

    // Build query based on identifier type
    let query = {};
    if (type === "email") {
      query.email = value;
    } else if (type === "phone") {
      query.phone = { $in: getPhoneVariations(value) };
    }

    const admin = await Admin.findOne(query);
    if (!admin || !admin.resetOtpVerified) {
      logger.warn({
        ...context,
        event: "ADMIN_RESET_PASSWORD_OTP_NOT_VERIFIED",
        identifierType: type,
      });
      return res
        .status(400)
        .json({ success: false, message: "OTP not verified" });
    }

    if (Date.now() > new Date(admin.resetOtpExpiry).getTime()) {
      admin.resetOtpHash = null;
      admin.resetOtpExpiry = null;
      admin.resetOtpVerified = false;
      admin.resetOtpAttempts = 0;
      await admin.save();
      logger.warn({
        ...context,
        event: "ADMIN_RESET_PASSWORD_SESSION_EXPIRED",
        adminId: admin._id,
      });
      return res.status(400).json({
        success: false,
        message: "Session expired. Please request a new OTP.",
      });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    admin.password = hash;
    admin.resetOtpHash = null;
    admin.resetOtpExpiry = null;
    admin.resetOtpVerified = false;
    admin.resetOtpAttempts = 0;
    await admin.save();

    logger.info({
      ...context,
      event: "ADMIN_PASSWORD_RESET_SUCCESS",
      adminId: admin._id,
    });

    return res
      .status(200)
      .json({ success: true, message: "Password reset successful" });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_RESET_PASSWORD_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.changePassword = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.changePassword", requestId };

  try {
    const adminId = req.user?.id;
    const { newPassword, confirmPassword } = req.body;

    if (!adminId) {
      logger.warn({ ...context, event: "ADMIN_CHANGE_PASSWORD_UNAUTHORIZED" });
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!newPassword || !confirmPassword) {
      logger.warn({
        ...context,
        event: "ADMIN_CHANGE_PASSWORD_MISSING_FIELDS",
      });
      return res
        .status(400)
        .json({ success: false, message: "All password fields are required" });
    }

    if (newPassword.length < 6) {
      logger.warn({ ...context, event: "ADMIN_CHANGE_PASSWORD_WEAK" });
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    if (newPassword !== confirmPassword) {
      logger.warn({ ...context, event: "ADMIN_CHANGE_PASSWORD_MISMATCH" });
      return res
        .status(400)
        .json({ success: false, message: "Passwords do not match" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      logger.warn({
        ...context,
        event: "ADMIN_CHANGE_PASSWORD_NOT_FOUND",
        adminId,
      });
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    
    // const isCurrentPasswordValid = await bcrypt.compare(
    //   currentPassword,
    //   admin.password
    // );
    // if (!isCurrentPasswordValid) {
    //   logger.warn({
    //     ...context,
    //     event: "ADMIN_CHANGE_PASSWORD_INVALID_CURRENT",
    //     adminId,
    //   });
    //   return res
    //     .status(400)
    //     .json({ success: false, message: "Current password is incorrect" });
    // }

    
    // const isSamePassword = await bcrypt.compare(newPassword, admin.password);
    // if (isSamePassword) {
    //   logger.warn({
    //     ...context,
    //     event: "ADMIN_CHANGE_PASSWORD_SAME_AS_CURRENT",
    //     adminId,
    //   });
    //   return res.status(400).json({
    //     success: false,
    //     message: "New password must be different from current password",
    //   });
    // }

    const salt = await bcrypt.genSalt(10);
    admin.password = await bcrypt.hash(newPassword, salt);
    await admin.save();

    logger.info({
      ...context,
      event: "ADMIN_CHANGE_PASSWORD_SUCCESS",
      adminId,
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_CHANGE_PASSWORD_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.updateAdminProfile = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.updateAdminProfile", requestId };

  try {
    const adminId = req.user?.id;
    if (!adminId) {
      logger.warn({ ...context, event: "ADMIN_UPDATE_PROFILE_UNAUTHORIZED" });
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const admin = await Admin.findById(adminId);
    if (!admin) {
      logger.warn({
        ...context,
        event: "ADMIN_UPDATE_PROFILE_NOT_FOUND",
        adminId,
      });
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    logger.info({
      ...context,
      event: "ADMIN_UPDATE_PROFILE_START",
      adminId,
    });

    // Update profile photo if provided
    if (req.file && req.file.path) {
      admin.profilePhoto = req.file.path;
      logger.info({ ...context, event: "ADMIN_UPDATE_PROFILE_PHOTO", adminId });
    }

    // Update name if provided
    if (req.body.name !== undefined) {
      admin.name = req.body.name.trim() || null;
    }

    // Update email if provided (with validation and uniqueness check)
    if (req.body.email !== undefined && req.body.email !== null) {
      const newEmail = req.body.email.trim().toLowerCase();

      // Validate email format
      const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
      if (!emailRegex.test(newEmail)) {
        logger.warn({
          ...context,
          event: "ADMIN_UPDATE_PROFILE_INVALID_EMAIL",
          adminId,
        });
        return res
          .status(400)
          .json({ success: false, message: "Invalid email format" });
      }

      // Check if email is already in use by another admin
      if (newEmail !== admin.email) {
        const existingAdmin = await Admin.findOne({
          email: newEmail,
          _id: { $ne: adminId },
        });

        if (existingAdmin) {
          logger.warn({
            ...context,
            event: "ADMIN_UPDATE_PROFILE_EMAIL_EXISTS",
            adminId,
            email: newEmail.substring(0, 3) + "***",
          });
          return res
            .status(400)
            .json({ success: false, message: "Email already in use" });
        }

        admin.email = newEmail;
        logger.info({
          ...context,
          event: "ADMIN_UPDATE_PROFILE_EMAIL_UPDATED",
          adminId,
        });
      }
    }

    // Update phone if provided (with validation and uniqueness check)
    if (req.body.phone !== undefined && req.body.phone !== null) {
      const newPhone = req.body.phone.trim();

      // Validate phone format
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(newPhone)) {
        logger.warn({
          ...context,
          event: "ADMIN_UPDATE_PROFILE_INVALID_PHONE",
          adminId,
        });
        return res.status(400).json({
          success: false,
          message: "Invalid phone format. Must be 10-15 digits.",
        });
      }

      // Check if phone is already in use by another admin
      if (newPhone !== admin.phone) {
        const existingAdmin = await Admin.findOne({
          phone: newPhone,
          _id: { $ne: adminId },
        });

        if (existingAdmin) {
          logger.warn({
            ...context,
            event: "ADMIN_UPDATE_PROFILE_PHONE_EXISTS",
            adminId,
          });
          return res
            .status(400)
            .json({ success: false, message: "Phone number already in use" });
        }

        admin.phone = newPhone;
        logger.info({
          ...context,
          event: "ADMIN_UPDATE_PROFILE_PHONE_UPDATED",
          adminId,
        });
      }
    }

    // Ensure at least one of email or phone exists
    if (!admin.email && !admin.phone) {
      logger.warn({
        ...context,
        event: "ADMIN_UPDATE_PROFILE_NO_IDENTIFIER",
        adminId,
      });
      return res.status(400).json({
        success: false,
        message: "At least one of email or phone is required",
      });
    }

    await admin.save();

    logger.info({
      ...context,
      event: "ADMIN_UPDATE_PROFILE_SUCCESS",
      adminId,
    });

    // Remove sensitive fields before sending response
    const adminObj = admin.toObject();
    delete adminObj.password;
    delete adminObj.resetOtpHash;
    delete adminObj.resetOtpExpiry;
    delete adminObj.resetOtpVerified;
    delete adminObj.resetOtpAttempts;

    res.json({
      success: true,
      message: "Profile updated",
      admin: adminObj,
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_UPDATE_PROFILE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getAdminProfile = async (req, res) => {
  const requestId = crypto.randomBytes(8).toString("hex");
  const context = { route: "adminController.getAdminProfile", requestId };

  try {
    const adminId = req.user?.id;

    if (!adminId) {
      logger.warn({ ...context, event: "ADMIN_GET_PROFILE_UNAUTHORIZED" });
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const admin = await Admin.findById(adminId).select(
      "-password -resetOtpHash -resetOtpExpiry -resetOtpVerified -resetOtpAttempts"
    );

    if (!admin) {
      logger.warn({
        ...context,
        event: "ADMIN_GET_PROFILE_NOT_FOUND",
        adminId,
      });
      return res
        .status(404)
        .json({ success: false, message: "Admin not found" });
    }

    logger.info({
      ...context,
      event: "ADMIN_GET_PROFILE_SUCCESS",
      adminId,
    });

    res.json({
      success: true,
      admin: admin.toObject(),
    });
  } catch (err) {
    logger.error({
      ...context,
      event: "ADMIN_GET_PROFILE_ERROR",
      error: err.message,
      stack: err.stack,
    });
    res.status(500).json({ success: false, message: "Server error" });
  }
};