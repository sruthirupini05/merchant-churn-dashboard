# ChurnRadar Scaffold Summary

This document captures the trace and output of the initial project scaffolding phase, detailing the file structure, validation checks, and architectural decisions made by the system.

---

## 🏗️ Scaffold Complete — All Checks Pass

### Directory Map & Inventory
```
merchant-churn-dashboard/
├── docs/
│   ├── 01_system_design.md          ← Architecture, algorithm, data model, reliability
│   ├── 02_directory_structure.md    ← File contracts, why this structure
│   ├── 03_existing_solutions.md     ← Gainsight, ChurnZero, Totango, Amplitude research
│   ├── 04_antigravity_context.md    ← Full brief for Claude to implement from
│   ├── 05_ux_design.md              ← Layout wireframes, components, colours, micro-interactions
│   └── 06_v1_spec.md                ← Submission document
├── data/merchants.json              ← 20 synthetic merchants, validated
├── css/styles.css                   ← Full dark-theme design system
├── js/
│   ├── data.js                      ← Fallback data + DataHelpers.normalise()
│   ├── engine.js                    ← Scoring engine (pure functions, auditable)
│   └── ui.js                        ← Rendering, charts, table, drawer, filters
├── index.html                       ← Semantic HTML shell
└── README.md                        ← Deploy instructions
```

---

## 🧪 Validation & Audit Run

```
=== Score Verification (sorted by urgency) ===
M-001  BrightBasket Co.       Score:   0 | Low      | none
M-002  Quietude Goods         Score:  25 | Medium   | silent
M-003  StormFront Retail      Score:  60 | High     | escalation
M-004  PolishedPeel Studio    Score:   0 | Low      | none
M-005  Verge Commerce         Score:  60 | High     | silent
M-006  DriftMark Supply       Score:  25 | Medium   | silent
M-007  GlacierPoint Brands    Score:  10 | Low      | sentiment
M-008  Nexora Marketplace     Score:  15 | Low      | backlog
M-009  Amber Lane Stores      Score:  20 | Low      | csat
M-010  Crestline Digital      Score:  20 | Low      | csat
M-011  RedPeak Solutions      Score:  40 | Medium   | escalation
M-012  Crimson Cart Ltd.      Score: 100 | High     | escalation
M-013  HorizonBay Apparel     Score:  45 | Medium   | silent
M-014  ForgeFront Trade       Score:  30 | Medium   | escalation
M-015  SunPatch Markets       Score:  25 | Medium   | backlog
M-016  OakThrone Trading      Score:  25 | Medium   | silent
M-017  Freshwave Labs         Score:   0 | Low      | none
M-018  IronBridge Commerce    Score:  65 | High     | escalation

=== Tier Distribution ===
critical: 3
high: 4
medium: 5
low: 8

Weight sum (should be 1.0): 1.0000
Out-of-range scores: 0 (should be 0)
Total merchants scored: 20 (should be 20)
```

---

## 💡 Key Design Decisions & Architecture

1. **CX Platform Integration:** Track wishlists, API request spikes, and integration connection status (crucial for payment SaaS platforms).
2. **Individual Baselines:** Derives disengagement silence relative to the merchant's personal historical contact gap, preventing false positives for slow-cadence partners.
3. **Operational Playbooks:** Maps composite scores into specific actionable playbooks (e.g. immediate CSM call, technical team ticket priority).
4. **Pure Functional Core:** The scoring engine is separate from DOM mutations, making it robust, clean, and testable under CLI engines.
