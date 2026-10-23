// Clean admin-authored rich text (blog posts, legal pages) on every write.
// The site renders these with dangerouslySetInnerHTML, so a stored
// <script> or onerror= would run for every visitor.
const sanitizeHtml = require("../../utils/sanitizeHtml");

module.exports = (schema, { fields = ["content"] } = {}) => {
  schema.pre("save", function (next) {
    for (const f of fields) if (typeof this[f] === "string" && this.isModified(f)) this[f] = sanitizeHtml(this[f]);
    next();
  });
  const onUpdate = function (next) {
    const u = this.getUpdate() || {};
    for (const target of [u, u.$set || {}]) {
      for (const f of fields) if (typeof target[f] === "string") target[f] = sanitizeHtml(target[f]);
    }
    next();
  };
  for (const op of ["findOneAndUpdate", "updateOne", "updateMany"]) schema.pre(op, onUpdate);
};
