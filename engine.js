/**
 * engine.js — Churn Scoring Engine
 *
 * Implements:
 *  - All derived field computations from ticket_history
 *  - 5 churn signal detectors (with thresholds matching the spec)
 *  - Composite score + tier assignment
 *  - Priority-based recommended next step
 */

// ============================================================
// CONSTANTS (per spec)
// ============================================================
const WEIGHTS = {
  escalation: 30,
  silent:     25,
  csat:       20,
  backlog:    15,
  sentiment:  10,
};

const TIERS = {
  HIGH:   { min: 50, label: "High",   cls: "tier-high"   },
  MEDIUM: { min: 25, label: "Medium", cls: "tier-medium"  },
  LOW:    { min:  0, label: "Low",    cls: "tier-low"     },
};

const ACTIONS = {
  escalation: {
    icon: "🚨",
    label: "Immediate CSM Call",
    text: "Immediate CSM call — repeated escalations indicate acute dissatisfaction",
  },
  silent: {
    icon: "🔇",
    label: "Proactive Outreach",
    text: "Proactive outreach — merchant has gone quiet, check in before they decide silently",
  },
  csat: {
    icon: "😞",
    label: "Satisfaction Follow-Up",
    text: "Send satisfaction follow-up + offer premium support review",
  },
  backlog: {
    icon: "📋",
    label: "Escalate to Support Lead",
    text: "Escalate to support lead to clear unresolved ticket backlog",
  },
  sentiment: {
    icon: "📉",
    label: "CSM Relationship Check-In",
    text: "Flag to CSM for relationship check-in — sentiment is trending negative",
  },
};

// Priority order (index 0 = highest priority)
const SIGNAL_PRIORITY = ["escalation", "silent", "csat", "backlog", "sentiment"];

// ============================================================
// DERIVED FIELD COMPUTATIONS
// ============================================================

/**
 * Compute the average gap (in days) between consecutive tickets.
 * Returns null if < 2 tickets (can't compute a gap).
 */
function computeAvgContactGap(tickets) {
  if (!tickets || tickets.length < 2) return null;

  // Sort ascending by date
  const sorted = [...tickets].sort((a, b) => new Date(a.date) - new Date(b.date));

  let totalGap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    totalGap += (curr - prev) / (1000 * 60 * 60 * 24); // ms → days
  }

  return totalGap / (sorted.length - 1);
}

/**
 * Days since the merchant's most recent ticket.
 * Returns null if no tickets.
 */
function computeDaysSinceLastContact(tickets) {
  if (!tickets || tickets.length === 0) return null;
  const lastDate = tickets.reduce((latest, t) =>
    new Date(t.date) > latest ? new Date(t.date) : latest,
    new Date(0)
  );
  return Math.round((TODAY - lastDate) / (1000 * 60 * 60 * 24));
}

/**
 * Count tickets in the last N days.
 */
function countTicketsInDays(tickets, days) {
  const cutoff = new Date(TODAY);
  cutoff.setDate(cutoff.getDate() - days);
  return tickets.filter(t => new Date(t.date) >= cutoff).length;
}

/**
 * Average sentiment of the most recent N tickets (default: all recent 30d).
 * Returns null if no tickets.
 */
function computeAvgSentimentRecent(tickets, days = 90) {
  const cutoff = new Date(TODAY);
  cutoff.setDate(cutoff.getDate() - days);
  const recent = tickets.filter(t => new Date(t.date) >= cutoff);
  if (recent.length === 0) return null;
  return recent.reduce((sum, t) => sum + t.sentiment, 0) / recent.length;
}

/**
 * Average CSAT of last 5 tickets that have a CSAT score.
 * Returns null if none.
 */
function computeCsatLast5(tickets) {
  const withCsat = [...tickets]
    .filter(t => t.csat !== null && t.csat !== undefined)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  if (withCsat.length === 0) return null;
  return withCsat.reduce((sum, t) => sum + t.csat, 0) / withCsat.length;
}

/**
 * Count unresolved tickets.
 */
function countUnresolved(tickets) {
  return tickets.filter(t => !t.resolved).length;
}

/**
 * Count escalated tickets in last N days.
 */
function countEscalationsInDays(tickets, days) {
  const cutoff = new Date(TODAY);
  cutoff.setDate(cutoff.getDate() - days);
  return tickets.filter(t => new Date(t.date) >= cutoff && t.escalated).length;
}

// ============================================================
// SIGNAL DETECTORS
// ============================================================

/**
 * Escalation Spike:
 * Escalations in the last 90d > escalations in the prior 90–180d window.
 * Requires at least 3 recent escalations to avoid noise on low-volume merchants.
 * Using 90d window (vs 30d) gives meaningful signal even for less-frequent merchants
 * and allows "went silent + escalation" to coexist (escalations can be 30-89d old).
 */
