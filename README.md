# Merchant Churn Risk Dashboard

A CX-focused merchant churn risk dashboard built for a payments/e-commerce platform (Shopify/Stripe-style).

## Live Demo

🚀 **[View Live Dashboard →](https://YOUR-USERNAME.github.io/merchant-churn-dashboard/)**

## Overview

Tracks 5 churn signals across 18 hand-authored fixture merchants, computes a weighted composite risk score, and surfaces a priority-ranked recommended next step for each merchant.

### Churn Signals Tracked

| Priority | Signal | Weight | Description |
|---|---|---|---|
| 1 | 🚨 Escalation Spike | +30 | Jump in escalated tickets vs. 90-day baseline |
| 2 | 🔇 Went Silent | +25 | Last contact gap > 2× historical average gap |
| 3 | 😞 Low CSAT/NPS | +20 | CSAT avg < 3.0 or NPS < 0 |
| 4 | 📋 Unresolved Backlog | +15 | 3+ open tickets accumulating |
| 5 | 📉 Sentiment Decline | +10 | Avg sentiment < −0.2 |

### Risk Tiers

- 🔴 **High** — Score ≥ 50
- 🟡 **Medium** — Score 25–49
- 🟢 **Low** — Score < 25

## Features

- **18 hand-authored fixture merchants** covering all edge cases from the spec
- **Composite risk scoring engine** with derived field computation
- **Priority-based action recommendations** (score tells you urgency; top flag tells you what to do)
- **Filter by tier**, search by name/ID, sort by score/tier/name
- **Detail drawer** — full metric breakdown, signal flags, ticket history per merchant
- **Audit script** (`node audit.js`) — verifies all 18 merchants score exactly as intended

## Files

```
index.html   — Dashboard shell
style.css    — Dark glassmorphism UI
data.js      — 18 fixture merchants
engine.js    — Scoring engine (derived fields + signal detectors)
app.js       — UI controller (render, filter, sort, drawer)
audit.js     — node audit.js → 18/18 scoring tests
```

## Running Locally

Just open `index.html` in any browser — no build step, no dependencies.

## Running the Audit

```bash
node audit.js
```

Expected output: `18 PASSED | 0 FAILED | 18 TOTAL`

## Deployment

Deployed via GitHub Pages from the `main` branch root.

## Spec Notes

- **Escalation spike** uses a 90d vs prior 90–180d window (not 30d), enabling the "went silent + escalation spike" coexistence pattern required for the all-flags edge case (M-012).
- **"Went silent"** requires ≥2 tickets to derive a meaningful gap baseline — new merchants with a single ticket are not penalised.
- Composite score drives tier/urgency sorting; the highest-priority active signal drives the recommended action (per spec: "a blended score can't tell you *what to do*").
