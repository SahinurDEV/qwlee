"use client";
import PolicyPage, { RELATED } from "./PolicyPage";

export default function CookiePolicy() {
  return (
    <PolicyPage
      title="Cookie Policy"
      updated="27 October 2026"
      intro="This page explains how Qwlee uses cookies and similar technologies, and how you can change your choice. It sits alongside our Privacy Policy."
      related={RELATED.filter((r) => r.href !== "/cookie-policy")}
      sections={[
        {
          heading: "What are cookies?",
          body: [
            "Cookies are small text files stored on your device. We also use similar storage such as localStorage for preferences like language, theme and cookie consent.",
          ],
        },
        {
          heading: "Essential cookies",
          body: [
            "Required for the marketplace to work: signing you in (access and refresh tokens), security, language (qwlee_lang), theme (qwlee_theme), and remembering your cookie choice (qwlee_cookie_consent). These run whether or not you accept optional cookies.",
          ],
        },
        {
          heading: "Optional cookies",
          body: [
            "If you choose Accept all, we may use analytics or product-improvement tags to understand how the site is used (for example aggregated page views). We do not use optional cookies for advertising partners unless we add them later and update this page.",
            "Choosing Essential only keeps optional cookies off. You can change your mind by clearing site data for this domain or deleting the qwlee_cookie_consent cookie; the banner will appear again.",
          ],
        },
        {
          heading: "How long they last",
          body: [
            "Session cookies expire when you close the browser. Preference and consent cookies may last up to about one year. Auth cookies follow the “keep me signed in” choice (session or up to 30 days).",
          ],
        },
        {
          heading: "More information",
          body: [
            "For what personal data we process beyond cookies, see the Privacy Policy. Questions: privacy@qwlee.com.",
          ],
        },
      ]}
    />
  );
}
