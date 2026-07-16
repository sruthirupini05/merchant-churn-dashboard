# UI/UX and Presentation Layer Specifications

## 1. Design System Tokens

The presentation layer utilizes a curated dark glassmorphism palette. This maximizes visual contrast for risk alerts and prevents "dashboard fatigue" by avoiding plain grid layouts.

| Variable | Color (Hex/HSL) | Purpose |
|---|---|---|
| `--bg-base` | `#0a0d14` | Primary body background |
| `--bg-card` | `#161c2d` | Container and table background |
| `--accent` | `#6366f1` (Indigo HSL) | Active state indicators, focal outlines |
| `--high-text` | `#f87171` | High-risk text & border alerts |
| `--med-text` | `#fbbf24` | Medium-risk text & alerts |
| `--low-text` | `#4ade80` | Low-risk/healthy text & borders |

---

## 2. Layout Structure

### A. Global Header Stats Bar
* Displays four indicators: High Risk count, Medium Risk count, Low Risk count, and Total Merchants.
* Updates dynamically as filters are applied or as merchants are modified.
* Color-coded with subtle background glows to guide the user's focus.

### B. Interactive Controls Bar
* **Text Search:** Real-time filter matching merchant names and merchant IDs.
* **Filter Chips:** Fast buttons to toggle view between All, High, Medium, and Low risk merchants.
* **Sort Dropdown:** Allows sorting by Risk Score, Name, and Tier.

### C. Risk Indicators Table
* Renders plan type badges (`Basic`, `Pro`, `Plus`).
* Uses visual progress bars for risk scores to make them scannable.
* Uses active icons for signal tags (e.g. `🚨 Escalation`, `🔇 Silent`) to allow rapid diagnosis.
* Actionable cells displaying recommended next steps based on the highest-priority active signal.

### D. Slide-In Detail Drawer
* Slides in from the right edge upon clicking a table row.
* Displays a detailed breakdown of the 100-point risk score.
* Renders a grid showing derived metrics (CSAT avg, sentiment, exact contact gaps, and historical silent thresholds).
* Renders the complete chronological support ticket history for auditability.
* Closes on click-outside, close button, or pressing the `Escape` key.
