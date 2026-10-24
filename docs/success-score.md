# Success Score (1–10)

Private quality score for each seller and each gig, in the style of Fiverr's
Success Score. Only the seller and admins see it. Code: `backend/src/utils/successScore.js`.

## Inputs

Orders closed (completed or cancelled) in the last **window** days
(admin: Site settings → Success Score window, default 90).

| Signal | Meaning | Default weight |
|---|---|---|
| privateRating | average private rating buyers gave (1–5) | 30 |
| rating | average public review rating (1–5) | 20 |
| completion | completed ÷ (completed + cancelled) | 20 |
| onTime | completed orders whose last delivery was on or before the due date | 20 |
| noDisputes | 1 − orders with a dispute ÷ closed orders | 10 |

Ratings map 1→0 and 5→1. Every signal is a value from 0 to 1.

## Formula

```
score = round(1 + 9 × Σ(weight × signal) ÷ Σ(weight))
```

A signal with no data, such as no private ratings yet, is left out, and the other weights are rescaled.
Sellers or gigs with fewer than **minimum orders** closed in the window (default 5) have no score.

Weights, window and minimum orders are admin settings (Site settings).

## Where it is used

- Seller: the /seller-level page and dashboard show the seller score and how each signal is doing. Each gig's score appears on the seller's own gig page and in the My gigs table.
- Admin: the Seller levels list shows each seller's score.
- Levels: each tier has a "Success ≥" minimum (0–10). By default Level 1, Level 2 and Top Rated need 8.
  A seller with no score yet is not held back by this rule.
  Tiers already saved by an admin keep their saved minimum. Old percentage values above 10 are treated as 0.

Job Success (Upwork-style %, `utils/jobSuccess.js`) is a separate figure and is unchanged.
