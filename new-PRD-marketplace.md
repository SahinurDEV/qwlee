# Product Requirements Document
## Freelance Services Marketplace (Fiverr-Style Platform Clone)

**Version:** 1.0
**Document Type:** Full Product Requirements
**Audience:** Product Managers, Engineering Teams, Designers, QA
**Date:** May 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [Target Users & Personas](#3-target-users--personas)
4. [Market & Competitive Analysis](#4-market--competitive-analysis)
5. [Core Features & Functional Requirements](#5-core-features--functional-requirements)
6. [User Roles & Permissions](#6-user-roles--permissions)
7. [Detailed User Flows](#7-detailed-user-flows)
8. [Information Architecture & Database Schema](#8-information-architecture--database-schema)
9. [Technical Architecture](#9-technical-architecture)
10. [Technology Stack Recommendations](#10-technology-stack-recommendations)
11. [Third-Party Integrations](#11-third-party-integrations)
12. [Security & Compliance](#12-security--compliance)
13. [Admin Panel Requirements](#13-admin-panel-requirements)
14. [Mobile App Requirements](#14-mobile-app-requirements)
15. [Non-Functional Requirements](#15-non-functional-requirements)
16. [Monetization & Revenue Model](#16-monetization--revenue-model)
17. [Development Roadmap & MVP Scope](#17-development-roadmap--mvp-scope)
18. [KPIs & Success Metrics](#18-kpis--success-metrics)
19. [Risks & Mitigations](#19-risks--mitigations)
20. [Appendices](#20-appendices)

---

## 1. Executive Summary

This Product Requirements Document (PRD) defines a comprehensive specification for building a freelance services marketplace modeled after Fiverr. The platform connects buyers seeking digital services with sellers (freelancers) offering pre-packaged service listings called "Gigs." The marketplace handles user onboarding, gig discovery, secure ordering, escrow-based payments, communication, delivery, dispute resolution, reviews, and a tiered seller progression system.

The platform will launch as a web application with companion iOS and Android apps, supporting service categories including graphic design, digital marketing, writing, video editing, programming, music, business services, and AI services. The MVP targets a working two-sided marketplace within 6–8 months, with post-MVP expansion into enterprise features, subscriptions, and AI-powered matching.

### 1.1 Document Purpose

This PRD serves as the single source of truth for all product, design, and engineering teams. It defines the **what** (features), **why** (business rationale), and **how** (functional behavior), but intentionally avoids prescribing exact UI pixels — those belong in design specs.

### 1.2 Scope

- **In scope:** Web platform, mobile apps (iOS/Android), admin panel, payment processing, messaging, search, reviews, dispute system, seller leveling, multi-language and multi-currency support.
- **Out of scope (Phase 1):** Hourly contracts, project bidding (like Upwork), affiliate program, white-label B2B offerings, enterprise SSO, cryptocurrency payments.

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

> To become the most trusted global marketplace where anyone can buy or sell digital services starting at a low entry price, with transparent pricing, escrow protection, and a frictionless ordering experience.

### 2.2 Business Goals

1. Achieve **100,000 registered users** within 12 months of launch.
2. Process **10,000 completed orders per month** by month 12.
3. Achieve a **Gross Merchandise Value (GMV) of $2M** in Year 1.
4. Maintain a **take rate of 20%** on each transaction (industry standard).
5. Achieve an **average order rating of 4.7+ stars** across the platform.
6. Reach **gross-margin profitability by month 18**.

### 2.3 Product Principles

- **Trust first:** Every feature decision is evaluated against "does this build buyer-seller trust?"
- **Fixed-price simplicity:** Gigs have transparent, packaged pricing — no negotiation friction at discovery.
- **Mobile parity:** Every feature available on web must be available on mobile.
- **Seller success = platform success:** Tools that help sellers earn more are prioritized.
- **Internationalization by default:** Built for global use from day one, not retrofitted.

---

## 3. Target Users & Personas

### 3.1 Primary User Segments

The platform serves two primary user types in a two-sided marketplace, plus a third administrative role.

### Persona 1: The Buyer — "Sarah, Small Business Owner"

- **Age:** 28–45
- **Goals:** Quickly find affordable, high-quality services for her business (logo design, social media content, copywriting).
- **Pain points:** Doesn't have time to vet freelancers, worries about getting scammed, needs predictable delivery timelines.
- **Behavior:** Browses on mobile during commutes, places orders from laptop, expects responses within hours.

### Persona 2: The Seller — "Rakib, Freelance Designer"

- **Age:** 22–35
- **Goals:** Build a sustainable income from freelance work, grow client base, level up on platform.
- **Pain points:** Inconsistent income, low-paying clients, dispute fairness, withdrawal delays.
- **Behavior:** Active in messages 8–12 hours per day, frequently checks analytics, optimizes gig titles based on performance.

### Persona 3: The Admin — "Internal Operations Team"

- **Goals:** Maintain platform integrity, resolve disputes, prevent fraud, manage compliance.
- **Needs:** Powerful tooling for moderation, financial reconciliation, user management, and reporting.

---

## 4. Market & Competitive Analysis

### 4.1 Key Competitors

| Platform | Model | Strengths | Weaknesses |
|---|---|---|---|
| Fiverr | Fixed-price gigs | Strong brand, huge catalog, simple buyer flow | Race-to-bottom pricing, weak dispute resolution |
| Upwork | Hourly + fixed contracts | Enterprise clients, larger projects | Complex onboarding, high competition |
| Freelancer.com | Bidding-based | Large user base | Low-quality bids, spam |
| Toptal | Curated top talent | High quality, premium pricing | Hard to join, expensive for buyers |
| 99designs | Design-only contests | Niche focus, multiple options | Limited to design only |

### 4.2 Differentiation Opportunities

- AI-assisted gig matching that recommends sellers based on project description.
- Built-in collaboration tools (video calls, screen sharing) reducing need for external apps.
- Faster payout cycles than competitors (target: 7 days vs. Fiverr's 14).
- Lower take rate for top-tier sellers as a retention incentive.
- Strong vertical focus on emerging categories (AI services, no-code, vibe coding).

---

## 5. Core Features & Functional Requirements

### 5.1 Authentication & Onboarding

- **Registration:** Email/password, Google OAuth, Facebook OAuth, Apple Sign-In.
- **Email verification:** 6-digit OTP sent to email; account inactive until verified.
- **Phone verification:** Required before becoming a seller; SMS OTP.
- **Profile setup:** Avatar, full name, location, languages spoken, skills, bio (max 600 chars).
- **Role switching:** A single account can act as both buyer and seller via a UI toggle.
- **KYC for sellers:** Government ID upload required before first withdrawal.

### 5.2 Gig (Service Listing) Management

#### Gig Creation Flow (Seller)

1. **Overview:** Title (max 80 chars), category, subcategory, search tags (max 5), gig metadata (e.g., for graphic design: file format, style).
2. **Pricing:** Three packages — Basic, Standard, Premium. Each package has name, description, delivery days, revisions, price, and features (checklist of inclusions).
3. **Description:** Rich-text description (min 120 chars, max 1200 chars).
4. **Requirements:** Questions buyer must answer at order placement (text, multiple choice, file upload).
5. **Gallery:** 1–3 images (1280x769px), up to 2 videos (max 75 seconds, 50MB), up to 2 PDFs.
6. **FAQs:** Up to 10 questions and answers.
7. **Publish:** Submit for admin review; goes live once approved (target: <24h review).

#### Gig States

- **Draft:** Saved but not submitted.
- **Pending Review:** Submitted, awaiting admin approval.
- **Active:** Live and discoverable.
- **Paused:** Hidden by seller but not deleted.
- **Denied:** Rejected by admin with reason; editable for resubmission.
- **Removed:** Permanently taken down for policy violation.

### 5.3 Search & Discovery

- **Homepage:** Featured categories, trending gigs, personalized recommendations (based on browsing/order history), top-rated sellers.
- **Category pages:** Filtered grid view with sub-filters (delivery time, price range, seller level, language, location).
- **Search:** Full-text search with autocomplete, typo tolerance, synonym matching.
- **Sorting:** Relevance (default), Best Selling, Newest, Price (Low–High), Price (High–Low).
- **Filters:** Seller level, online status, seller language, delivery time, budget, pro verified.
- **Save gigs:** Buyers can favorite gigs to a personal list.

### 5.4 Ordering & Checkout

- **Package selection:** Buyer chooses Basic/Standard/Premium tier.
- **Add-ons (extras):** Faster delivery, extra revisions, additional services defined by seller.
- **Custom offer flow:** Seller can send a tailored offer through messages (custom price, scope, timeline).
- **Payment:** Card (Stripe), PayPal, Apple Pay, Google Pay, regional methods (e.g., bKash for Bangladesh).
- **Escrow hold:** Payment captured at checkout, held by platform until order completion or dispute resolution.
- **Order requirements:** Buyer answers seller-defined requirement questions before order timer starts.

### 5.5 Order Management & Delivery

#### Order Lifecycle States

- **Awaiting Requirements:** Order placed but buyer hasn't submitted required info.
- **In Progress:** Requirements submitted, delivery timer running.
- **Delivered:** Seller has uploaded deliverables; awaiting buyer acceptance.
- **Revision Requested:** Buyer requested changes (within allowed revisions).
- **Completed:** Buyer accepted or auto-completion after 3 days of no response.
- **Cancelled:** Mutually cancelled or admin-cancelled with refund.
- **Disputed:** Active dispute, payment frozen pending resolution.
- **Late:** Past delivery deadline (buyer can cancel for refund).

### 5.6 Messaging System

- **Real-time chat:** 1:1 messaging between buyer and seller using WebSocket connection.
- **Attachments:** Images, documents, videos (max 100MB per file).
- **Pre-order inquiries:** Buyers can message sellers before placing an order.
- **Voice messages:** Up to 5-minute audio clips.
- **Custom offers:** Sellers can send branded offer cards directly in chat.
- **Quick replies:** Saved canned responses for sellers.
- **Translation:** Auto-detect and offer in-chat translation for cross-language conversations.
- **Block & report:** Users can block others and report messages for moderation.

### 5.7 Reviews & Ratings

- **Trigger:** After order completion, both parties prompted to review within 10 days.
- **Rating dimensions (buyer reviews seller):** Communication, Service as described, Buy again or recommend (1–5 stars each).
- **Rating dimensions (seller reviews buyer):** Communication, As described, Buy again recommended.
- **Written review:** Optional, max 1500 characters.
- **Public display:** Both reviews visible on seller and gig profiles.
- **Response:** Seller can publicly reply to each review once.
- **Reporting:** Reviews can be reported for violation of guidelines (profanity, off-topic, fake).

### 5.8 Seller Leveling System

Tiered progression based on tenure, completed orders, earnings, ratings, and policy compliance.

| Level | Tenure | Orders | Earnings | Avg Rating |
|---|---|---|---|---|
| New Seller | 0+ days | 0 | $0 | N/A |
| Level 1 | 60+ days | 10+ | $400+ | 4.7+ |
| Level 2 | 120+ days | 50+ | $2,000+ | 4.7+ |
| Top Rated | 180+ days | 100+ | $20,000+ | 4.7+ (manual review) |
| Pro Verified | Manually curated | — | — | — |

Levels are recalculated on the 15th of each month. Demotions occur if metrics fall below thresholds for the prior 60 days. Higher levels unlock benefits: more active gigs, faster withdrawal, priority support, eligibility for promoted listings.

### 5.9 Withdrawal & Payouts

- **Clearance period:** Funds become available 7 days after order completion (14 days for new sellers).
- **Methods:** PayPal, bank transfer (via Payoneer/Wise), direct deposit (US), local methods per region.
- **Minimum withdrawal:** $10 for PayPal, $20 for bank transfer.
- **Processing time:** PayPal: same day. Bank: 2–5 business days.
- **Fees:** Platform absorbs PayPal fee; bank transfer charged at cost.

### 5.10 Dispute Resolution

- **Initiation:** Either party can open a dispute up to 14 days after delivery.
- **Reasons (buyer):** Not as described, low quality, late delivery, no delivery.
- **Reasons (seller):** Buyer unresponsive, scope creep, abusive behavior.
- **Resolution Center:** Structured back-and-forth with file attachments; 72-hour response windows.
- **Resolution options:** Full refund, partial refund, cancel with no refund, mutual cancellation.
- **Escalation:** If no resolution in 7 days, admin intervenes and issues binding decision within 5 business days.

---

## 6. User Roles & Permissions

| Action | Buyer | Seller | Admin |
|---|---|---|---|
| Browse and search gigs | Yes | Yes | Yes |
| Place an order | Yes | Yes (different account) | No |
| Create a gig | No | Yes | On behalf of seller |
| Send messages | Yes | Yes | All conversations |
| Withdraw funds | No | Yes | Manage withdrawals |
| Issue refunds | No | Partial only | Full authority |
| Ban users | No | No | Yes |
| Approve gigs | No | No | Yes |
| Edit any user profile | Own only | Own only | Yes |
| Access financial reports | Own only | Own only | Full access |

Admin role itself has sub-roles: **Super Admin** (all permissions), **Moderator** (content + dispute resolution), **Finance** (payouts + reports), **Support** (customer service + ticketing). Permissions are configurable through RBAC system.

---

## 7. Detailed User Flows

### 7.1 Buyer: First-Time Order Flow

1. Land on homepage → browse category or search query.
2. Click on a gig from search results → view gig detail page.
3. Review gallery, description, packages, FAQs, seller profile, reviews.
4. Optionally message seller for clarification.
5. Select package tier → choose add-ons (extras).
6. Click "Continue" → enter checkout.
7. Sign up or log in if not already authenticated.
8. Enter payment details → confirm order.
9. Submit order requirements (answers to seller's questions).
10. Order timer starts; system notifies seller.
11. Receive delivery → review and accept or request revision.
12. On acceptance, prompted to leave a review.

### 7.2 Seller: Gig Publishing Flow

1. Complete profile (avatar, bio, skills, languages).
2. Complete phone verification.
3. Navigate to "Create Gig" → step-by-step wizard (7 steps).
4. Fill out overview, pricing, description, requirements, gallery, FAQs.
5. Submit for review → admin reviews within 24 hours.
6. Receive approval/denial notification.
7. Active gig appears in search and category listings.

### 7.3 Dispute Flow

1. Order delivered → buyer unsatisfied → click "Resolution Center."
2. Choose reason → describe issue → upload evidence (screenshots, files).
3. Seller receives 72-hour notice → responds with proposed resolution.
4. Buyer accepts or counters. Up to 3 rounds.
5. If unresolved, escalate to admin → admin reviews evidence and issues binding decision.
6. Funds released according to decision (full refund, partial refund, release to seller).

---

## 8. Information Architecture & Database Schema

High-level entity relationships for the core domain model. Field-level details are illustrative; production schemas should be refined during technical design.

### 8.1 Core Entities

#### `users`
- `id` (UUID, PK)
- `email` (unique, indexed)
- `password_hash`
- `display_name`, `full_name`, `avatar_url`
- `country`, `languages` (array), `timezone`
- `phone`, `phone_verified_at`, `email_verified_at`
- `kyc_status` (none, pending, approved, rejected)
- `role` (buyer, seller, both, admin)
- `seller_level` (none, level_1, level_2, top_rated, pro)
- `balance_available`, `balance_pending`
- `created_at`, `updated_at`, `last_active_at`, `banned_at`

#### `gigs`
- `id` (UUID, PK)
- `seller_id` (FK → users)
- `title`, `slug`, `description`
- `category_id`, `subcategory_id`
- `status` (draft, pending, active, paused, denied, removed)
- `tags` (array), `metadata` (JSON)
- `impressions`, `clicks`, `orders_count`, `rating_avg`, `rating_count`
- `created_at`, `updated_at`, `published_at`

#### `gig_packages`
- `id`, `gig_id` (FK), `tier` (basic, standard, premium)
- `name`, `description`, `price`, `delivery_days`, `revisions`
- `features` (JSON array)

#### `gig_extras` (add-ons)
- `id`, `gig_id`, `name`, `description`, `price`, `extra_days`

#### `orders`
- `id` (UUID, PK), `order_number` (human-readable, e.g., FO-20260525-A8B2)
- `buyer_id`, `seller_id`, `gig_id`, `package_id`
- `status` (awaiting_requirements, in_progress, delivered, revision, completed, cancelled, disputed)
- `subtotal`, `service_fee`, `total_amount`, `currency`
- `delivery_due_at`, `started_at`, `delivered_at`, `completed_at`, `cancelled_at`
- `requirements_response` (JSON), `extras` (JSON array)
- `revisions_used`, `revisions_allowed`

#### `order_deliveries`
- `id`, `order_id`, `message`, `files` (JSON array of file refs), `delivered_at`

#### `conversations` & `messages`
- **conversations:** `id`, `user_a_id`, `user_b_id`, `last_message_at`, `last_message_preview`
- **messages:** `id`, `conversation_id`, `sender_id`, `content`, `attachments` (JSON), `is_read`, `sent_at`

#### `reviews`
- `id`, `order_id`, `reviewer_id`, `reviewee_id`
- `rating_overall`, `rating_communication`, `rating_service`, `rating_recommend`
- `comment`, `seller_response`, `created_at`

#### `disputes`
- `id`, `order_id`, `initiator_id`, `reason_code`, `description`
- `status` (open, awaiting_response, escalated, resolved)
- `resolution` (full_refund, partial_refund, release_to_seller, cancelled)
- `created_at`, `resolved_at`, `resolved_by_admin_id`

#### `transactions`
- `id`, `user_id`, `type` (charge, payout, refund, fee, adjustment)
- `amount`, `currency`, `balance_after`
- `reference` (order_id, withdrawal_id), `gateway`, `gateway_ref`, `status`
- `created_at`

#### `withdrawals`
- `id`, `user_id`, `amount`, `currency`, `method`, `destination_details` (encrypted JSON)
- `status` (requested, processing, paid, failed), `gateway_ref`, `requested_at`, `paid_at`

#### `categories`
- `id`, `parent_id` (for nesting), `name`, `slug`, `icon`, `order`

#### `notifications`
- `id`, `user_id`, `type`, `title`, `body`, `data` (JSON), `is_read`, `created_at`

---

## 9. Technical Architecture

### 9.1 High-Level Architecture

The platform follows a service-oriented architecture with a primary backend API consumed by web and mobile clients. Heavy or asynchronous work (image processing, email, analytics, search indexing) is offloaded to background workers via a message queue.

#### Components

- **Web client:** Server-rendered + SPA hybrid for SEO-critical pages (gig pages, category pages) and rich interactivity elsewhere.
- **Mobile clients:** Native iOS (Swift) and Android (Kotlin) or cross-platform (React Native/Flutter) consuming the same REST/GraphQL API.
- **API layer:** REST endpoints (versioned: `/api/v1`) for primary operations; GraphQL optionally for client flexibility.
- **Real-time service:** WebSocket gateway for messaging, presence indicators, live notifications.
- **Search service:** Elasticsearch or Algolia handling gig search, autocomplete, filters.
- **Media service:** Image/video processing pipeline (thumbnail generation, watermarking, transcoding); CDN-backed delivery.
- **Payment service:** Wrappers around Stripe, PayPal, and regional gateways; handles escrow logic, payouts, refunds.
- **Notification service:** Email (transactional + marketing), push (FCM/APNs), SMS (Twilio), in-app feed.
- **Admin panel:** Internal-only web app with elevated permissions.
- **Analytics pipeline:** Event tracking (Segment/RudderStack) → data warehouse (BigQuery/Snowflake) → BI tools (Metabase/Looker).

### 9.2 Data Storage

- **Primary database:** PostgreSQL — relational data (users, gigs, orders, transactions). Use read replicas for scaling reads.
- **Cache:** Redis — session storage, rate limiting, hot data cache (top sellers, featured gigs).
- **Search index:** Elasticsearch — denormalized gig documents updated via background jobs on gig changes.
- **Object storage:** AWS S3 or equivalent for gig gallery, deliverables, attachments, KYC documents.
- **CDN:** CloudFront/Cloudflare for serving images, videos, static assets globally.
- **Message queue:** RabbitMQ or AWS SQS for async jobs.

### 9.3 Scalability Considerations

- **Stateless API servers:** Horizontally scalable behind a load balancer.
- **Database partitioning:** Partition `orders` and `messages` tables by month for fast queries on recent data.
- **Caching strategy:** Cache-aside for read-heavy endpoints (gig pages, category listings); invalidate on writes.
- **Rate limiting:** Per-user and per-IP limits on all public endpoints; aggressive limits on auth endpoints.
- **CDN-first images:** All user-uploaded images served from CDN with edge caching.

---

## 10. Technology Stack Recommendations

Recommended stack. Final choices should consider team familiarity, hiring availability, and operational maturity.

| Layer | Recommendation | Rationale |
|---|---|---|
| Backend Framework | Node.js (NestJS) or Python (Django/FastAPI) | Strong ecosystem, high productivity, good async support |
| Frontend Web | Next.js (React) with TypeScript | SSR for SEO, fast page loads, mature ecosystem |
| Mobile | React Native or Flutter | Cross-platform reduces dev cost; native for premium UX |
| Database | PostgreSQL 15+ | Reliable, robust, JSON support, strong tooling |
| Cache | Redis | Industry standard for low-latency caching |
| Search | Elasticsearch or Algolia | Managed Algolia for fast time-to-market; ES for cost control at scale |
| Message Queue | RabbitMQ or AWS SQS | Reliable async job processing |
| Object Storage | AWS S3 | Mature, cheap, globally available |
| CDN | Cloudflare or CloudFront | Edge caching, DDoS protection |
| Payment | Stripe (primary) + PayPal | Best-in-class APIs, escrow-friendly via Stripe Connect |
| Email | SendGrid or AWS SES | Reliable transactional + marketing |
| Push | Firebase Cloud Messaging | Unified iOS/Android push delivery |
| SMS / OTP | Twilio | Global coverage, regulatory compliance |
| Monitoring | Datadog or New Relic | APM, logs, errors, alerting in one |
| Error tracking | Sentry | Frontend + backend error capture |
| Infrastructure | AWS or GCP, Kubernetes (EKS/GKE) | Standard cloud, container orchestration for scale |
| CI/CD | GitHub Actions or GitLab CI | Native to source control, fast pipelines |

---

## 11. Third-Party Integrations

- **Stripe Connect:** Marketplace payment splits, escrow holds, payouts to seller bank accounts.
- **PayPal:** Alternative payment method for buyers; payout method for sellers.
- **Payoneer / Wise:** International seller payouts, especially for emerging markets.
- **Twilio:** SMS verification, OTP, optional voice calls between users.
- **SendGrid:** Transactional emails (order updates, password reset, etc.) and marketing emails.
- **Firebase Cloud Messaging:** Push notifications for mobile.
- **Google Maps / Mapbox:** Optional location selection on seller profile.
- **Google Translate API:** In-chat translation.
- **Sumsub or Onfido:** KYC identity verification.
- **ClamAV or VirusTotal:** Malware scanning on uploaded deliverables.
- **Cloudflare Stream or Mux:** Video transcoding for gig promo videos.
- **Segment/RudderStack:** Event tracking aggregator.
- **Intercom or Zendesk:** Customer support ticketing and chat.
- **Algolia:** (Optional managed alternative to self-hosted Elasticsearch).

---

## 12. Security & Compliance

### 12.1 Authentication & Account Security

- Passwords stored using bcrypt or argon2 with appropriate work factor.
- JWT-based session tokens with short expiration (15 min) and refresh tokens (30 days).
- Two-factor authentication (TOTP via authenticator app) optional for all users, required for sellers above Level 1.
- Brute-force protection: progressive delays after failed logins; CAPTCHA after 3 failures.
- Account recovery requires email verification plus security questions if 2FA is unavailable.
- Suspicious activity detection: alerts on login from new device, location, or unusual time.

### 12.2 Data Protection

- All traffic over HTTPS/TLS 1.3.
- PII encrypted at rest using AES-256.
- KYC documents stored in a separate, restricted-access S3 bucket with KMS-managed encryption keys.
- Payment card data never touches platform servers — tokenized via Stripe Elements / PayPal SDK.
- Database backups encrypted, retained 30 days, restoration tested quarterly.

### 12.3 Compliance

- **GDPR (EU):** Right to access, rectify, delete personal data; explicit consent for marketing; data processing agreements with vendors.
- **CCPA (California):** Do-not-sell option; access and deletion requests.
- **PCI DSS:** Compliance achieved via Stripe — platform stays out of scope by tokenizing payments.
- **Tax compliance:** Collect tax forms (W-9 for US sellers, W-8BEN for foreign sellers); issue 1099-K where required; VAT/GST collection on EU/UK transactions.
- **Age requirement:** Users must be 18+ (13+ with parental consent in some regions).
- **Sanctions screening:** Block account creation from OFAC-sanctioned countries; periodic re-screening.

### 12.4 Abuse Prevention

- Spam detection on messages and reviews using heuristics and ML classifiers.
- Off-platform-payment detection: NLP scan of messages for payment-routing keywords ("PayPal me direct," external email addresses); warning prompts and admin flagging.
- Fraud detection on orders: velocity checks, mismatched billing/shipping geos, disposable email domains.
- Image moderation: automated detection of NSFW, violence, copyrighted content (using AWS Rekognition or equivalent).
- Bot mitigation: Cloudflare Bot Management, hCaptcha on signup.

---

## 13. Admin Panel Requirements

Internal-only web application providing operational tooling for platform administrators.

### 13.1 Modules

#### Dashboard
- Real-time metrics: active users, orders today, GMV today, pending disputes, gig approval queue.
- Trend charts: GMV (7/30/90 days), new signups, completion rate, average rating.
- System health: API uptime, error rate, queue depth.

#### User Management
- Search/filter users by email, ID, status, level, country.
- View full profile, order history, transaction history, reviews.
- Actions: suspend account, ban account, reset password, force email verification, adjust balance.
- Audit log of all admin actions per user.

#### Gig Moderation
- Approval queue: list of gigs pending review with side-by-side preview.
- Quick approve/deny with templated reason codes.
- Bulk actions for clear violations.
- Flagged gigs (user reports) with context.

#### Order & Dispute Management
- Search orders by ID, buyer, seller, status.
- Dispute queue with SLA timers.
- Full evidence view: messages, files, order history.
- Resolution actions: full refund, partial refund, release to seller, cancel order.

#### Financial Operations
- Withdrawal queue: pending, processing, completed.
- Manual approval for high-value or flagged withdrawals.
- Reconciliation reports: platform revenue, fees collected, pending payouts, refunds.
- Tax reporting exports.

#### Content Management
- Category and subcategory CRUD.
- Homepage banner and featured content scheduling.
- Static pages (Terms, Privacy, FAQ) editor.
- Email template editor.

#### Reports & Analytics
- Cohort analysis (signup → first order, retention).
- Top categories, top sellers, top buyers.
- Conversion funnels (search → click → order).
- Geographic breakdowns.
- Export to CSV.

#### Support Tooling
- Ticket inbox integrated with Zendesk/Intercom.
- Quick lookup of any user or order from within ticket.
- Internal notes on user profiles.

### 13.2 Admin Access Controls

- SSO required for all admin accounts (Google Workspace or Okta).
- All admin actions logged with timestamp, admin ID, target entity, before/after values.
- Role-based access: Super Admin, Moderator, Finance, Support.
- Quarterly access review.

---

## 14. Mobile App Requirements

### 14.1 Feature Parity

Mobile apps must support 100% of buyer workflows and ~90% of seller workflows. Gig creation may be web-first due to media upload complexity, but seller order management, messaging, delivery, and payouts must be fully functional on mobile.

### 14.2 Platform-Specific Capabilities

- **Push notifications:** New message, new order, delivery received, dispute update, payout received.
- **Biometric auth:** Face ID / Touch ID / fingerprint for app unlock and order confirmation.
- **Camera integration:** Direct capture for gig photos, deliverables, KYC ID.
- **Deep linking:** Open specific gigs, orders, or messages from notifications, emails, shared links.
- **Offline support:** View previously loaded orders, messages, drafts; queue actions for sync when online.
- **App-store payment compliance:** Use of in-app purchase rules where required (Apple in particular); web checkout fallback for transactions where IAP is impractical.

### 14.3 Performance Targets

- Cold launch under 2 seconds on mid-range device.
- Average screen transition under 300ms.
- App size under 50MB at install.

---

## 15. Non-Functional Requirements

### 15.1 Performance

- Homepage Time to Interactive (TTI): under 2.5 seconds on 4G.
- Gig page Largest Contentful Paint (LCP): under 2 seconds.
- Search query response: under 300ms (P95).
- Checkout completion: under 5 seconds end-to-end.

### 15.2 Availability

- Target uptime: 99.95% (≈4.4 hours downtime per year).
- Critical path services (auth, checkout, messaging) must have automatic failover.
- Multi-region deployment for disaster recovery.
- RTO (Recovery Time Objective): 1 hour; RPO (Recovery Point Objective): 5 minutes.

### 15.3 Scalability

- Architecture designed to handle 10M MAU and 1M concurrent users at peak (Phase 3 horizon).
- Horizontal scaling without code changes.
- Background job throughput: 10,000 jobs/minute sustained.

### 15.4 Accessibility

- WCAG 2.1 Level AA compliance on web.
- Mobile apps follow platform accessibility guidelines (iOS VoiceOver, Android TalkBack).
- All interactive elements keyboard-navigable; visible focus states.
- Color contrast minimum 4.5:1 for text.

### 15.5 Internationalization

- Support for at least 10 launch languages: English, Spanish, Portuguese, French, German, Italian, Russian, Arabic, Hindi, Bengali.
- RTL (right-to-left) layout support for Arabic, Hebrew.
- Multi-currency display with real-time exchange rates; checkout currency locked at order time.
- Locale-aware date, number, and currency formatting.

### 15.6 Observability

- Distributed tracing across all services.
- Structured logging with correlation IDs.
- Real-time alerting on P0/P1 incidents.
- Business metrics dashboards available to product team.

---

## 16. Monetization & Revenue Model

### 16.1 Primary Revenue Streams

- **Buyer service fee:** $2 flat fee on orders up to $40; 5% on orders above $40.
- **Seller commission:** 20% deduction from each completed order.
- **Promoted gigs:** Pay-per-click advertising for sellers wanting boosted placement.
- **Subscription tier (post-MVP):** "Pro Seller" plan at $19/mo with lower commission (15%), advanced analytics, priority support.
- **Withdrawal fees:** Pass-through on bank transfers; absorbed on PayPal up to a threshold.

### 16.2 Sample Order Economics

| Item | Amount | Notes |
|---|---|---|
| Gig package price | $100.00 | Seller-set |
| Buyer service fee | $5.00 | 5% on >$40 |
| **Buyer pays** | **$105.00** | Total charge |
| Platform commission (20%) | -$20.00 | From seller side |
| **Seller earns** | **$80.00** | After commission |
| **Platform revenue** | **$25.00** | Buyer fee + commission |

---

## 17. Development Roadmap & MVP Scope

### 17.1 Phase 1 — MVP (Months 1–6)

**Goal:** Launch a working two-sided marketplace with the absolute minimum to validate the model.

- Authentication (email + Google OAuth)
- Buyer/seller profiles, role switching
- Gig creation (single package only initially), gallery (images only), admin approval
- Browse, search (basic full-text), filter
- Order placement and payment (Stripe only)
- Order lifecycle, delivery, revision, completion
- In-app messaging (text + image attachments)
- Reviews and ratings
- Withdrawals (PayPal + bank transfer)
- Email notifications
- Basic admin panel
- Web app only (no mobile)

### 17.2 Phase 2 — Growth (Months 7–12)

- Three-tier gig packages (Basic/Standard/Premium)
- Add-ons / gig extras
- Custom offers in chat
- Seller leveling system
- Dispute resolution center
- Video upload in gigs and messages
- Mobile apps (iOS + Android)
- Push notifications
- Multi-language support (5 languages)
- Multi-currency
- PayPal payment option
- Promoted gigs (basic)

### 17.3 Phase 3 — Scale (Months 13–24)

- AI-powered gig recommendations
- AI-assisted matching (project description → recommended sellers)
- Pro Seller subscription
- Affiliate program
- API for partner integrations
- Enterprise buyer accounts (multi-user, team billing)
- Advanced seller analytics
- Voice/video calling in messaging
- Regional payment methods (bKash, MercadoPago, etc.)
- Additional languages (target: 10+)

---

## 18. KPIs & Success Metrics

### 18.1 North Star Metric

**Gross Merchandise Value (GMV)** — total dollar value of completed orders. This single metric reflects the health of both sides of the marketplace.

### 18.2 Supporting Metrics

| Category | Metric | Year 1 Target |
|---|---|---|
| Growth | Total registered users | 100,000 |
| Growth | Monthly Active Users (MAU) | 30,000 |
| Growth | Active sellers (with at least 1 order) | 5,000 |
| Activity | Orders per month | 10,000 |
| Activity | Average order value | $45 |
| Activity | Repeat buyer rate | 25% |
| Quality | Order completion rate | >85% |
| Quality | Average rating | 4.7+ |
| Quality | Dispute rate | <3% |
| Quality | Average response time (sellers) | <2 hours |
| Financial | GMV | $2M |
| Financial | Take rate | 20% |
| Financial | Customer Acquisition Cost (CAC) | <$15 |

---

## 19. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Chicken-and-egg: no sellers means no buyers and vice versa | High at launch | Seed initial supply by recruiting sellers manually; offer launch incentives (zero commission for first 3 months); target a single vertical to concentrate liquidity |
| Off-platform payment leakage | High | Detection systems on messages; education on buyer protection; competitive escrow making on-platform safer |
| Payment fraud (stolen cards, chargebacks) | Medium | Stripe Radar; velocity checks; manual review for high-value first orders; chargeback insurance via gateway |
| Low-quality sellers driving away buyers | High | Strict gig approval; quick demotion of low-rated sellers; "Top Rated" badges to surface trusted sellers |
| Disputes overwhelming admin team | Medium | Tiered resolution flow with mutual resolution first; clear policies; AI-assisted dispute triage in Phase 2 |
| Regulatory changes (tax, employment classification) | Medium | Legal counsel review quarterly; sellers classified as independent contractors; tax forms automated |
| Currency/exchange-rate exposure | Medium | Lock exchange rate at order time; settle in seller's currency; hedge if exposure becomes material |
| Platform downtime during peak hours | Low | Multi-region failover; load testing pre-launch; incident response runbooks |
| Negative reviews of platform on social media | Medium | Responsive support; transparent dispute outcomes; community management team |

---

## 20. Appendices

### 20.1 Glossary

- **Gig:** A pre-packaged service listing created by a seller.
- **GMV:** Gross Merchandise Value — total transaction value before fees.
- **Take rate:** Percentage of GMV captured as platform revenue.
- **Escrow:** Holding of funds by a third party (platform) pending fulfillment.
- **KYC:** Know Your Customer — identity verification process.
- **Buyer:** User purchasing a service.
- **Seller:** User offering a service.
- **Package:** One of three pricing tiers (Basic/Standard/Premium) within a gig.
- **Extra (Add-on):** Optional paid upgrade to an order (faster delivery, more revisions, etc.).
- **Custom offer:** Tailored proposal sent from seller to buyer via chat.

### 20.2 Out-of-Scope Items

Explicitly not part of this PRD, but candidates for future phases:

- Hourly contract billing (Upwork-style).
- Bidding/proposal-based jobs.
- Team accounts with shared billing.
- White-label B2B platform offerings.
- Built-in design contests (99designs-style).
- Cryptocurrency payment options.

### 20.3 Open Questions

- Will the platform launch globally or focus on a single region first?
- Will Pro Verified onboarding be manual or self-serve with verification?
- What is the policy on AI-generated deliverables (acceptable, disclosed, prohibited)?
- What is the appeals process for banned accounts?
- Will revenue share differ by category (e.g., lower for high-volume categories)?

### 20.4 Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | May 2026 | Product Team | Initial PRD |

---

*— End of Document —*
