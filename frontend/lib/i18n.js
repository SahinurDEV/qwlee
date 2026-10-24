// Interface translations for the shared site chrome (header, footer, gig
// cards). Page content and user-written text stay in their own language.
// Add a language by adding a column here; missing keys fall back to English.
import { PHRASES } from "./i18nPhrases";

export const LANGS = { en: "English", es: "Español", fr: "Français", bn: "বাংলা" };
export const LANG_COOKIE = "qwlee_lang";

const T = {
  categories: { es: "Categorías", fr: "Catégories", bn: "বিভাগ" },
  findService: { es: "Busca un servicio…", fr: "Trouver un service…", bn: "সার্ভিস খুঁজুন…" },
  explore: { es: "Explorar", fr: "Explorer", bn: "ঘুরে দেখুন" },
  signIn: { es: "Iniciar sesión", fr: "Se connecter", bn: "সাইন ইন" },
  join: { es: "Únete", fr: "S'inscrire", bn: "যোগ দিন" },
  signOut: { es: "Cerrar sesión", fr: "Se déconnecter", bn: "সাইন আউট" },
  startingAt: { es: "Desde", fr: "À partir de", bn: "শুরু" },
  marketplace: { es: "Mercado", fr: "Marché", bn: "মার্কেটপ্লেস" },
  company: { es: "Empresa", fr: "Entreprise", bn: "কোম্পানি" },
  legal: { es: "Legal", fr: "Mentions légales", bn: "আইনি" },
  exploreServices: { es: "Explorar servicios", fr: "Explorer les services", bn: "সার্ভিস দেখুন" },
  hireFreelancers: { es: "Contratar freelancers", fr: "Engager des freelances", bn: "ফ্রিল্যান্সার নিয়োগ" },
  browseCategories: { es: "Ver categorías", fr: "Parcourir les catégories", bn: "বিভাগগুলো দেখুন" },
  buyerRequests: { es: "Solicitudes de compradores", fr: "Demandes d'acheteurs", bn: "ক্রেতার অনুরোধ" },
  postRequest: { es: "Publicar una solicitud", fr: "Publier une demande", bn: "অনুরোধ পোস্ট করুন" },
  sellOnQwlee: { es: "Vender en Qwlee", fr: "Vendre sur Qwlee", bn: "Qwlee-তে বিক্রি করুন" },
  becomeSeller: { es: "Hazte vendedor", fr: "Devenir vendeur", bn: "বিক্রেতা হন" },
  aboutUs: { es: "Sobre nosotros", fr: "À propos", bn: "আমাদের সম্পর্কে" },
  helpCentre: { es: "Centro de ayuda", fr: "Centre d'aide", bn: "সহায়তা কেন্দ্র" },
  contactUs: { es: "Contacto", fr: "Nous contacter", bn: "যোগাযোগ" },
  blog: { es: "Blog", fr: "Blog", bn: "ব্লগ" },
  terms: { es: "Términos del servicio", fr: "Conditions d'utilisation", bn: "সেবার শর্তাবলি" },
  privacy: { es: "Política de privacidad", fr: "Politique de confidentialité", bn: "গোপনীয়তা নীতি" },
  trust: { es: "Confianza y seguridad", fr: "Confiance et sécurité", bn: "আস্থা ও নিরাপত্তা" },
  pitch: {
    es: "Qwlee es un mercado freelance moderno donde los compradores contratan expertos verificados en web, móvil, diseño, vídeo, IA y más, con pagos en depósito.",
    fr: "Qwlee est une place de marché freelance moderne où les acheteurs engagent des experts vérifiés en web, mobile, design, vidéo, IA et plus, avec paiements sous séquestre.",
    bn: "Qwlee একটি আধুনিক ফ্রিল্যান্স মার্কেটপ্লেস, যেখানে ক্রেতারা ওয়েব, মোবাইল, ডিজাইন, ভিডিও, এআই ও আরও অনেক কিছুর যাচাইকৃত বিশেষজ্ঞ নিয়োগ করেন, এসক্রো পেমেন্টসহ।",
  },
  yourEmail: { es: "Tu correo", fr: "Votre e-mail", bn: "আপনার ইমেইল" },
  subscribe: { es: "Suscribirse", fr: "S'abonner", bn: "সাবস্ক্রাইব" },
  subscribing: { es: "Suscribiendo…", fr: "Abonnement…", bn: "সাবস্ক্রাইব হচ্ছে…" },
  verifiedEscrow: { es: "Vendedores verificados · pagos en depósito", fr: "Vendeurs vérifiés · paiements sous séquestre", bn: "যাচাইকৃত বিক্রেতা · এসক্রো পেমেন্ট" },
  rights: { es: "Todos los derechos reservados.", fr: "Tous droits réservés.", bn: "সর্বস্বত্ব সংরক্ষিত।" },
  currency: { es: "Moneda", fr: "Devise", bn: "মুদ্রা" },
  language: { es: "Idioma", fr: "Langue", bn: "ভাষা" },
};

const EN = {
  categories: "Categories", findService: "Find a service…", explore: "Explore", signIn: "Sign in", join: "Join",
  signOut: "Sign out", startingAt: "Starting at", marketplace: "Marketplace", company: "Company", legal: "Legal",
  exploreServices: "Explore services", hireFreelancers: "Hire freelancers", browseCategories: "Browse categories",
  buyerRequests: "Buyer requests", postRequest: "Post a request", sellOnQwlee: "Sell on Qwlee", becomeSeller: "Become a seller",
  aboutUs: "About us", helpCentre: "Help centre", contactUs: "Contact us", blog: "Blog", terms: "Terms of service",
  privacy: "Privacy policy", trust: "Trust & safety",
  pitch: "Qwlee is a modern freelance marketplace where buyers hire vetted experts in web, mobile, design, video, AI, and more — with cloud-hosted media and escrowed payments.",
  yourEmail: "Your email", subscribe: "Subscribe", subscribing: "Subscribing…", verifiedEscrow: "Verified sellers · escrowed payments",
  rights: "All rights reserved.", currency: "Currency", language: "Language",
};

export function normaliseLang(v) {
  const s = String(v || "").toLowerCase().slice(0, 2);
  return LANGS[s] ? s : "en";
}

// Keys are either short ids from EN above, or the English phrase itself
// (see i18nPhrases.js), which falls back to the phrase.
export function translate(lang, key) {
  if (lang !== "en" && T[key]?.[lang]) return T[key][lang];
  if (EN[key]) return EN[key];
  return (lang !== "en" && PHRASES[key]?.[lang]) || key;
}

export const KEYS = Object.keys(EN);
export const TABLE = T;
