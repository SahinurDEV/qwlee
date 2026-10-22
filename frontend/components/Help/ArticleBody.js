// Renders help text: blank lines split paragraphs, "- " lines are bullets.
// Plain text only (no HTML), so admin content can't inject markup.
export default function ArticleBody({ text = "" }) {
  const blocks = String(text).replace(/\r/g, "").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-4 text-gray-700 leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {lines.map((l, j) => <li key={j}>{l.replace(/^\s*[-*•]\s+/, "")}</li>)}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-line">{b}</p>;
      })}
    </div>
  );
}
