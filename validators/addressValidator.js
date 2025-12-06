const { body, query, param } = require("express-validator");
const isEmailValid = require("../utils/validateEmail");
const isPhoneValid = require("../utils/validatePhone");

exports.addAddressValidation = [
  body("email")
    .trim()
    .normalizeEmail()
    .custom(async (value) => {
      if (!value) return true;
      const { valid, reason } = await isEmailValid(value);
      if (!valid) {
        let msg = "Invalid email address";
        if (reason === "regex") msg = "Email format is invalid";
        if (reason === "mx") msg = "Email domain is invalid (no MX records)";
        if (reason === "disposable") msg = "Disposable emails not allowed";
        if (reason === "smtp") msg = "Email server did not respond";
        throw new Error(msg);
      }
      return true;
    }),

  
  body("phone")
  .trim()
  .matches(/^\+91[1-9][0-9]{9}$/)
  .withMessage("Phone number must start with +91 and be followed by 10 digits (not starting with 0)")
  .custom((value) => {
    if (!value) return true;
    if (!isPhoneValid(value)) throw new Error("Enter a valid phone number");
    return true;
  }),
    body("type")
  .optional()
  .isIn(["shipping", "billing"])
  .withMessage("type must be either 'shipping' or 'billing'"),


  body("firstName")
    .notEmpty().withMessage("First name is required")
    .trim()
    .isLength({ min: 2, max: 30 }).withMessage("First name must be 2-30 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("First name can only contain letters and spaces"),

  body("lastName")
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage("Last name must be max 30 characters")
    .matches(/^[A-Za-z\s]*$/).withMessage("Last name can only contain letters and spaces"),

  body("addressLine")
    .notEmpty().withMessage("Address line is required")
    .trim()
    .isLength({ min: 5, max: 150 }).withMessage("Address must be 5-150 characters"),

  body("city")
    .notEmpty().withMessage("city is required")
    .trim()
    ,

  body("state")
    .notEmpty().withMessage("state is required")
    .trim()
  ,
  body("country")
   .notEmpty().withMessage("country is required")
    .trim()
    ,
  body("zipCode")
    .notEmpty().withMessage("zipcode is required")
    .trim()
    .matches(/^\d{4,10}$/).withMessage("Zip code must be 4-10 digits"),

  body("isDefault")
    .optional()
    .isBoolean().withMessage("isDefault must be boolean"),

 
];

exports.addressIdValidation = [
  param("id")
    .notEmpty().withMessage("Address ID is required")
    .isMongoId().withMessage("Invalid Address ID")
];

exports.sessionIdQueryValidation = [
  query("sessionId")
    .notEmpty().withMessage("Session ID is required")
    .isString().withMessage("Session ID must be a string")
];
