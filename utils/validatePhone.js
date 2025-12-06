const { phone } = require("phone");

/**
 * Validates if a phone number is valid and real (format + region)
 * @param {string} number - phone number input
 * @param {string} [countryCode="IN"] - default country code (IN for India)
 */
function isPhoneValid(number, countryCode = "IN") {
  const result = phone(number, { country: countryCode });
  return result.isValid;
}

module.exports = isPhoneValid;
