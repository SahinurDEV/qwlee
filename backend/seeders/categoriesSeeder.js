const { Categories } = require("../src/models");
const images = require("./utils/images");

// Generic top-level marketplace categories plus one level of
// subcategories (Categories.parentId).
//
// The `type` field is omitted; the Mongoose default of "online" applies.
// Qwlee is online-only — the field is kept for back-compat.
// Category list with a paired icon *key*. Keys map to react-icon
// components on both the admin picker and the marketplace renderer
// (admin/src/common/categoryIcons.js and frontend/utils/categoryIcons.js).
const CATEGORIES = [
  { name: "Web Development", icon: "code" },
  { name: "Mobile Development", icon: "phone" },
  { name: "UI/UX Design", icon: "palette" },
  { name: "Graphic Design", icon: "brush" },
  { name: "Video Editing", icon: "video" },
  { name: "Digital Marketing", icon: "megaphone" },
  { name: "Writing & Translation", icon: "pencil" },
  { name: "AI Services", icon: "sparkles" },
  { name: "Music & Audio", icon: "music" },
  { name: "Business Consulting", icon: "briefcase" },
  { name: "Photography", icon: "camera" },
  { name: "Data & Analytics", icon: "calculator" },
  { name: "Game Development", icon: "game" },
  { name: "Finance & Accounting", icon: "trending" },
  { name: "E-Commerce", icon: "storefront" },
];

const SUBCATEGORIES = {
  "Web Development": ["Full-Stack Websites", "WordPress", "Landing Pages", "Bug Fixes"],
  "Mobile Development": ["iOS Apps", "Android Apps", "Cross-Platform Apps"],
  "UI/UX Design": ["Web Design", "App Design", "Prototyping"],
  "Graphic Design": ["Logo Design", "Brand Identity", "Illustration", "Social Media Graphics"],
  "Video Editing": ["Short-Form Video", "YouTube Editing", "Motion Graphics"],
  "Digital Marketing": ["SEO", "Social Media Marketing", "Paid Ads"],
  "Writing & Translation": ["Blog Posts", "Copywriting", "Translation"],
  "AI Services": ["Chatbots", "AI Automation", "Machine Learning"],
  "Music & Audio": ["Mixing & Mastering", "Voice Over", "Podcast Editing"],
  "Business Consulting": ["Business Plans", "Market Research", "Strategy"],
  "Photography": ["Product Photography", "Photo Editing", "Portraits"],
  "Data & Analytics": ["Dashboards", "Data Cleaning", "Data Analysis"],
  "Game Development": ["Unity", "Game Art", "Unreal Engine"],
  "Finance & Accounting": ["Bookkeeping", "Financial Modeling", "Tax Preparation"],
  "E-Commerce": ["Shopify", "Product Listings", "Store Management"],
};

async function seedCategories() {
  const docs = CATEGORIES.map(({ name, icon }) => ({
    name,
    icon,
    image: images.category(name),
  }));
  const categories = await Categories.insertMany(docs);
  const subDocs = categories.flatMap((parent) =>
    (SUBCATEGORIES[parent.name] || []).map((name) => ({
      name,
      icon: CATEGORIES.find((c) => c.name === parent.name).icon,
      image: images.category(name),
      parentId: parent._id,
    }))
  );
  const subcategories = await Categories.insertMany(subDocs);
  return { categories, subcategories };
}

module.exports = { seedCategories };
