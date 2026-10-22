const { isReserved } = require("./reservedUsernames");

// Derive a unique username from a seed (the email local part) by suffixing
// a counter until we find a free slot. Used when the client hasn't picked
// a username themselves.
async function deriveUniqueUsername(seed) {
  const cleaned = (
    String(seed)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "")
      .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
      .slice(0, 18) || "user"
  );
  let candidate = cleaned;
  let i = 0;
  while (
    isReserved(candidate) ||
    (await require("../services/user.service").isUsernameTaken(candidate))
  ) {
    i += 1;
    candidate = `${cleaned}${i}`;
    if (i > 200) break;
  }
  return candidate;
}

module.exports = { deriveUniqueUsername };
