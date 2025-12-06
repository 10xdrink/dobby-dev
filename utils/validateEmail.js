const validator = require("deep-email-validator");
async function isEmailValid(email) {
  return validator.validate({
    email,
    validateRegex: true,
    validateMx: false,
    validateDisposable: true,
    validateSMTP: false,
  });
}

module.exports = isEmailValid;
 