// Seller "vacation mode" (Fiverr: Availability). A seller is away when
// availability.away is set and now falls inside [from, until).
const isAway = (user, now = new Date()) => {
  const a = user?.availability;
  if (!a?.away) return false;
  if (a.from && new Date(a.from) > now) return false;
  if (a.until && new Date(a.until) <= now) return false;
  return true;
};

// Mongo filter matching users who are away right now.
const awayFilter = (now = new Date()) => ({
  "availability.away": true,
  $and: [
    { $or: [{ "availability.from": null }, { "availability.from": { $lte: now } }] },
    { $or: [{ "availability.until": null }, { "availability.until": { $gt: now } }] },
  ],
});

module.exports = { isAway, awayFilter };
