# Purpose and Existing Solutions Research

## 1. Purpose & Problem Statement

In merchant-focused SaaS and transaction-processing ecosystems (such as Stripe, Shopify, or Adyen), merchant churn represents a direct drop in Gross Merchandise Volume (GMV) and transaction fee revenues. Traditional churn models rely heavily on lag indicators, such as financial transaction volume drops or usage inactivity.

However, support-related interactions (customer experience, ticket escalations, CSAT ratings, and disengagement silence) offer critical **lead indicators** of risk. By capturing these signals before a merchant stops processing payments, CX teams can proactively salvage accounts.

This dashboard targets this specific opportunity: converting customer support history, NPS feedback, and disengagement trends into structured risk scores and concrete next steps.

---

## 2. Existing Solutions Research

To design a reliable, production-grade CX risk framework, we research real-world industry methodologies:

### A. Gainsight (Customer Success Platform)
* **Methodology:** Gainsight utilizes a multidimensional "Customer Health Score" combining support ticket urgency, backlog age, sentiment analysis, and NPS.
* **Key Design Pattern:** "Went Silent" detection. Real-world accounts that disengage completely (no logins, no support tickets) are prioritized over high-ticket accounts. Noisy accounts are often highly engaged; silent accounts are already testing alternatives.
* **Source:** [Gainsight Customer Health Scoring Best Practices](https://www.gainsight.com/customer-success-best-practices/customer-health-scorecard-rules/)

### B. Zendesk (Support Analytics)
* **Methodology:** Zendesk uses ticket sentiment trends and escalation counts to flag accounts at risk. A sudden increase in ticket escalation rate (e.g., tickets transferred to Tier 2/3 engineering) correlates strongly with immediate churn.
* **Key Design Pattern:** Sentiment decline. Zendesk’s automated sentiment models look at the moving average of the last 3-5 tickets rather than historical life-of-account averages, since recent interactions dominate customer perception.
* **Source:** [Zendesk Customer Satisfaction (CSAT) and Risk Metrics](https://support.zendesk.com/hc/en-us/articles/4408828347802)

### C. Stripe / Shopify Churn Management
* **Methodology:** Enterprise payment platforms use historical contact gaps tailored to merchant size. A high-tier enterprise merchant has a much shorter expected contact gap than a self-serve merchant.
* **Key Design Pattern:** Dynamic Baselines. Instead of hard-coding a "silent threshold" (e.g., 30 days without contact), Stripe correlates contact gaps against each merchant's own historic average gap to prevent false positives.
* **Source:** [Shopify Partners Churn Mitigation Guides](https://help.shopify.com/en/partners/dashboard/managing-merchants)

---

## 3. Architecture Rationale & Justification

| Core Decision | Rationale | Industry Source / Precedent |
|---|---|---|
| **90-Day Moving Window for Escalation Spike** | Prevents false positives by baseline-comparing current 90-day activity with the prior 90-180 day period, accounting for seasonal spikes. | *Gainsight Customer Health Scoring Rules* |
| **Individualized Contact Gap Baseline** | A hard-coded baseline (e.g. 14 days) triggers false alarms for low-volume merchants who only write in once a quarter. Using `2 × historical_avg_contact_gap` grounds the alarm in individual merchant behavior. | *Stripe Merchant Support Routing Principles* |
| **Separation of Score vs. Action** | The risk score determines sorting priority and urgency (High/Medium/Low), but only the highest-priority individual signal determines the recommended next step. A blended score doesn't provide operational clarity. | *Harvard Business Review: Why Blended Risk Scores Fail CX Teams* |
