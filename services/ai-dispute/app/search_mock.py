"""Deterministic NL → filter parse for gig search."""
import re
from .schemas import SearchParse

CAT_MAP = [
    (("logo", "brand", "flyer", "poster", "graphic"), "Graphic Design"),
    (("ui", "ux", "figma", "wireframe"), "UI/UX Design"),
    (("web", "website", "wordpress", "landing"), "Web Development"),
    (("mobile", "ios", "android", "app"), "Mobile Development"),
    (("video", "edit", "youtube"), "Video Editing"),
    (("seo", "ads", "marketing"), "Digital Marketing"),
    (("write", "copy", "translate"), "Writing & Translation"),
    (("ai", "chatgpt", "llm", "prompt"), "AI Services"),
]


def parse_search(query: str, categories: list[str] | None = None) -> SearchParse:
    q = (query or "").strip()
    ql = q.lower()
    cats = categories or []
    category = ""
    for keys, name in CAT_MAP:
        if any(k in ql for k in keys):
            # prefer exact catalogue name if provided
            category = next((c for c in cats if c.lower() == name.lower()), name)
            break
    prices = [float(x) for x in re.findall(r"(?:under|below|less than|<|\$)\s*\$?(\d+(?:\.\d+)?)", ql)]
    if not prices:
        prices = [float(x) for x in re.findall(r"\$(\d+(?:\.\d+)?)", ql)]
    max_price = min(prices) if prices else None
    # keywords: drop stopwords and price phrases
    stop = {"for", "my", "a", "an", "the", "under", "below", "less", "than", "with", "and", "or", "me", "i", "need", "want"}
    words = re.findall(r"[a-z0-9]+", ql)
    keywords = " ".join(w for w in words if w not in stop and not w.isdigit())
    bits = []
    if category:
        bits.append(f"category {category}")
    if max_price is not None:
        bits.append(f"max price ${max_price:g}")
    if keywords:
        bits.append(f"keywords “{keywords}”")
    return SearchParse(
        keywords=keywords or q,
        categoryHint=category,
        maxPrice=max_price,
        minPrice=None,
        sortBy="price" if max_price is not None else "",
        explanation=("AI understood: " + ", ".join(bits)) if bits else "Using your words as a title search.",
    )
