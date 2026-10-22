const { Gig } = require("../src/models");
const images = require("./utils/images");
const { slugify } = require("./utils/slug");

// 18 gigs distributed across our 7 sellers. Each carries 3 packages
// (Basic / Standard / Premium) matching the frontend's AddGig form shape:
// { name, price, deliveryDate (days), features: [{feature}] }.
const GIGS = [
  // Sofia Martinez (Full-Stack)
  {
    seller: "sofiacodes",
    category: "Web Development",
    title: "I will build a modern Next.js SaaS website with authentication and Stripe",
    description:
      "Production-ready Next.js 14 App Router site: marketing pages, dashboard, auth (NextAuth or Clerk), Stripe subscriptions, Postgres + Prisma, and clean component architecture. I deliver a deployable repo, not just designs.",
    price: 750,
    packages: [
      {
        name: "Basic",
        price: 750,
        deliveryDate: 7,
        features: [
          "Landing page + 3 marketing pages",
          "Responsive design",
          "Contact form",
          "Vercel deployment",
        ],
      },
      {
        name: "Standard",
        price: 1500,
        deliveryDate: 14,
        features: [
          "Everything in Basic",
          "Auth (NextAuth) with email + Google",
          "Dashboard skeleton",
          "Postgres + Prisma schema",
        ],
      },
      {
        name: "Premium",
        price: 3200,
        deliveryDate: 21,
        features: [
          "Everything in Standard",
          "Stripe subscriptions & customer portal",
          "Role-based access control",
          "2 weeks of post-launch support",
        ],
      },
    ],
  },
  {
    seller: "sofiacodes",
    category: "Web Development",
    title: "I will build a custom REST or GraphQL API in Node.js with full test coverage",
    description:
      "Clean, documented Node.js API: Express or Fastify, OpenAPI schema, JWT auth, Postgres or Mongo, Jest tests, and Docker. Built for teams that take backend reliability seriously.",
    price: 600,
    packages: [
      {
        name: "Basic",
        price: 600,
        deliveryDate: 5,
        features: ["Up to 10 endpoints", "JWT auth", "OpenAPI docs"],
      },
      {
        name: "Standard",
        price: 1200,
        deliveryDate: 10,
        features: [
          "Up to 25 endpoints",
          "Postgres or Mongo",
          "Jest test suite",
          "Docker setup",
        ],
      },
      {
        name: "Premium",
        price: 2400,
        deliveryDate: 18,
        features: [
          "Up to 60 endpoints",
          "GraphQL or REST",
          "CI pipeline",
          "Deployed to your cloud",
        ],
      },
    ],
  },
  {
    seller: "sofiacodes",
    category: "Web Development",
    title: "I will fix bugs and improve performance in your existing Next.js or React app",
    description:
      "Code audit, fix critical bugs, eliminate hydration warnings, tune Core Web Vitals. You get a PR with a clear changelog, not a black-box rewrite.",
    price: 250,
    packages: [
      {
        name: "Basic",
        price: 250,
        deliveryDate: 3,
        features: ["Fix up to 3 bugs", "Written diagnosis"],
      },
      {
        name: "Standard",
        price: 600,
        deliveryDate: 6,
        features: ["Up to 10 bugs", "Performance audit", "Lighthouse report"],
      },
      {
        name: "Premium",
        price: 1400,
        deliveryDate: 12,
        features: [
          "Up to 25 bugs",
          "Full perf rewrite of hot paths",
          "Follow-up call",
        ],
      },
    ],
  },

  // Daniel Park (UI/UX)
  {
    seller: "danpark",
    category: "UI/UX Design",
    title: "I will design a high-converting SaaS landing page in Figma",
    description:
      "Conversion-focused landing page tailored to your ICP. Includes hero, social proof, feature blocks, pricing, and FAQ — each section informed by current SaaS benchmarks.",
    price: 400,
    packages: [
      {
        name: "Basic",
        price: 400,
        deliveryDate: 4,
        features: ["1 desktop design", "Light mode", "1 revision"],
      },
      {
        name: "Standard",
        price: 850,
        deliveryDate: 7,
        features: [
          "Desktop + mobile",
          "Light + dark mode",
          "Prototype",
          "3 revisions",
        ],
      },
      {
        name: "Premium",
        price: 1800,
        deliveryDate: 12,
        features: [
          "Up to 4 pages",
          "Full design system tokens",
          "Webflow handoff",
          "Unlimited revisions for 2 weeks",
        ],
      },
    ],
  },
  {
    seller: "danpark",
    category: "UI/UX Design",
    title: "I will design a full dashboard UI for your B2B SaaS",
    description:
      "Dashboards that internal teams and customers actually use. I work from your data model, not Dribbble shots. Includes empty states, loading states, and error states.",
    price: 1200,
    packages: [
      {
        name: "Basic",
        price: 1200,
        deliveryDate: 7,
        features: ["Up to 5 screens", "Light mode", "1 revision"],
      },
      {
        name: "Standard",
        price: 2400,
        deliveryDate: 14,
        features: [
          "Up to 15 screens",
          "Light + dark",
          "Empty/loading/error states",
          "3 revisions",
        ],
      },
      {
        name: "Premium",
        price: 4800,
        deliveryDate: 21,
        features: [
          "Full app",
          "Component library in Figma",
          "Engineering handoff doc",
          "2 weeks of follow-up",
        ],
      },
    ],
  },
  {
    seller: "danpark",
    category: "Graphic Design",
    title: "I will design a brand identity: logo, color, typography, and usage guide",
    description:
      "Identity systems for early-stage startups. You receive logo files, a color palette, type pairing, and a one-page usage guide — enough to launch a brand without ongoing design dependency.",
    price: 600,
    packages: [
      {
        name: "Basic",
        price: 600,
        deliveryDate: 5,
        features: ["Logo (1 concept)", "Color palette", "Type pairing"],
      },
      {
        name: "Standard",
        price: 1100,
        deliveryDate: 10,
        features: [
          "Logo (3 concepts)",
          "Brand guide PDF",
          "Social templates",
        ],
      },
      {
        name: "Premium",
        price: 2000,
        deliveryDate: 14,
        features: [
          "Everything in Standard",
          "Pitch deck template",
          "Email signature + business card",
        ],
      },
    ],
  },

  // Priya Anand (Video)
  {
    seller: "priyaedits",
    category: "Video Editing",
    title: "I will edit your long-form YouTube video with B-roll, captions, and color",
    description:
      "Edit, color, sound, captions, thumbnail. 24h turnaround on standard scope. I cut for retention — pacing, jump cuts, and motion graphics where they earn their keep.",
    price: 120,
    packages: [
      {
        name: "Basic",
        price: 120,
        deliveryDate: 2,
        features: ["Up to 10 min", "Cuts + captions", "1 revision"],
      },
      {
        name: "Standard",
        price: 280,
        deliveryDate: 3,
        features: ["Up to 20 min", "B-roll + music", "Color grade", "Thumbnail"],
      },
      {
        name: "Premium",
        price: 600,
        deliveryDate: 5,
        features: [
          "Up to 40 min",
          "Motion graphics",
          "Sound mix",
          "Multi-platform exports",
        ],
      },
    ],
  },
  {
    seller: "priyaedits",
    category: "Video Editing",
    title: "I will edit short-form vertical videos for TikTok, Reels and Shorts",
    description:
      "Hook-first short-form editing. I deliver 9:16 ready-to-upload files with captions, sound design, and on-screen text. Bulk packs for content creators.",
    price: 80,
    packages: [
      {
        name: "Basic",
        price: 80,
        deliveryDate: 2,
        features: ["3 shorts", "Captions", "1 revision"],
      },
      {
        name: "Standard",
        price: 180,
        deliveryDate: 3,
        features: ["8 shorts", "Hook variations", "Sound design"],
      },
      {
        name: "Premium",
        price: 380,
        deliveryDate: 5,
        features: ["20 shorts", "Custom branded template", "A/B hooks"],
      },
    ],
  },

  // James O'Connor (SEO)
  {
    seller: "jamesseo",
    category: "Digital Marketing",
    title: "I will do a technical SEO audit of your B2B SaaS site",
    description:
      "Crawl, log file analysis, Core Web Vitals, internal linking, schema audit. You get a prioritized fix list with effort/impact scoring — not a generic checklist.",
    price: 450,
    packages: [
      {
        name: "Basic",
        price: 450,
        deliveryDate: 5,
        features: ["Up to 5k URLs", "Top 20 issues", "Loom walkthrough"],
      },
      {
        name: "Standard",
        price: 900,
        deliveryDate: 8,
        features: [
          "Up to 50k URLs",
          "Full prioritized backlog",
          "Schema templates",
        ],
      },
      {
        name: "Premium",
        price: 1800,
        deliveryDate: 14,
        features: [
          "Unlimited URLs",
          "Implementation supervision",
          "Quarterly re-audit",
        ],
      },
    ],
  },
  {
    seller: "jamesseo",
    category: "Digital Marketing",
    title: "I will write 5 SEO-optimized blog posts for your B2B SaaS",
    description:
      "Keyword research, outline, draft. I write to rank AND to convert: every post has a clear next step that ties back to your funnel.",
    price: 600,
    packages: [
      {
        name: "Basic",
        price: 600,
        deliveryDate: 7,
        features: ["3 posts · 1200 words", "Keyword research"],
      },
      {
        name: "Standard",
        price: 1100,
        deliveryDate: 12,
        features: ["5 posts · 1800 words", "Internal linking map"],
      },
      {
        name: "Premium",
        price: 2200,
        deliveryDate: 21,
        features: [
          "10 posts · 2200 words",
          "Topic cluster strategy",
          "Editorial calendar",
        ],
      },
    ],
  },

  // Aisha Mohammed (Mobile)
  {
    seller: "aishamobile",
    category: "Mobile Development",
    title: "I will build a React Native app for iOS and Android",
    description:
      "Cross-platform mobile app: navigation, auth, Stripe, push notifications, offline-first data. I publish to App Store and Play Store; you own the source.",
    price: 1500,
    packages: [
      {
        name: "Basic",
        price: 1500,
        deliveryDate: 14,
        features: ["Up to 5 screens", "Auth", "Push notifications"],
      },
      {
        name: "Standard",
        price: 3200,
        deliveryDate: 21,
        features: [
          "Up to 15 screens",
          "Stripe + in-app purchase",
          "Offline sync",
        ],
      },
      {
        name: "Premium",
        price: 6500,
        deliveryDate: 35,
        features: [
          "Production app",
          "Backend included",
          "App Store + Play Store submission",
        ],
      },
    ],
  },
  {
    seller: "aishamobile",
    category: "Mobile Development",
    title: "I will fix bugs and ship features in your React Native or Flutter app",
    description:
      "Surgical fixes for production mobile apps. I work in PRs against your repo, with clear changelogs and minimal blast radius.",
    price: 350,
    packages: [
      {
        name: "Basic",
        price: 350,
        deliveryDate: 4,
        features: ["Up to 3 bugs", "PR with tests"],
      },
      {
        name: "Standard",
        price: 800,
        deliveryDate: 8,
        features: ["Up to 10 bugs", "Crashlytics audit"],
      },
      {
        name: "Premium",
        price: 1800,
        deliveryDate: 14,
        features: ["Ongoing sprint", "Feature work included"],
      },
    ],
  },

  // Lena Fischer (Copy)
  {
    seller: "lenawrites",
    category: "Writing & Translation",
    title: "I will write conversion-focused copy for your SaaS landing page",
    description:
      "Direct-response landing copy: hero, value props, social proof, FAQ. Researched against your competitors and ICP — not generic templates.",
    price: 350,
    packages: [
      {
        name: "Basic",
        price: 350,
        deliveryDate: 3,
        features: ["Hero + 3 sections", "1 revision"],
      },
      {
        name: "Standard",
        price: 700,
        deliveryDate: 5,
        features: ["Full landing page", "2 hook variations", "3 revisions"],
      },
      {
        name: "Premium",
        price: 1400,
        deliveryDate: 10,
        features: [
          "Landing + 3 ad creatives",
          "Email welcome sequence (5 emails)",
        ],
      },
    ],
  },
  {
    seller: "lenawrites",
    category: "Writing & Translation",
    title: "I will write a 5-email welcome sequence for your SaaS or e-commerce list",
    description:
      "Onboarding sequence that activates trial users or first-time buyers. Each email has a clear purpose and a single CTA.",
    price: 280,
    packages: [
      {
        name: "Basic",
        price: 280,
        deliveryDate: 4,
        features: ["5 emails", "1 revision"],
      },
      {
        name: "Standard",
        price: 550,
        deliveryDate: 7,
        features: ["7 emails", "A/B subject lines", "3 revisions"],
      },
      {
        name: "Premium",
        price: 1100,
        deliveryDate: 12,
        features: ["12 emails", "Re-engagement sequence", "Loom strategy walkthrough"],
      },
    ],
  },

  // Thiago Ribeiro (AI)
  {
    seller: "thiagoai",
    category: "AI Services",
    title: "I will build a production RAG chatbot with Claude and a vector DB",
    description:
      "Retrieval-augmented chatbot on your data. Ingestion, chunking, embeddings, vector DB (Pinecone/Weaviate), eval harness. Built for accuracy, not demos.",
    price: 2000,
    packages: [
      {
        name: "Basic",
        price: 2000,
        deliveryDate: 7,
        features: ["Up to 1k docs", "Basic eval set", "Hosted on your infra"],
      },
      {
        name: "Standard",
        price: 4000,
        deliveryDate: 14,
        features: [
          "Up to 10k docs",
          "Reranking",
          "Citations in responses",
          "Eval dashboard",
        ],
      },
      {
        name: "Premium",
        price: 8500,
        deliveryDate: 28,
        features: [
          "Up to 100k docs",
          "Agent workflows",
          "Per-customer isolation",
          "Production SLAs",
        ],
      },
    ],
  },
  {
    seller: "thiagoai",
    category: "AI Services",
    title: "I will integrate the Claude API into your product with prompt caching",
    description:
      "Production Claude integration: streaming, tool use, prompt caching, retries with exponential backoff, and an eval harness. Includes a clean SDK wrapper for your codebase.",
    price: 900,
    packages: [
      {
        name: "Basic",
        price: 900,
        deliveryDate: 5,
        features: ["1 endpoint", "Streaming", "Prompt caching"],
      },
      {
        name: "Standard",
        price: 1800,
        deliveryDate: 10,
        features: ["Up to 5 endpoints", "Tool use", "Eval harness"],
      },
      {
        name: "Premium",
        price: 3500,
        deliveryDate: 18,
        features: [
          "Agent loops",
          "Multi-model routing",
          "Cost dashboard",
        ],
      },
    ],
  },

  // Mixed AI music etc — Thiago second gig already covers AI. Add Music & Audio for variety:
  {
    seller: "priyaedits",
    category: "Music & Audio",
    title: "I will master and clean up your podcast audio",
    description:
      "Noise reduction, EQ, leveling, intro/outro music. Per-episode pricing, weekly subscription available.",
    price: 90,
    packages: [
      {
        name: "Basic",
        price: 90,
        deliveryDate: 2,
        features: ["Up to 30 min", "Noise reduction", "Leveling"],
      },
      {
        name: "Standard",
        price: 180,
        deliveryDate: 3,
        features: ["Up to 60 min", "Intro/outro", "Loudness normalization"],
      },
      {
        name: "Premium",
        price: 380,
        deliveryDate: 4,
        features: ["Up to 2h", "Show notes", "Audiogram clips"],
      },
    ],
  },
];

