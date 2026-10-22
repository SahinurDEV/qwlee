// Rich-text descriptions are rendered as HTML in the marketplace, so
// strip scripts, event handlers and unsafe URLs before storing them.
const sanitize = require("sanitize-html");

const OPTIONS = {
  allowedTags: [
    "p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "code", "pre",
    "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "a", "span", "div",
    "hr", "img", "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["style"],
  },
  allowedStyles: {
    "*": {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(/i],
      "text-align": [/^(left|right|center|justify)$/],
      "font-weight": [/^\d+$|^bold$/],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitize.simpleTransform("a", { rel: "noopener noreferrer nofollow" }),
  },
};

module.exports = (html) => sanitize(String(html || ""), OPTIONS);
