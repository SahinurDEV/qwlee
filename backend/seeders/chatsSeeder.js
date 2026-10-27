const { Chats, Messages, Inboxes } = require("../src/models");
const risk = require("../src/services/risk.service");
const { pick, rand, daysAgo } = require("./utils/random");

// Realistic-feeling thread for each buyer/seller pair we've already
// connected through orders. We create a Chat, several Messages, and an
// Inbox row (which carries the "last message" preview the UI shows).

const THREAD_TEMPLATES = [
  // Risky off-platform (seeded for admin Flagged queue demos)
  [
    { from: "buyer", text: "Hi! Can we continue on WhatsApp? My number is +8801712345678 or email me at buyer.demo@gmail.com" },
    { from: "seller", text: "Sure — or pay via paypal.me/demoseller outside the platform if you prefer." },
    { from: "buyer", text: "Also reach john at gmail dot com if the chat is slow." },
  ],
  // Web dev / SaaS
  [
    { from: "buyer", text: "Hi! I read your gig — looks like exactly what we need. Can we talk scope?" },
    { from: "seller", text: "Hey, thanks for reaching out. Happy to. What's the deadline you're working toward?" },
    { from: "buyer", text: "Soft launch in 3 weeks. We've got Figma designs ready and a Vercel account set up." },
    { from: "seller", text: "Doable. Can you share the Figma? I'll come back with a package recommendation today." },
    { from: "buyer", text: "Sent. Let me know if you need access to anything else." },
  ],
  // Design
  [
    { from: "buyer", text: "Love your portfolio. We're rebranding — would you be open to a full identity package?" },
    { from: "seller", text: "Absolutely. Could you send me a quick brand brief, even a rough one?" },
    { from: "buyer", text: "Here's our current site and a few brands we admire. We want serious but warm." },
    { from: "seller", text: "Got it. I'll come back with 2 directions in a week." },
  ],
  // Video
  [
    { from: "buyer", text: "Hi! I need 8 shorts per week from my podcast feed. Ongoing." },
    { from: "seller", text: "Yes, I do recurring work. Send me a sample episode and your preferred style refs." },
    { from: "buyer", text: "Will do. Are weekly invoices fine?" },
    { from: "seller", text: "Yes — I'll set up a recurring milestone in the order." },
  ],
  // SEO
  [
    { from: "buyer", text: "Our traffic is stuck. Looking for someone to do a real audit, not a templated PDF." },
    { from: "seller", text: "Understood. Can you share GSC access and your top 5 commercial pages?" },
    { from: "buyer", text: "GSC invite sent. Top pages are /pricing, /enterprise, /integrations and 2 blog posts." },
    { from: "seller", text: "Perfect. I'll have findings within 4 days." },
  ],
  // Mobile
  [
    { from: "buyer", text: "We have a half-finished RN app and the previous dev disappeared. Can you take over?" },
    { from: "seller", text: "Yes. Can you share the repo and any context on what's working/broken?" },
    { from: "buyer", text: "Repo invite incoming. Auth and home screen work; payments are broken." },
    { from: "seller", text: "Got it. I'll send a triage list before we start. Likely 2 weeks to a stable release." },
  ],
];

async function seedChats({ buyers, sellers, gigs }) {
  const chatDocs = [];
  const messageDocs = [];
  const inboxDocs = [];

  // Build up to 8 chat threads across realistic pairings.
  // The demo buyer always gets the first two threads (one with the demo
  // seller) so buyer@example.com never opens an empty inbox.
  const pairings = [];
  const demoBuyer = buyers.find((b) => b.email === "buyer@example.com");
  const demoSeller = sellers.find((s) => s.email === "seller@example.com");
  if (demoBuyer && demoSeller) pairings.push({ buyer: demoBuyer, seller: demoSeller });
  for (let i = 0; pairings.length < 8 && i < 40; i++) {
    const gig = pick(gigs);
    const seller = sellers.find(
      (s) => s._id.toString() === gig.userId.toString()
    );
    if (!seller) continue;
    const wantDemo = demoBuyer && pairings.filter((p) => p.buyer === demoBuyer).length < 2;
    const buyer = wantDemo ? demoBuyer : pick(buyers);
    if (pairings.some((p) => p.buyer === buyer && p.seller === seller)) continue;
    pairings.push({ buyer, seller });
  }

  for (let i = 0; i < pairings.length; i++) {
    const { buyer, seller } = pairings[i];
    const thread = THREAD_TEMPLATES[i % THREAD_TEMPLATES.length];

    const chat = await Chats.create({
      participants: [buyer._id, seller._id],
      status: "accepted",
    });
    chatDocs.push(chat);

    // Build messages chronologically across the last week.
    const startDaysAgo = rand(2, 14);
    const minutesPerMessage = 30;

    let lastMessage = null;
    for (let m = 0; m < thread.length; m++) {
      const entry = thread[m];
      const sender = entry.from === "buyer" ? buyer : seller;
      const receiver = entry.from === "buyer" ? seller : buyer;
      const createdAt = new Date(
        daysAgo(startDaysAgo).getTime() + m * minutesPerMessage * 60 * 1000
      );

      const msg = await Messages.create({
        chat: chat._id,
        content: { messageType: "text", message: entry.text, files: [] },
        sender: sender._id,
        receiver: receiver._id,
        readed: m < thread.length - 1, // last message unread
        createdAt,
        updatedAt: createdAt,
      });
      messageDocs.push(msg);
      // Auto-flag contact / off-platform seed messages for the Flagged queue.
      try {
        const screened = await risk.screen(entry.text, { contact: true });
        if (screened.reasons.length) {
          await risk.record("message", msg._id, sender._id, screened.reasons, entry.text, {
            spans: screened.spans, score: screened.score, chatId: chat._id, aiSource: "seed",
          });
        }
      } catch (_) {}
      lastMessage = { msg, sender, entry, createdAt };
    }

    // One inbox row per chat — the UI uses this for the conversation list.
    inboxDocs.push({
      ownersId: [buyer._id, seller._id],
      roomId: chat._id.toString(),
      roomType: "private",
      unreadMessage: 1,
      content: {
        from: lastMessage.sender._id,
        senderName: lastMessage.sender.fullName,
        text: lastMessage.entry.text,
        time: lastMessage.createdAt,
      },
    });
  }

  const inboxes = await Inboxes.insertMany(inboxDocs);

  return {
    chats: chatDocs,
    messages: messageDocs,
    inboxes,
  };
}

module.exports = { seedChats };
