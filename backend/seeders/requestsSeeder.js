const { BuyerRequest, RequestOffer } = require("../src/models");

// Buyer requests (job posts) with a few seller offers each, so the
// "Buyer requests" board and the buyer's offer inbox have data.
const REQUESTS = [
  { cat: "Web Development", sub: "Landing Pages", title: "Need a landing page for my SaaS product launch", budget: 400, days: 7,
    description: "Looking for a fast, responsive landing page built with Next.js or similar. Copy and logo are ready. Needs a pricing table and a signup form." },
  { cat: "Graphic Design", sub: "Logo Design", title: "Logo and brand colours for a coffee shop", budget: 150, days: 5,
    description: "We are opening a small specialty coffee shop. Want a modern minimal logo, a colour palette and a simple style sheet." },
  { cat: "Mobile Development", sub: "Cross-Platform Apps", title: "Fix crashes in our React Native app", budget: 300, days: 4,
    description: "Our app crashes on Android 14 when opening the camera screen. Need someone experienced to find and fix the issue." },
  { cat: "Digital Marketing", sub: "SEO", title: "SEO audit for an online furniture store", budget: 250, days: 6,
    description: "Want a full technical and on-page SEO audit with a prioritised list of fixes for our Shopify store." },
  { cat: "Video Editing", sub: "Short-Form Video", title: "Edit 5 short-form videos for Instagram Reels", budget: 120, days: 3,
    description: "Raw footage is ready. Need captions, cuts, music and a consistent style across all five videos." },
  { cat: "Writing & Translation", sub: "Translation", title: "Translate product descriptions English to Spanish", budget: 90, days: 3,
    description: "About 40 short product descriptions for an e-commerce site need natural Spanish translation." },
];

async function seedRequests({ buyers, sellers, categories, subcategories = [] }) {
  const catByName = Object.fromEntries(categories.map((c) => [c.name, c]));
  const now = Date.now();
  const docs = REQUESTS.map((r, i) => {
    const cat = catByName[r.cat];
    const sub =
      subcategories.find((s) => String(s.parentId) === String(cat?._id) && s.name === r.sub) ||
      subcategories.find((s) => String(s.parentId) === String(cat?._id));
    return {
      buyerId: buyers[i % buyers.length]._id,
      title: r.title,
      description: r.description,
      categoriesId: cat?._id || null,
      subCategoryId: sub?._id || null,
      budget: r.budget,
      deliveryDays: r.days,
      status: "open",
      expiresAt: new Date(now + 14 * 86400000),
    };
  });
  const requests = await BuyerRequest.insertMany(docs);
  const offers = [];
  requests.forEach((req, i) => {
    // Skip the first seller (seller@example.com) so they can make an offer in the demo.
    for (let k = 0; k < 2; k++) {
      const seller = sellers[1 + ((i + k) % (sellers.length - 1))];
      offers.push({
        requestId: req._id,
        sellerId: seller._id,
        buyerId: req.buyerId,
        price: Math.round(req.budget * (0.85 + 0.1 * k)),
        deliveryDays: Math.max(1, req.deliveryDays - 1 + k),
        revisions: 1 + k,
        message: `Hi! I have done many similar projects and can deliver this in ${req.deliveryDays} days with clear updates along the way.`,
      });
    }
  });
  const created = await RequestOffer.insertMany(offers);
  await Promise.all(requests.map((r) => BuyerRequest.updateOne({ _id: r._id }, { $set: { offersCount: 2 } })));
  // One seller on vacation so the "away" state is visible in the demo.
  const { User } = require("../src/models");
  const away = sellers[sellers.length - 1];
  await User.updateOne(
    { _id: away._id },
    { $set: { availability: { away: true, from: null, until: new Date(now + 7 * 86400000), message: "On a short break, back next week!", allowMessages: true } } }
  );
  return { requests, requestOffers: created };
}

module.exports = { seedRequests };
