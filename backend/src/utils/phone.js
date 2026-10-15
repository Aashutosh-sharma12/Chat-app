const { parsePhoneNumberFromString } = require('libphonenumber-js');
const env = require('../config/env');

// Returns the number in E.164 format (+919876543210) or null if invalid.
function normalizePhone(raw) {
  if (!raw) return null;
  const parsed = parsePhoneNumberFromString(String(raw).trim(), env.defaultCountry);
  return parsed && parsed.isValid() ? parsed.number : null;
}

module.exports = { normalizePhone };
