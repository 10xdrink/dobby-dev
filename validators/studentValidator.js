const { body, param } = require("express-validator");


const emailRegex =
  /^[a-zA-Z0-9]+([._%+-]?[a-zA-Z0-9]+)*@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/;
const phoneRegex = /^(?:\+91)?[6-9]\d{9}$/;


exports.registerStep1 = [
  body("fullName")
    .notEmpty().withMessage("Full name is required")
    .isLength({ min: 3}).withMessage("Full name must be at least 3 characters"),
  body("email")
    .notEmpty().withMessage("Email is required")
    .matches(emailRegex).withMessage("Enter valid email"),
  body("phone")
    .notEmpty().withMessage("Phone number is required")
    .matches(phoneRegex).withMessage("Enter phone number"),
  body("schoolname")
    .notEmpty().withMessage("School name is required")
       .isLength({ min: 4, max: 50}).withMessage("First name must be 4-24 characters")
];


exports.registerStep2 = [
  body("studentId")
    .notEmpty().withMessage("studentId is required"),
  body("class")
    .notEmpty().withMessage("Class is required"),
  body("parentName")
    .notEmpty().withMessage("Parent name is required").isLength({min:3,max:40}).withMessage("Parent name must be 3-40 characters"),
  body("parentPhone")
    .notEmpty().withMessage("Parent phone is required")
    .matches(phoneRegex).withMessage("Enter Phone number"),
  body("address")
    .notEmpty().withMessage("Address is required"),
];


exports.sendLogin = [
  body("email")
    .optional()
    .matches(emailRegex).withMessage("Enter valid email"),
  body("phone")
    .optional()
    .matches(phoneRegex).withMessage("Enter phone number"),
  body().custom((value) => {
    if (!value.email && !value.phone) {
      throw new Error("Either email or phone is required");
    }
    return true;
  }),
];


exports.verifyLogin = [
  body("otp")
    .notEmpty().withMessage("OTP is required")
    .isLength({ min: 6, max: 6 }).withMessage("OTP must be 6 digits"),
];


exports.updateStu = [
  param("id").notEmpty().withMessage("Student ID is required"),
  body("fullName").optional().isLength({ min: 2 }).withMessage("Full name must be at least 2 characters"),
  body("email").optional().matches(emailRegex).withMessage("Enter valid email"),
  body("phone").optional().matches(phoneRegex).withMessage("Enter phone number"),
];