function detectEscalationSpike(tickets) {
  const cut90  = new Date(TODAY); cut90.setDate(cut90.getDate() - 90);
  const cut180 = new Date(TODAY); cut180.setDate(cut180.getDate() - 180);

  const recent90 = tickets.filter(t => new Date(t.date) >= cut90 && t.escalated).length;
  const prior90to180 = tickets.filter(t => {
    const d = new Date(t.date);
    return d < cut90 && d >= cut180 && t.escalated;
  }).length;

  // Spike = recent escalations strictly greater than prior AND at least 3 recent
  return recent90 >= 3 && recent90 > prior90to180;
}

/**
 * Went Silent:
 * Days since last contact > 2 × historical avg contact gap.
 * Requires ≥ 2 tickets to derive a meaningful gap.
 */
function detectWentSilent(tickets) {
  const avgGap = computeAvgContactGap(tickets);
  if (avgGap === null) return false; // Only 1 ticket — can't determine baseline

  const daysSinceLast = computeDaysSinceLastContact(tickets);
  if (daysSinceLast === null) return false;

  return daysSinceLast > 2 * avgGap;
}

/**
 * Low CSAT / NPS:
 * csat_last_5 avg < 3.0   OR   nps_score < 0
 */
function detectLowCsatNps(csatLast5, npsScore) {
  const csatLow = csatLast5 !== null && csatLast5 < 3.0;
  const npsLow  = npsScore  !== null && npsScore  < 0;
  return csatLow || npsLow;
}

/**
 * Unresolved Backlog:
 * 3 or more unresolved tickets.
 */
function detectUnresolvedBacklog(tickets) {
  return countUnresolved(tickets) >= 3;
}

/**
 * Sentiment Decline:
 * Avg sentiment of recent (90d) tickets < −0.2
 */
function detectSentimentDecline(avgSentiment) {
  return avgSentiment !== null && avgSentiment < -0.2;
}

// ============================================================
// COMPOSITE SCORE + TIER
// ============================================================

function computeTier(score) {
  if (score >= 50) return TIERS.HIGH;
  if (score >= 25) return TIERS.MEDIUM;
  return TIERS.LOW;
}

// ============================================================
// RECOMMENDED ACTION (priority-based)
// ============================================================

function computeRecommendedAction(signals) {
  for (const key of SIGNAL_PRIORITY) {
    if (signals[key]) return ACTIONS[key];
  }
  return null; // No flags → no action needed
}

// ============================================================
// MAIN SCORE FUNCTION
// ============================================================

/**
 * Takes a raw merchant record, computes all derived fields and signals,
 * returns an enriched merchant object ready for rendering.
 */
function scoreMerchant(merchant) {
  const th = merchant.ticket_history || [];

  // ── Derived fields ──
  const support_tickets_30d       = countTicketsInDays(th, 30);
  const support_tickets_90d_avg   = countTicketsInDays(th, 90) / 3; // 90d avg per month
  const avg_sentiment_score       = computeAvgSentimentRecent(th, 90);
  const unresolved_ticket_count   = countUnresolved(th);
  const escalation_count_90d      = countEscalationsInDays(th, 90);
  const last_contact_date         = (() => {
    if (th.length === 0) return null;
    return [...th].sort((a, b) => new Date(b.date) - new Date(a.date))[0].date;
  })();
  const days_since_last_contact   = computeDaysSinceLastContact(th);
  const historical_avg_contact_gap = computeAvgContactGap(th);
  const csat_last_5               = computeCsatLast5(th);

  // ── Signal detection ──
  const signals = {
    escalation: detectEscalationSpike(th),
    silent:     detectWentSilent(th),
    csat:       detectLowCsatNps(csat_last_5, merchant.nps_score),
    backlog:    detectUnresolvedBacklog(th),
    sentiment:  detectSentimentDecline(avg_sentiment_score),
  };

  // ── Composite score ──
  let score = 0;
  if (signals.escalation) score += WEIGHTS.escalation;
  if (signals.silent)     score += WEIGHTS.silent;
  if (signals.csat)       score += WEIGHTS.csat;
  if (signals.backlog)    score += WEIGHTS.backlog;
  if (signals.sentiment)  score += WEIGHTS.sentiment;

  const tier            = computeTier(score);
  const recommendedAction = computeRecommendedAction(signals);

  return {
    ...merchant,
    derived: {
      support_tickets_30d,
      support_tickets_90d_avg: Math.round(support_tickets_90d_avg * 10) / 10,
      avg_sentiment_score:     avg_sentiment_score !== null ? Math.round(avg_sentiment_score * 100) / 100 : null,
      unresolved_ticket_count,
      escalation_count_90d,
      last_contact_date,
      days_since_last_contact,
      historical_avg_contact_gap: historical_avg_contact_gap !== null ? Math.round(historical_avg_contact_gap * 10) / 10 : null,
      csat_last_5:               csat_last_5 !== null ? Math.round(csat_last_5 * 10) / 10 : null,
    },
    signals,
    score,
    tier,
    recommendedAction,
  };
}

/**
 * Score all merchants and return enriched array, sorted by score descending.
 */
function scoreAllMerchants(merchants) {
  return merchants.map(scoreMerchant);
}