// Generic Fiverr-style add-ons, FAQ and buyer questions so every seeded
// gig exercises extras, requirements and the FAQ section.
const EXTRAS = [
  { title: "Extra-fast delivery", description: "Delivered sooner than the package time.", price: 50, deliveryDays: 0 },
  { title: "Additional revision", description: "One more round of changes.", price: 25, deliveryDays: 1 },
  { title: "Source files", description: "All editable source files included.", price: 40, deliveryDays: 0 },
];
const FAQ = [
  { question: "What do you need to get started?", answer: "Answer the requirement questions after ordering and share any assets or examples you like." },
  { question: "Do you offer refunds?", answer: "If I cannot deliver what was agreed, you can cancel the order and the payment held in escrow is refunded." },
  { question: "Can I request changes?", answer: "Yes. Each package includes revisions, and you can buy additional revisions as an extra." },
];
const REQUIREMENT_QUESTIONS = [
  { question: "Describe your project and its goal.", required: true },
  { question: "Share links to examples you like (optional).", required: false },
];

async function seedGigs({ sellers, categories }) {
  const sellerByUsername = Object.fromEntries(sellers.map((s) => [s.username, s]));
  const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c]));

  const docs = GIGS.map((g, i) => {
    const seller = sellerByUsername[g.seller];
    const category = categoryByName[g.category];
    if (!seller) throw new Error(`Missing seller for gig: ${g.seller}`);
    if (!category) throw new Error(`Missing category for gig: ${g.category}`);
    return {
      title: g.title,
      slug: slugify(g.title) + "-" + (i + 1),
      description: g.description,
      price: g.price,
      images: [
        images.gig(g.title, 0),
        images.gig(g.title, 1),
        images.gig(g.title, 2),
      ],
      categoriesId: category._id,
      userId: seller._id,
      package: g.packages,
      subCategoryId: g.subcategory && categoryByName[g.subcategory] ? categoryByName[g.subcategory]._id : null,
      extras: g.extras || EXTRAS.slice(0, 1 + (i % 3)),
      faq: g.faq || FAQ,
      requirementQuestions: g.requirementQuestions || REQUIREMENT_QUESTIONS,
    };
  });

  const gigs = await Gig.insertMany(docs);
  return { gigs };
}

module.exports = { seedGigs };
