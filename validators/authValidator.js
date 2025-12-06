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

exports.signupValidation = [
  body("password")
    .notEmpty().withMessage("Password is required")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

 body("email")
  .optional()
  .matches(emailRegex)
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
    })
  .withMessage("Enter a valid  email"),


  body("phone")
    .optional()
    .matches(/^[0-9]{10}$/).withMessage("Phone number must be 10 digits")
    .custom((value) => {
      if (!isPhoneValid(value)) {
        throw new Error("Enter a valid phone number");
      }
      return true;
    }),

  body().custom(value => {
    if (!value.email && !value.phone) {
      throw new Error("Either email or phone is required");
    }
    return true;
  }),
];

exports.verifyOtpValidation = [
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP format"),
];

exports.completeProfileValidation = [
  body("userId")
    .notEmpty().withMessage("User ID is required")
    .isMongoId().withMessage("Invalid User ID"),

  body("firstName")
    .notEmpty().withMessage("First name is required")
    .isLength({ min: 4, max: 8}).withMessage("First name must be 4-8 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("First name can only contain letters and spaces"),

  body("lastName")
    .notEmpty().withMessage("Last name is required")
    .isLength({ min: 2, max: 30 }).withMessage("Last name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("Last name can only contain letters and spaces"),

  body("shopName")
    .notEmpty().withMessage("Shop name is required")
    .isLength({ min: 3, max: 50 }).withMessage("Shop name must be 3-50 characters"),

  body("shopAddress")
    .notEmpty().withMessage("Shop address is required")
    .isLength({ min: 5, max: 150 }).withMessage("Shop address must be 5-150 characters"),

  body("phone")
    .optional()
    .matches(/^(?:\+91)?[6-9]\d{9}$/).withMessage("Phone number must be valid (with or without +91)")

  
];

exports.shopkeeperLoginValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required"),
  body("password")
    .notEmpty().withMessage("Password is required"),
 
];

exports.verifyLoginOtpValidation = [
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP format"),
];

exports.forgotPasswordSendValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
];

exports.forgotPasswordVerifyValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 4, max: 6 }).withMessage("Invalid OTP format"),
];

exports.forgotPasswordResetValidation = [
  body("identifier")
    .notEmpty().withMessage("Email or phone is required")
    .bail()
    .custom(validateIdentifierValue),
  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
];
