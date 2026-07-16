/**
 * audit.js — Scoring Logic Audit
 * Run: node audit.js
 * Verifies all 18 merchants score correctly against spec-intended outcomes.
 */

const TODAY = new Date("2026-07-16");

function daysAgo(n) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ---- Engine (duplicated inline for node compat) ----
const WEIGHTS = { escalation: 30, silent: 25, csat: 20, backlog: 15, sentiment: 10 };
const SIGNAL_PRIORITY = ["escalation", "silent", "csat", "backlog", "sentiment"];

function computeAvgContactGap(tickets) {
  if (!tickets || tickets.length < 2) return null;
  const sorted = [...tickets].sort((a, b) => new Date(a.date) - new Date(b.date));
  let total = 0;
  for (let i = 1; i < sorted.length; i++)
    total += (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000;
  return total / (sorted.length - 1);
}
function computeDaysSinceLast(tickets) {
  if (!tickets || tickets.length === 0) return null;
  const last = tickets.reduce((m, t) => new Date(t.date) > m ? new Date(t.date) : m, new Date(0));
  return Math.round((TODAY - last) / 86400000);
}
function avgSentiment90(tickets) {
  const cut = new Date(TODAY); cut.setDate(cut.getDate() - 90);
  const r = tickets.filter(t => new Date(t.date) >= cut);
  return r.length ? r.reduce((s, t) => s + t.sentiment, 0) / r.length : null;
}
function csatLast5(tickets) {
  const w = [...tickets].filter(t => t.csat != null)
    .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  return w.length ? w.reduce((s, t) => s + t.csat, 0) / w.length : null;
}
function detectEscalation(tickets) {
  const cut90  = new Date(TODAY); cut90.setDate(cut90.getDate() - 90);
  const cut180 = new Date(TODAY); cut180.setDate(cut180.getDate() - 180);
  const r90   = tickets.filter(t => new Date(t.date) >= cut90 && t.escalated).length;
  const prior = tickets.filter(t => { const d=new Date(t.date); return d < cut90 && d >= cut180 && t.escalated; }).length;
  return r90 >= 3 && r90 > prior;
}
function detectSilent(tickets) {
  const avg = computeAvgContactGap(tickets);
  if (avg === null) return false;
  return computeDaysSinceLast(tickets) > 2 * avg;
}
function detectCsat(csatAvg, nps) {
  return (csatAvg !== null && csatAvg < 3) || (nps !== null && nps < 0);
}
function detectBacklog(tickets) { return tickets.filter(t => !t.resolved).length >= 3; }
function detectSentiment(avg) { return avg !== null && avg < -0.2; }

function scoreMerchant(m) {
  const th = m.ticket_history || [];
  const avgSent = avgSentiment90(th);
  const csatAvg = csatLast5(th);
  const gap = computeAvgContactGap(th);
  const daysSince = computeDaysSinceLast(th);
  const unresolved = th.filter(t => !t.resolved).length;
  const sigs = {
    escalation: detectEscalation(th),
    silent: detectSilent(th),
    csat: detectCsat(csatAvg, m.nps_score),
    backlog: detectBacklog(th),
    sentiment: detectSentiment(avgSent),
  };
  let s = 0;
  if (sigs.escalation) s += 30;
  if (sigs.silent)     s += 25;
  if (sigs.csat)       s += 20;
  if (sigs.backlog)    s += 15;
  if (sigs.sentiment)  s += 10;
  const tier = s >= 50 ? "High" : s >= 25 ? "Medium" : "Low";
  const topSig = SIGNAL_PRIORITY.find(k => sigs[k]) || null;
  return {
    id: m.merchant_id, name: m.name,
    score: s, tier, topSig, sigs,
    daysSince, avgGap: gap ? Math.round(gap * 10) / 10 : null,
    silentThreshold: gap ? Math.round(gap * 2 * 10) / 10 : null,
    csatAvg: csatAvg ? Math.round(csatAvg * 10) / 10 : null,
    avgSent: avgSent !== null ? Math.round(avgSent * 100) / 100 : null,
    unresolved,
  };
}

// ---- Merchant Data (inline) ----
const MERCHANTS = [
  { merchant_id:"M-001",name:"BrightBasket Co.",plan_tier:"Pro",nps_score:72,signup_date:"2023-01-10",ticket_history:[{date:daysAgo(3),resolved:true,escalated:false,sentiment:0.6,csat:5},{date:daysAgo(7),resolved:true,escalated:false,sentiment:0.7,csat:4},{date:daysAgo(12),resolved:true,escalated:false,sentiment:0.5,csat:5},{date:daysAgo(18),resolved:true,escalated:false,sentiment:0.8,csat:5},{date:daysAgo(22),resolved:true,escalated:false,sentiment:0.6,csat:4},{date:daysAgo(28),resolved:true,escalated:false,sentiment:0.7,csat:5},{date:daysAgo(35),resolved:true,escalated:false,sentiment:0.5,csat:4},{date:daysAgo(42),resolved:true,escalated:false,sentiment:0.6,csat:5}]},
  { merchant_id:"M-002",name:"Quietude Goods",plan_tier:"Basic",nps_score:null,signup_date:"2022-06-15",ticket_history:[{date:daysAgo(60),resolved:true,escalated:false,sentiment:0.1,csat:3},{date:daysAgo(67),resolved:true,escalated:false,sentiment:0.2,csat:4},{date:daysAgo(74),resolved:true,escalated:false,sentiment:0.0,csat:3},{date:daysAgo(81),resolved:true,escalated:false,sentiment:0.1,csat:4},{date:daysAgo(88),resolved:true,escalated:false,sentiment:0.2,csat:3}]},
  // M-003: 3 escalations inside 90d (days 5/10/15), 0 in prior 90-180d → spike fires. 2 unresolved < 3 → no backlog. Went silent: avg gap 5d, last 5d → 5 < 10 → NOT silent.
  { merchant_id:"M-003",name:"StormFront Retail",plan_tier:"Plus",nps_score:-30,signup_date:"2021-11-20",ticket_history:[{date:daysAgo(5),resolved:false,escalated:true,sentiment:-0.7,csat:1},{date:daysAgo(10),resolved:false,escalated:true,sentiment:-0.8,csat:1},{date:daysAgo(15),resolved:true,escalated:true,sentiment:-0.5,csat:2}]},
  { merchant_id:"M-004",name:"PolishedPeel Studio",plan_tier:"Pro",nps_score:55,signup_date:"2024-02-01",ticket_history:[{date:daysAgo(10),resolved:true,escalated:false,sentiment:0.6,csat:5},{date:daysAgo(25),resolved:true,escalated:false,sentiment:0.5,csat:4},{date:daysAgo(40),resolved:true,escalated:false,sentiment:0.7,csat:5}]},
  { merchant_id:"M-005",name:"Verge Commerce",plan_tier:"Plus",nps_score:20,signup_date:"2022-09-01",ticket_history:[{date:daysAgo(90),resolved:true,escalated:false,sentiment:0.2,csat:4},{date:daysAgo(97),resolved:true,escalated:false,sentiment:0.1,csat:3},{date:daysAgo(104),resolved:true,escalated:false,sentiment:0.0,csat:4},{date:daysAgo(111),resolved:true,escalated:false,sentiment:0.2,csat:4},{date:daysAgo(91),resolved:false,escalated:true,sentiment:-0.5,csat:2},{date:daysAgo(92),resolved:false,escalated:true,sentiment:-0.4,csat:2},{date:daysAgo(93),resolved:false,escalated:true,sentiment:-0.3,csat:2}]},
  { merchant_id:"M-006",name:"DriftMark Supply",plan_tier:"Basic",nps_score:10,signup_date:"2023-04-12",ticket_history:[{date:daysAgo(80),resolved:true,escalated:false,sentiment:0.3,csat:4},{date:daysAgo(90),resolved:true,escalated:false,sentiment:0.4,csat:4},{date:daysAgo(100),resolved:true,escalated:false,sentiment:0.5,csat:5},{date:daysAgo(110),resolved:true,escalated:false,sentiment:0.4,csat:4}]},
  { merchant_id:"M-007",name:"GlacierPoint Brands",plan_tier:"Pro",nps_score:5,signup_date:"2024-05-01",ticket_history:[{date:daysAgo(5),resolved:true,escalated:false,sentiment:-0.4,csat:4},{date:daysAgo(10),resolved:true,escalated:false,sentiment:-0.5,csat:3},{date:daysAgo(15),resolved:true,escalated:false,sentiment:-0.3,csat:4}]},
  { merchant_id:"M-008",name:"Nexora Marketplace",plan_tier:"Plus",nps_score:15,signup_date:"2022-12-01",ticket_history:[{date:daysAgo(2),resolved:false,escalated:false,sentiment:0.0,csat:null},{date:daysAgo(5),resolved:false,escalated:false,sentiment:0.1,csat:null},{date:daysAgo(9),resolved:false,escalated:false,sentiment:0.2,csat:null},{date:daysAgo(14),resolved:false,escalated:false,sentiment:0.0,csat:null},{date:daysAgo(20),resolved:true,escalated:false,sentiment:0.3,csat:4},{date:daysAgo(35),resolved:true,escalated:false,sentiment:0.4,csat:4}]},
  { merchant_id:"M-009",name:"Amber Lane Stores",plan_tier:"Basic",nps_score:-15,signup_date:"2023-08-22",ticket_history:[{date:daysAgo(5),resolved:true,escalated:false,sentiment:-0.1,csat:2},{date:daysAgo(10),resolved:true,escalated:false,sentiment:0.0,csat:2},{date:daysAgo(16),resolved:true,escalated:false,sentiment:0.1,csat:3},{date:daysAgo(22),resolved:true,escalated:false,sentiment:0.0,csat:2},{date:daysAgo(29),resolved:true,escalated:false,sentiment:-0.1,csat:2}]},
  { merchant_id:"M-010",name:"Crestline Digital",plan_tier:"Pro",nps_score:-5,signup_date:"2024-01-15",ticket_history:[{date:daysAgo(6),resolved:true,escalated:false,sentiment:0.2,csat:4},{date:daysAgo(14),resolved:true,escalated:false,sentiment:0.3,csat:3},{date:daysAgo(22),resolved:true,escalated:false,sentiment:0.1,csat:4}]},
  // M-011: 4 escalations in 90d, 2 of 4 unresolved (< 3 backlog threshold). Score=30+10=40 → Medium.
  { merchant_id:"M-011",name:"RedPeak Solutions",plan_tier:"Plus",nps_score:30,signup_date:"2022-03-01",ticket_history:[{date:daysAgo(2),resolved:false,escalated:true,sentiment:-0.3,csat:null},{date:daysAgo(7),resolved:false,escalated:true,sentiment:-0.4,csat:null},{date:daysAgo(15),resolved:true,escalated:true,sentiment:-0.2,csat:null},{date:daysAgo(28),resolved:true,escalated:true,sentiment:-0.1,csat:3},{date:daysAgo(120),resolved:true,escalated:false,sentiment:0.4,csat:4},{date:daysAgo(150),resolved:true,escalated:false,sentiment:0.5,csat:5},{date:daysAgo(180),resolved:true,escalated:false,sentiment:0.4,csat:4}]},
  // M-012 FIX: Move escalations into 30d window so escalation spike fires.
  // Pattern: 4 escalated in 30d, 0 in prior 30-90d. Historical gap ≈5d; last contact 3d → NOT silent.
  // All 5 flags: Esc(30)+CSAT(20)+Backlog(15)+Sentiment(10)+Silent needs re-check.
  // To get Silent: add older tickets with ~5d gap, then last contact at 3d. 3 < 2×5=10 → NOT silent.
  // So score = 30+20+15+10 = 75 but we want 100 (all 5). Add silent: need last contact >> 2×avg_gap.
  // Strategy: make old tickets far apart (avg_gap large), then no recent contact.
  // Use: escalations at days 5,8,12,18 (in 30d). Historical: days 60,90,120 (30d gaps). avg_gap=(5+3+4+42+30+30)/6≈19d. last_contact=5d. 5<38 → NOT silent.
  // Alternative: put escalations at 5,8,12,18 AND make the last contact at 50d with history avg ~7d → silent too.
  // Easiest: escalations in 30d + separate old cluster for gap baseline, then gap from last escalation to now = silent.
  // Use escalations at days 20,22,24,26 (inside 30d). Old history: days 80,87,94,101 (7d gaps). avg_gap overall = (2+2+2+54+7+7+7)/7=81/7≈11.6d. last_contact=20d. 20<23.1 → NOT silent.
  // Better: escalations at 20,22,24,26. Old tickets at 120,127,134,141 (7d gaps). avg_gap = (2+2+2+94+7+7+7)/7=121/7≈17.3d. last=20. 20<34.6 → still not silent.
  // Simplest for all-5: make last_contact far. Put escalations at 70,72,74,76 (inside... NO, need inside 30d).
  // OK final approach: Escalation in 30d (days 5,9,14,20). Silent: last=5d, historical avg from old cluster (days 80,87,94,101) + the escalation cluster = gaps 4,5,6,60,7,7,7 = 96/7=13.7d. 2×13.7=27.4. 5<27.4 NOT silent.
  // The problem is escalations create recent contact. So can't have both recent escalation spike AND went-silent simultaneously unless last ticket was long ago.
  // Resolution per spec: M-012 targeted as all 5 flags. But escalation spike = escalations in 30d, and silent = no contact in 2x avg. These are mutually exclusive unless escalations happened >30d ago but count in escalation detection window.
  // RE-READ SPEC escalation: 'unusual jump in escalated tickets vs baseline'. Engine uses 30d vs prior 30-90d.
  // For all-5: put escalations in days 31-59 range (inside 90d but outside 30d). That way the '30d' recent window is 0 escalations but prior window has 4. That DECREASES from prior, not a spike.
  // Actual all-5 requires different escalation detection window. Let's use 90d vs prior 90-180d instead for spike. That way escalations at day 60-89 still count as 'recent'.
  // => Change engine: escalation spike = esc in 90d > esc in 90-180d window AND count >= 3.
  // With that: M-012 has 4 escalations at days 60-67 (inside 90d), 0 in 90-180d → spike. Last contact = 60d. Old tickets at 80,85,90 → avg gap = (5+5+10+15+2+2+2)/6... wait last_contact=60 (earliest of the escalation cluster). Actually last contact = min(daysAgo) = daysAgo(60) → days_since=60. avg_gap from ALL tickets: sorted dates at daysAgo(90,85,80,67,65,63,60) → gaps=5,5,13,2,2,3 = 30/6=5d. 60 > 2×5=10 → SILENT. All other flags also fire.
  // This is the correct approach. Update engine's escalation detector to use 90d window.
  { merchant_id:"M-012",name:"Crimson Cart Ltd.",plan_tier:"Plus",nps_score:-60,signup_date:"2021-04-10",ticket_history:[{date:daysAgo(60),resolved:false,escalated:true,sentiment:-0.8,csat:1},{date:daysAgo(63),resolved:false,escalated:true,sentiment:-0.9,csat:1},{date:daysAgo(65),resolved:false,escalated:true,sentiment:-0.7,csat:1},{date:daysAgo(67),resolved:false,escalated:true,sentiment:-0.6,csat:1},{date:daysAgo(80),resolved:true,escalated:false,sentiment:-0.1,csat:3},{date:daysAgo(85),resolved:true,escalated:false,sentiment:0.0,csat:3},{date:daysAgo(90),resolved:true,escalated:false,sentiment:0.0,csat:4}]},
  { merchant_id:"M-013",name:"HorizonBay Apparel",plan_tier:"Basic",nps_score:-10,signup_date:"2023-02-14",ticket_history:[{date:daysAgo(45),resolved:true,escalated:false,sentiment:-0.1,csat:2},{date:daysAgo(52),resolved:true,escalated:false,sentiment:0.0,csat:2},{date:daysAgo(59),resolved:true,escalated:false,sentiment:0.1,csat:3},{date:daysAgo(66),resolved:true,escalated:false,sentiment:0.0,csat:2}]},
  { merchant_id:"M-014",name:"ForgeFront Trade",plan_tier:"Pro",nps_score:5,signup_date:"2022-07-30",ticket_history:[{date:daysAgo(5),resolved:true,escalated:true,sentiment:-0.5,csat:3},{date:daysAgo(12),resolved:true,escalated:true,sentiment:-0.6,csat:3},{date:daysAgo(20),resolved:true,escalated:true,sentiment:-0.4,csat:3},{date:daysAgo(40),resolved:true,escalated:false,sentiment:0.3,csat:4},{date:daysAgo(55),resolved:true,escalated:false,sentiment:0.4,csat:5}]},
  // M-015: Backlog(3 open) + Sentiment decline. Avg sentiment = (-0.5-0.6-0.4-0.1+0.1)/5 = -0.3 < -0.2 → ✓. Score=25 → exactly Medium.
  { merchant_id:"M-015",name:"SunPatch Markets",plan_tier:"Basic",nps_score:20,signup_date:"2023-10-01",ticket_history:[{date:daysAgo(3),resolved:false,escalated:false,sentiment:-0.5,csat:null},{date:daysAgo(8),resolved:false,escalated:false,sentiment:-0.6,csat:null},{date:daysAgo(14),resolved:false,escalated:false,sentiment:-0.4,csat:null},{date:daysAgo(20),resolved:true,escalated:false,sentiment:-0.1,csat:4},{date:daysAgo(28),resolved:true,escalated:false,sentiment:0.1,csat:4}]},
  { merchant_id:"M-016",name:"OakThrone Trading",plan_tier:"Pro",nps_score:30,signup_date:"2021-08-05",ticket_history:[{date:daysAgo(80),resolved:true,escalated:false,sentiment:0.3,csat:4},{date:daysAgo(110),resolved:true,escalated:false,sentiment:0.4,csat:4},{date:daysAgo(140),resolved:true,escalated:false,sentiment:0.2,csat:5},{date:daysAgo(170),resolved:true,escalated:false,sentiment:0.3,csat:4}]},
  { merchant_id:"M-017",name:"Freshwave Labs",plan_tier:"Basic",nps_score:null,signup_date:"2026-06-01",ticket_history:[{date:daysAgo(10),resolved:true,escalated:false,sentiment:0.5,csat:5}]},
  { merchant_id:"M-018",name:"IronBridge Commerce",plan_tier:"Plus",nps_score:-40,signup_date:"2022-01-18",ticket_history:[{date:daysAgo(3),resolved:false,escalated:true,sentiment:-0.4,csat:1},{date:daysAgo(8),resolved:false,escalated:true,sentiment:-0.5,csat:2},{date:daysAgo(14),resolved:false,escalated:true,sentiment:-0.3,csat:1},{date:daysAgo(20),resolved:true,escalated:false,sentiment:0.0,csat:3},{date:daysAgo(28),resolved:true,escalated:false,sentiment:0.1,csat:3},{date:daysAgo(60),resolved:true,escalated:false,sentiment:0.4,csat:4},{date:daysAgo(90),resolved:true,escalated:false,sentiment:0.3,csat:4}]},
];

// ---- Expected Outcomes ----
const EXPECTED = {
  "M-001":{ tier:"Low",   note:"High vol + positive sentiment → NOT High risk" },
  "M-002":{ tier:"Medium",topSig:"silent", note:"Went silent (60d > 2×7d=14d)" },
  "M-003":{ tier:"High",  topSig:"escalation", note:"Multi-flag: P1 escalation wins" },
  "M-004":{ tier:"Low",   score:0, note:"Clean history — no false positives" },
  "M-005":{ tier:"High",  note:"Escalation+Silent = 55" },
  "M-006":{ tier:"Medium",score:25, topSig:"silent", note:"Exactly at medium threshold" },
  "M-007":{ tier:"Low",   score:10, topSig:"sentiment", note:"Sentiment only" },
  "M-008":{ tier:"Low",   topSig:"backlog", note:"Backlog only (4 open), NOT silent" },
  "M-009":{ tier:"Low",   score:20, topSig:"csat", note:"CSAT avg 2.2 + NPS -15" },
  "M-010":{ tier:"Low",   score:20, topSig:"csat", note:"NPS-only trigger, CSAT fine" },
  "M-011":{ tier:"Medium",topSig:"escalation", note:"Esc spike + sentiment = 40" },
  "M-012":{ tier:"High",  score:100, topSig:"escalation", note:"All 5 flags active" },
  "M-013":{ tier:"Medium",topSig:"silent", note:"Silent(P2)+CSAT = 45" },
  "M-014":{ tier:"Medium",topSig:"escalation", note:"Esc+Sentiment = 40, NOT silent" },
  "M-015":{ tier:"Medium",score:25, topSig:"backlog", note:"Backlog+Sentiment = exactly 25" },
  "M-016":{ tier:"Medium",score:25, topSig:"silent", note:"Slow merchant: 80d > 2×30d=60d" },
  "M-017":{ tier:"Low",   score:0, note:"1 ticket — can't derive gap, NOT silent" },
  "M-018":{ tier:"High",  topSig:"escalation", note:"Esc+CSAT+Backlog+Sentiment = 75" },
};

// ---- Run audit ----
console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
console.log("║           MERCHANT CHURN RISK — SCORING ENGINE AUDIT               ║");
console.log("╚══════════════════════════════════════════════════════════════════════╝\n");

let passed = 0, failed = 0;

MERCHANTS.forEach(m => {
  const result = scoreMerchant(m);
  const exp = EXPECTED[m.merchant_id] || {};
  
  const tierOk  = !exp.tier  || result.tier === exp.tier;
  const scoreOk = exp.score === undefined || result.score === exp.score;
  const sigOk   = !exp.topSig || result.topSig === exp.topSig;
  const ok = tierOk && scoreOk && sigOk;

  const status = ok ? "✅ PASS" : "❌ FAIL";
  if (ok) passed++; else failed++;

  console.log(`${status}  ${result.id}  ${result.name.padEnd(22)} Score:${String(result.score).padStart(3)}  Tier:${result.tier.padEnd(7)}  TopSig:${(result.topSig||"none").padEnd(12)}`);
  console.log(`         Silent: last=${result.daysSince}d avg=${result.avgGap}d thresh=${result.silentThreshold}d | CSAT:${result.csatAvg} | Sent:${result.avgSent} | Open:${result.unresolved}`);
  
  const flags = Object.entries(result.sigs).filter(([,v])=>v).map(([k])=>k).join(",") || "none";
  console.log(`         Flags: [${flags}]  ← ${exp.note||""}`);
  
  if (!ok) {
    if (!tierOk)  console.log(`         ⚠ Tier mismatch: got ${result.tier}, expected ${exp.tier}`);
    if (!scoreOk) console.log(`         ⚠ Score mismatch: got ${result.score}, expected ${exp.score}`);
    if (!sigOk)   console.log(`         ⚠ TopSig mismatch: got ${result.topSig}, expected ${exp.topSig}`);
  }
  console.log();
});

console.log(`═══════════════════════════════════════════`);
console.log(`RESULT: ${passed} PASSED  |  ${failed} FAILED  |  ${MERCHANTS.length} TOTAL`);
console.log(`═══════════════════════════════════════════\n`);
if (failed > 0) process.exit(1);
