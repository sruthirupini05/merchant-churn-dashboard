# Antigravity Developer & Context Guide

This document provides complete instructions for coding AI agents (such as Antigravity or Claude) working on this project. It outlines the schema contracts, logic dependencies, and regression testing rules.

---

## 1. Schema Contracts

### A. Raw Merchant Shape
When adding or editing fixture merchants in `data.js`, you must adhere to this schema:
```typescript
interface Ticket {
  date: string;       // YYYY-MM-DD format (derived via daysAgo helper)
  resolved: boolean;  // Is the ticket resolved?
  escalated: boolean; // Did the ticket escalate to high-tier support?
  sentiment: number;  // Sentiment score between -1.0 (very negative) and 1.0 (very positive)
  csat: number | null;// Customer satisfaction score (1 to 5) or null if not responded
}

interface Merchant {
  merchant_id: string; // Unique identifier (e.g., M-001)
  name: string;        // Human-readable company name
  signup_date: string; // Sign-up date YYYY-MM-DD
  plan_tier: 'Basic' | 'Pro' | 'Plus';
  ticket_history: Ticket[];
  nps_score: number | null; // Latest Net Promoter Score (-100 to 100) or null
}
```

### B. Enriched Merchant Output Shape
The scoring engine in `engine.js` processes a `Merchant` and outputs this enriched shape:
```typescript
interface EnrichedMerchant extends Merchant {
  derived: {
    support_tickets_30d: number;
    support_tickets_90d_avg: number;       // Average tickets per month over 90 days
    avg_sentiment_score: number | null;    // Last 90 days average sentiment
    unresolved_ticket_count: number;
    escalation_count_90d: number;
    last_contact_date: string | null;
    days_since_last_contact: number | null;
    historical_avg_contact_gap: number | null;
    csat_last_5: number | null;            // Average CSAT of last 5 surveys
  };
  signals: {
    escalation: boolean;
    silent: boolean;
    csat: boolean;
    backlog: boolean;
    sentiment: boolean;
  };
  score: number; // Sum of active signal weights (max 100)
  tier: {
    min: number;
    label: 'High' | 'Medium' | 'Low';
    cls: string; // CSS class name (e.g., 'tier-high')
  };
  recommendedAction: {
    icon: string;
    label: string;
    text: string;
  } | null;
}
```

---

## 2. Key Developer Rules & Constraints

1. **Deterministic Auditing:** Never introduce random data generator functions (`Math.random`). All fixtures in `data.js` must remain hand-authored and deterministic so that the regression test suite `audit.js` runs successfully.
2. **Fixed Time Anchor:** For dates inside `data.js` and `audit.js`, you must anchor calculations to the static date `2026-07-16`. Using the live system clock will break the tests over time because days-ago intervals will shift.
3. **Escalation Spike Window:** Ensure the escalation window checks **90 days** (compared to prior 90-180 days). Do not shorten this to 30 days, or it will conflict with "Went Silent" detection and break the all-flags test case (M-012).
4. **No library dependency:** Do not install npm packages or add script CDN links. The app must run out-of-the-box by launching `index.html` locally.
