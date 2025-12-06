const { body } = require("express-validator");
const isEmailValid = require("../utils/validateEmail");
const isPhoneValid = require("../utils/validatePhone");

const emailRegex =
  /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;

async function validateIdentifierValue(value) {
  if (!value) {
    throw new Error("Email or phone is required");
  }

  const identifier = value.trim();

  if (identifier.includes("@")) {
    const { valid, reason } = await isEmailValid(identifier.toLowerCase());
    if (!valid) {
      let msg = "Invalid email address";
      if (reason === "regex") msg = "Email format is invalid";
      if (reason === "mx") msg = "Email domain is invalid (no MX records)";
      if (reason === "disposable")
        msg = "Disposable or temporary emails are not allowed";
      if (reason === "smtp") msg = "Email server did not respond";
      throw new Error(msg);
    }
    return true;
  }

  const normalizedNumber = identifier.startsWith("+")
    ? identifier
    : identifier.replace(/\D/g, "").length === 10
    ? `+91${identifier.replace(/\D/g, "")}`
    : identifier;

  if (!isPhoneValid(normalizedNumber)) {
    throw new Error("Enter a valid phone number");
  }

  return true;
}

// Common reusable patterns
const emailField = body("email")
  .optional()
  .trim()
  .normalizeEmail()
  .matches(emailRegex)
  .withMessage("Invalid email format")
  .bail()
  .custom(async (value) => {
    const { valid, reason } = await isEmailValid(value);
    if (!valid) {
      let msg = "Invalid email address";
      if (reason === "regex") msg = "Email format is invalid";
      if (reason === "mx") msg = "Email domain is invalid (no MX records)";
      if (reason === "disposable") msg = "Disposable or temporary emails are not allowed";
      if (reason === "smtp") msg = "Email server did not respond";
      throw new Error(msg);
    }
    return true;
  });

const phoneField = body("phone")
  .optional()
  .trim()
  .matches(/^(?:\+91)?[6-9]\d{9}$/)
  .withMessage("Phone number must be valid (with or without +91)")
  .bail()
  .custom((value) => {
    if (!isPhoneValid(value)) {
      throw new Error("Enter a valid phone number");
    }
    return true;
  });

/* ---------------------- SIGNUP VALIDATION ---------------------- */
exports.sendSignupOtpValidation = [
  emailField,
  phoneField,
  body().custom((value) => {
    if (!value.email && !value.phone) {
      throw new Error("Either email or phone is required");
    }
    return true;
  }),
];

/* ---------------------- VERIFY SIGNUP OTP ---------------------- */
exports.verifySignupOtpValidation = [
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isNumeric().withMessage("OTP must contain only numbers")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP length"),
];

/* ---------------------- COMPLETE SIGNUP ---------------------- */
exports.completeSignupValidation = [
  body("email").notEmpty().withMessage("Email is required").isEmail().withMessage("Invalid email"),
  body("firstName")
    .notEmpty().withMessage("First name is required")
    .isLength({ min: 2, max: 30 }).withMessage("First name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("First name can only contain letters"),
  body("lastName")
    .optional()
    .isLength({ min: 2, max: 30 }).withMessage("Last name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("Last name can only contain letters"),
  body("phone")
    .notEmpty().withMessage("Phone is required")
    .matches(/^(?:\+91)?[6-9]\d{9}$/).withMessage("Phone number must be valid"),
  body("password")
    .optional()
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
];

/* ---------------------- LOGIN SEND OTP ---------------------- */
exports.sendLoginOtpValidation = [
  emailField,
  phoneField,
  body().custom((value) => {
    if (!value.email && !value.phone) {
      throw new Error("Email or phone is required for login");
    }
    return true;
  }),
];

/* ---------------------- VERIFY LOGIN OTP ---------------------- */
exports.verifyLoginOtpValidation = [
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isNumeric().withMessage("OTP must contain only numbers")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP length"),
];

/* ---------------------- UPDATE PROFILE ---------------------- */
exports.updateProfileValidation = [
  body("firstName")
    .optional()
    .isLength({ min: 2, max: 30 }).withMessage("First name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("First name can only contain letters"),
  body("lastName")
    .optional()
    .isLength({ min: 2, max: 30 }).withMessage("Last name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("Last name can only contain letters"),
  phoneField,
  body("birthday")
    .optional()
    .isISO8601().withMessage("Invalid date format (must be YYYY-MM-DD)"),
  body("password")
    .optional()
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage("Password must contain 8+ chars, 1 uppercase, 1 lowercase, 1 number & 1 symbol"),
];

exports.sendPasswordResetLinkValidation = [
  emailField,
  phoneField,
  body().custom((value) => {
    if (!value.email && !value.phone) {
      throw new Error("Either email or phone number is required");
    }
    return true;
  }),
];


exports.resetPasswordWithTokenValidation = [
  body("token")
    .notEmpty()
    .withMessage("Reset token is required")
    .isString()
    .withMessage("Token must be a string")
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid token format")
    .trim(),
  
  body("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isStrongPassword({
      minLength: 8,
      minLowercase: 1,
      minUppercase: 1,
      minNumbers: 1,
      minSymbols: 1,
    })
    .withMessage("Password must contain 8+ chars, 1 uppercase, 1 lowercase, 1 number & 1 symbol")
    .trim(),
  
  body("confirmPassword")
    .notEmpty()
    .withMessage("Password confirmation is required")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),
];

exports.customerForgotSendValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
];

exports.customerForgotVerifyValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP format"),
];

exports.customerForgotResetValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];



