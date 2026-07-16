/**
 * data.js — Fixture merchants for Merchant Churn Risk Dashboard
 *
 * ~18 hand-authored records deliberately covering:
 *  1. High ticket volume + positive sentiment  → should NOT be High risk
 *  2. "Went silent" after an active pattern    → tests gap derivation
 *  3. Multiple simultaneous flags              → tests priority resolution
 *  4. Clean history                            → tests no false positives
 *  5. Edge cases at score tier boundaries      → 25 / 50 crossings
 *  6. All individual signals in isolation
 *  7. NPS-only dissatisfaction (no bad CSAT)
 *  8. Escalation spike without high ticket vol
 *
 * TODAY is assumed to be 2026-07-16 for gap calculations.
 */

const TODAY = new Date("2026-07-16");

/** Helper: produce a date string N days before TODAY */
function daysAgo(n) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MERCHANTS = [

  // ──────────────────────────────────────────────────────────────
  // M01 — Noisy but healthy. High ticket volume, positive sentiment.
  //        MUST NOT be flagged High risk (tests naïve volume ≠ risk).
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-001",
    name: "BrightBasket Co.",
    signup_date: "2023-01-10",
    plan_tier: "Pro",
    nps_score: 72,
    ticket_history: [
      { date: daysAgo(3),  resolved: true,  escalated: false, sentiment:  0.6, csat: 5 },
      { date: daysAgo(7),  resolved: true,  escalated: false, sentiment:  0.7, csat: 4 },
      { date: daysAgo(12), resolved: true,  escalated: false, sentiment:  0.5, csat: 5 },
      { date: daysAgo(18), resolved: true,  escalated: false, sentiment:  0.8, csat: 5 },
      { date: daysAgo(22), resolved: true,  escalated: false, sentiment:  0.6, csat: 4 },
      { date: daysAgo(28), resolved: true,  escalated: false, sentiment:  0.7, csat: 5 },
      { date: daysAgo(35), resolved: true,  escalated: false, sentiment:  0.5, csat: 4 },
      { date: daysAgo(42), resolved: true,  escalated: false, sentiment:  0.6, csat: 5 },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M02 — Went Silent. Active pattern then complete drop-off.
  //        Historical avg gap ~7 days, last contact 60 days ago → 2× triggered.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-002",
    name: "Quietude Goods",
    signup_date: "2022-06-15",
    plan_tier: "Basic",
    nps_score: null,
    ticket_history: [
      { date: daysAgo(60),  resolved: true,  escalated: false, sentiment: 0.1, csat: 3 },
      { date: daysAgo(67),  resolved: true,  escalated: false, sentiment: 0.2, csat: 4 },
      { date: daysAgo(74),  resolved: true,  escalated: false, sentiment: 0.0, csat: 3 },
      { date: daysAgo(81),  resolved: true,  escalated: false, sentiment: 0.1, csat: 4 },
      { date: daysAgo(88),  resolved: true,  escalated: false, sentiment: 0.2, csat: 3 },
      // avg gap between these: 7 days; last contact 60 days ago → gap = 60d >> 2×7=14d ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M03 — Multiple simultaneous flags. Escalation + Low CSAT + Sentiment.
  //        Escalation spike: 3 escalations in 90d vs. 0 in prior 90-180d → spike ✓
  //        Tests priority resolution: top flag = Escalation Spike (P1).
  //        2 unresolved < 3 → no backlog flag (edge case).
  //        "Went silent": avg gap 5d, last contact 5d → 5 < 2×5=10 → NOT silent ✓
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-003",
    name: "StormFront Retail",
    signup_date: "2021-11-20",
    plan_tier: "Plus",
    nps_score: -30,
    ticket_history: [
      { date: daysAgo(5),  resolved: false, escalated: true,  sentiment: -0.7, csat: 1 },
      { date: daysAgo(10), resolved: false, escalated: true,  sentiment: -0.8, csat: 1 },
      { date: daysAgo(15), resolved: true,  escalated: true,  sentiment: -0.5, csat: 2 },
      // 3 escalations in 90d, 0 in 90-180d → escalation spike ✓
      // CSAT avg last 5 = (1+1+2)/3 ≈ 1.33 < 3.0 → low CSAT ✓
      // NPS = -30 < 0 ✓
      // 2 unresolved → backlog NOT triggered (threshold = 3) ✓
      // sentiment avg = (-0.7-0.8-0.5)/3 ≈ -0.67 < -0.2 → sentiment decline ✓
      // Score = 30+20+10 = 60 → High ✓, Action = P1 (escalation spike)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M04 — Clean / healthy merchant. No flags, no risk.
  //        Tests that clean history → Low tier, no false positives.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-004",
    name: "PolishedPeel Studio",
    signup_date: "2024-02-01",
    plan_tier: "Pro",
    nps_score: 55,
    ticket_history: [
      { date: daysAgo(10), resolved: true, escalated: false, sentiment: 0.6, csat: 5 },
      { date: daysAgo(25), resolved: true, escalated: false, sentiment: 0.5, csat: 4 },
      { date: daysAgo(40), resolved: true, escalated: false, sentiment: 0.7, csat: 5 },
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M05 — Score boundary: exactly at HIGH threshold (≥50).
  //        Escalation (30) + Went Silent (25) = 55. Clearly High.
  //        Designed with enough history so "went silent" is non-trivial.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-005",
    name: "Verge Commerce",
    signup_date: "2022-09-01",
    plan_tier: "Plus",
    nps_score: 20,
    ticket_history: [
      { date: daysAgo(90),  resolved: true,  escalated: false, sentiment:  0.2, csat: 4 },
      { date: daysAgo(97),  resolved: true,  escalated: false, sentiment:  0.1, csat: 3 },
      { date: daysAgo(104), resolved: true,  escalated: false, sentiment:  0.0, csat: 4 },
      { date: daysAgo(111), resolved: true,  escalated: false, sentiment:  0.2, csat: 4 },
      // avg gap ≈ 7 days; last contact = 90 days → 90 >> 2×7=14 → went silent ✓
      // Escalation spike: inject 3 escalated tickets in the 90d window separately...
      { date: daysAgo(91),  resolved: false, escalated: true,  sentiment: -0.5, csat: 2 },
      { date: daysAgo(92),  resolved: false, escalated: true,  sentiment: -0.4, csat: 2 },
      { date: daysAgo(93),  resolved: false, escalated: true,  sentiment: -0.3, csat: 2 },
      // These 3 escalations vs. ~0 in prior window → spike ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M06 — Score boundary: exactly at MEDIUM threshold (25–49).
  //        Only "Went Silent" flag (25). Tests 25 = Medium, not High.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-006",
    name: "DriftMark Supply",
    signup_date: "2023-04-12",
    plan_tier: "Basic",
    nps_score: 10,
    ticket_history: [
      { date: daysAgo(80),  resolved: true, escalated: false, sentiment: 0.3, csat: 4 },
      { date: daysAgo(90),  resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      { date: daysAgo(100), resolved: true, escalated: false, sentiment: 0.5, csat: 5 },
      { date: daysAgo(110), resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      // avg gap ≈ 10 days; last contact 80d ago → 2×10=20 → 80 >> 20 → went silent ✓
      // NPS=10 ≥ 0, csat avg = (4+4+5+4)/4 = 4.25 ≥ 3 → no CSAT flag
      // No escalations, no unresolved, sentiment avg ≈ 0.4 → no other flags
      // Score = 25 (went silent only) → Medium ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M07 — Score boundary: just below MEDIUM (score = 20, Low tier).
  //        Sentiment decline only (10) + no other flags.
  //        Actually let's do: Low CSAT only (20) → just below medium cutoff is 24.
  //        We'll make score = 10 (sentiment only). Low tier.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-007",
    name: "GlacierPoint Brands",
    signup_date: "2024-05-01",
    plan_tier: "Pro",
    nps_score: 5,
    ticket_history: [
      { date: daysAgo(5),  resolved: true, escalated: false, sentiment: -0.4, csat: 4 },
      { date: daysAgo(10), resolved: true, escalated: false, sentiment: -0.5, csat: 3 },
      { date: daysAgo(15), resolved: true, escalated: false, sentiment: -0.3, csat: 4 },
      // avg gap ≈ 5 days; last contact 5d → 2×5=10 → 5 < 10 → NOT silent ✓
      // CSAT avg last 5 = (4+3+4)/3 = 3.67 ≥ 3 → no CSAT flag ✓
      // NPS = 5 ≥ 0 → no NPS flag ✓
      // Sentiment avg = (-0.4-0.5-0.3)/3 = -0.4 < -0.2 → sentiment decline ✓
      // Score = 10 → Low ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M08 — Unresolved backlog only. 4 open tickets, otherwise decent.
  //        Tests backlog signal in isolation.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-008",
    name: "Nexora Marketplace",
    signup_date: "2022-12-01",
    plan_tier: "Plus",
    nps_score: 15,
    ticket_history: [
      { date: daysAgo(2),  resolved: false, escalated: false, sentiment:  0.0, csat: null },
      { date: daysAgo(5),  resolved: false, escalated: false, sentiment:  0.1, csat: null },
      { date: daysAgo(9),  resolved: false, escalated: false, sentiment:  0.2, csat: null },
      { date: daysAgo(14), resolved: false, escalated: false, sentiment:  0.0, csat: null },
      { date: daysAgo(20), resolved: true,  escalated: false, sentiment:  0.3, csat: 4 },
      { date: daysAgo(35), resolved: true,  escalated: false, sentiment:  0.4, csat: 4 },
      // 4 unresolved → backlog ✓
      // avg gap varies; last contact 2d, avg gap ≈ (3+4+5+6+15)/5≈6.6d → 2×6.6=13.2 > 2 → NOT silent ✓
      // sentiment avg ≈ 0.1 → no sentiment decline ✓
      // Score = 15 (backlog only) → Low ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M09 — Low CSAT + Low NPS. No other signals.
  //        Tests CSAT/NPS signal in isolation. Score = 20 → Low.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-009",
    name: "Amber Lane Stores",
    signup_date: "2023-08-22",
    plan_tier: "Basic",
    nps_score: -15,
    ticket_history: [
      { date: daysAgo(5),  resolved: true, escalated: false, sentiment: -0.1, csat: 2 },
      { date: daysAgo(10), resolved: true, escalated: false, sentiment:  0.0, csat: 2 },
      { date: daysAgo(16), resolved: true, escalated: false, sentiment:  0.1, csat: 3 },
      { date: daysAgo(22), resolved: true, escalated: false, sentiment:  0.0, csat: 2 },
      { date: daysAgo(29), resolved: true, escalated: false, sentiment: -0.1, csat: 2 },
      // CSAT avg last 5 = (2+2+3+2+2)/5 = 2.2 < 3.0 → low CSAT ✓
      // NPS = -15 < 0 → also triggers ✓
      // avg gap ≈ 6d; last contact 5d → 2×6=12 > 5 → NOT silent ✓
      // sentiment avg ≈ -0.02 > -0.2 → no decline ✓
      // Score = 20 → Low ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M10 — NPS only dissatisfaction (CSAT is fine). Score = 20 → Low.
  //        Tests NPS<0 path specifically, even when CSAT ≥ 3.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-010",
    name: "Crestline Digital",
    signup_date: "2024-01-15",
    plan_tier: "Pro",
    nps_score: -5,
    ticket_history: [
      { date: daysAgo(6),  resolved: true, escalated: false, sentiment: 0.2, csat: 4 },
      { date: daysAgo(14), resolved: true, escalated: false, sentiment: 0.3, csat: 3 },
      { date: daysAgo(22), resolved: true, escalated: false, sentiment: 0.1, csat: 4 },
      // CSAT avg = (4+3+4)/3 = 3.67 ≥ 3 → no CSAT ✓
      // NPS = -5 < 0 → low NPS ✓
      // avg gap ≈ 8d; last contact 6d → 2×8=16 > 6 → NOT silent ✓
      // Score = 20 → Low ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M11 — Escalation spike in isolation + sentiment. Score = 30+10 = 40 → Medium.
  //        4 escalations in 90d vs. 0 in prior 90-180d = spike.
  //        2 unresolved tickets (below backlog threshold of 3).
  //        NPS = 30 → no CSAT flag. NOT silent (last=2d, avg=29.7d, thresh=59.3d).
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-011",
    name: "RedPeak Solutions",
    signup_date: "2022-03-01",
    plan_tier: "Plus",
    nps_score: 30,
    ticket_history: [
      // Recent cluster: 4 escalations, only 2 unresolved
      { date: daysAgo(2),  resolved: false, escalated: true,  sentiment: -0.3, csat: null },
      { date: daysAgo(7),  resolved: false, escalated: true,  sentiment: -0.4, csat: null },
      { date: daysAgo(15), resolved: true,  escalated: true,  sentiment: -0.2, csat: null },
      { date: daysAgo(28), resolved: true,  escalated: true,  sentiment: -0.1, csat: 3 },
      // Historical baseline: 0 escalations in 90-180d window
      { date: daysAgo(120), resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      { date: daysAgo(150), resolved: true, escalated: false, sentiment: 0.5, csat: 5 },
      { date: daysAgo(180), resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      // Escalation spike ✓ (4 in 90d vs. 0 prior 90-180d)
      // Unresolved = 2 < 3 → no backlog ✓
      // avg sentiment recent = (-0.3-0.4-0.2-0.1)/4 = -0.25 < -0.2 → sentiment decline ✓
      // Score = 30+10 = 40 → Medium ✓, Action = P1 (escalation spike)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M12 — All 5 signals active simultaneously. Maximum risk. Score = 100.
  //        Escalation spike: 4 escalations in 90d (days 60-67), 0 in 90-180d → spike ✓
  //        Went silent: last contact 60d ago, avg_gap ≈ 5d → 2×5=10d < 60d → silent ✓
  //        Low CSAT: avg 1.4/5 + NPS -60 ✓
  //        Backlog: 4 unresolved ≥ 3 ✓
  //        Sentiment: avg ≈ -0.44 < -0.2 ✓
  //        Priority = Escalation Spike (P1).
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-012",
    name: "Crimson Cart Ltd.",
    signup_date: "2021-04-10",
    plan_tier: "Plus",
    nps_score: -60,
    ticket_history: [
      // 4 escalated in last 90d (days 60-67), 0 in 90-180d → escalation spike ✓
      { date: daysAgo(60), resolved: false, escalated: true,  sentiment: -0.8, csat: 1 },
      { date: daysAgo(63), resolved: false, escalated: true,  sentiment: -0.9, csat: 1 },
      { date: daysAgo(65), resolved: false, escalated: true,  sentiment: -0.7, csat: 1 },
      { date: daysAgo(67), resolved: false, escalated: true,  sentiment: -0.6, csat: 1 },
      // Older baseline tickets (avg gap ≈ 5d among all tickets)
      { date: daysAgo(80), resolved: true,  escalated: false, sentiment: -0.1, csat: 3 },
      { date: daysAgo(85), resolved: true,  escalated: false, sentiment:  0.0, csat: 3 },
      { date: daysAgo(90), resolved: true,  escalated: false, sentiment:  0.0, csat: 4 },
      // avg_gap across all 7 sorted dates ≈ 5d; last_contact = 60d → 60 >> 2×5=10 → went silent ✓
      // CSAT last 5 = (1+1+1+1+3)/5 = 1.4 < 3 → low CSAT ✓
      // NPS = -60 < 0 ✓
      // 4 unresolved ≥ 3 → backlog ✓
      // Sentiment avg = (-0.8-0.9-0.7-0.6-0.1)/5 ≈ -0.62 < -0.2 → sentiment ✓
      // Score = 30+25+20+15+10 = 100 → High ✓, Action = P1 (escalation spike)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M13 — Went silent + Low CSAT (no escalation).
  //        Priority = Went Silent (P2). Score = 25+20 = 45 → Medium.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-013",
    name: "HorizonBay Apparel",
    signup_date: "2023-02-14",
    plan_tier: "Basic",
    nps_score: -10,
    ticket_history: [
      { date: daysAgo(45), resolved: true, escalated: false, sentiment: -0.1, csat: 2 },
      { date: daysAgo(52), resolved: true, escalated: false, sentiment:  0.0, csat: 2 },
      { date: daysAgo(59), resolved: true, escalated: false, sentiment:  0.1, csat: 3 },
      { date: daysAgo(66), resolved: true, escalated: false, sentiment:  0.0, csat: 2 },
      // avg gap ≈ 7d; last contact 45d → 2×7=14 → 45>>14 → went silent ✓
      // CSAT last 4 = (2+2+3+2)/4 = 2.25 < 3 → low CSAT ✓
      // No escalations, <3 unresolved, sentiment avg ≈ 0.0 → no other flags ✓
      // Score = 45 → Medium ✓, Action = P2 (went silent)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M14 — Escalation spike + sentiment. No silence. Score = 30+10 = 40 → Medium.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-014",
    name: "ForgeFront Trade",
    signup_date: "2022-07-30",
    plan_tier: "Pro",
    nps_score: 5,
    ticket_history: [
      { date: daysAgo(5),  resolved: true, escalated: true,  sentiment: -0.5, csat: 3 },
      { date: daysAgo(12), resolved: true, escalated: true,  sentiment: -0.6, csat: 3 },
      { date: daysAgo(20), resolved: true, escalated: true,  sentiment: -0.4, csat: 3 },
      // Historical: no escalations prior to 30d
      { date: daysAgo(40), resolved: true, escalated: false, sentiment: 0.3, csat: 4 },
      { date: daysAgo(55), resolved: true, escalated: false, sentiment: 0.4, csat: 5 },
      // avg gap ≈ varies; last contact 5d; avg gap (7+8+20+15)=50/4=12.5d → 2×12.5=25 > 5 → NOT silent ✓
      // Escalation spike ✓; sentiment avg recent = (-0.5-0.6-0.4)/3 = -0.5 < -0.2 ✓
      // Score = 40 → Medium ✓, Action = P1 (escalation)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M15 — Backlog + Sentiment only. Score = 15+10 = 25 → exactly Medium boundary.
  //        Avg sentiment = (-0.5-0.6-0.4-0.1+0.1)/5 = -0.3 < -0.2 → sentiment ✓
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-015",
    name: "SunPatch Markets",
    signup_date: "2023-10-01",
    plan_tier: "Basic",
    nps_score: 20,
    ticket_history: [
      { date: daysAgo(3),  resolved: false, escalated: false, sentiment: -0.5, csat: null },
      { date: daysAgo(8),  resolved: false, escalated: false, sentiment: -0.6, csat: null },
      { date: daysAgo(14), resolved: false, escalated: false, sentiment: -0.4, csat: null },
      { date: daysAgo(20), resolved: true,  escalated: false, sentiment: -0.1, csat: 4 },
      { date: daysAgo(28), resolved: true,  escalated: false, sentiment:  0.1, csat: 4 },
      // 3 unresolved → backlog ✓
      // avg gap ≈ 6.3d; last contact 3d → 2×6.3=12.5 > 3 → NOT silent ✓
      // sentiment avg = (-0.5-0.6-0.4-0.1+0.1)/5 = -0.3 < -0.2 → sentiment decline ✓
      // Score = 25 → exactly Medium ✓, Action = P4 (backlog)
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M16 — Went silent after very infrequent contact. Edge case:
  //        historical avg gap is large (30d), last contact 80d → 80 > 60 → still triggers.
  //        Tests that "went silent" works even for naturally slow merchants.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-016",
    name: "OakThrone Trading",
    signup_date: "2021-08-05",
    plan_tier: "Pro",
    nps_score: 30,
    ticket_history: [
      { date: daysAgo(80),  resolved: true, escalated: false, sentiment: 0.3, csat: 4 },
      { date: daysAgo(110), resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      { date: daysAgo(140), resolved: true, escalated: false, sentiment: 0.2, csat: 5 },
      { date: daysAgo(170), resolved: true, escalated: false, sentiment: 0.3, csat: 4 },
      // avg gap = (30+30+30)/3 = 30d; last contact 80d → 2×30=60 → 80 > 60 → went silent ✓
      // Score = 25 → Medium ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M17 — Very recent signup, single ticket. NOT silent (too new).
  //        Tests that a merchant with only 1 ticket can't derive a meaningful gap
  //        and thus is NOT flagged for "went silent". Score = 0 → Low.
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-017",
    name: "Freshwave Labs",
    signup_date: "2026-06-01",
    plan_tier: "Basic",
    nps_score: null,
    ticket_history: [
      { date: daysAgo(10), resolved: true, escalated: false, sentiment: 0.5, csat: 5 },
      // Only 1 ticket → can't compute avg gap → "went silent" NOT fired ✓
      // Score = 0 → Low ✓
    ],
  },

  // ──────────────────────────────────────────────────────────────
  // M18 — Escalation spike + backlog + low CSAT. All high-weighted.
  //        Score = 30+15+20 = 65 → High ✓. Priority = Escalation (P1).
  // ──────────────────────────────────────────────────────────────
  {
    merchant_id: "M-018",
    name: "IronBridge Commerce",
    signup_date: "2022-01-18",
    plan_tier: "Plus",
    nps_score: -40,
    ticket_history: [
      { date: daysAgo(3),  resolved: false, escalated: true,  sentiment: -0.4, csat: 1 },
      { date: daysAgo(8),  resolved: false, escalated: true,  sentiment: -0.5, csat: 2 },
      { date: daysAgo(14), resolved: false, escalated: true,  sentiment: -0.3, csat: 1 },
      { date: daysAgo(20), resolved: true,  escalated: false, sentiment:  0.0, csat: 3 },
      { date: daysAgo(28), resolved: true,  escalated: false, sentiment:  0.1, csat: 3 },
      // Historical: 0 escalations before 30d
      { date: daysAgo(60), resolved: true, escalated: false, sentiment: 0.4, csat: 4 },
      { date: daysAgo(90), resolved: true, escalated: false, sentiment: 0.3, csat: 4 },
      // Escalation spike: 3 in 30d vs. 0 prior → ✓
      // Backlog: 3 unresolved → ✓
      // CSAT last 5 = (1+2+1+3+3)/5 = 2.0 < 3 → low CSAT ✓
      // NPS = -40 < 0 ✓
      // avg gap: (5+6+6+8+32+30)/6 = 87/6 ≈ 14.5d; last contact 3d → 2×14.5=29 > 3 → NOT silent ✓
      // sentiment recent avg = (-0.4-0.5-0.3+0.0+0.1)/5 = -0.22 < -0.2 → ✓
      // Score = 30+20+15+10 = 75 → High ✓
    ],
  },

];
