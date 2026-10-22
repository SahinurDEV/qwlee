const crypto = require("crypto");

// Cryptographically random 6-digit one-time code.
const generateOtp = () => crypto.randomInt(100000, 1000000);

module.exports = { generateOtp };
