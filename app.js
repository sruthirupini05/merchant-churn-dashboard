/**
 * app.js — Dashboard UI Controller
 * Handles rendering, filtering, sorting, and the detail drawer.
 */

// ============================================================
// INIT
// ============================================================
let allMerchants = [];
let filteredMerchants = [];
let currentFilter = "all";
let currentSort   = "score-desc";
let openDrawerMid = null;

document.addEventListener("DOMContentLoaded", () => {
  allMerchants = scoreAllMerchants(MERCHANTS);
  applyFilterAndSort();
  updateHeaderStats();
  bindControls();
});

// ============================================================
// STATS BAR
// ============================================================
function updateHeaderStats() {
  const byTier = { High: 0, Medium: 0, Low: 0 };
  allMerchants.forEach(m => byTier[m.tier.label]++);

  document.getElementById("count-high").textContent   = byTier.High;
  document.getElementById("count-medium").textContent = byTier.Medium;
  document.getElementById("count-low").textContent    = byTier.Low;
  document.getElementById("count-total").textContent  = allMerchants.length;
}

// ============================================================
// FILTER + SORT
// ============================================================
function applyFilterAndSort() {
  const searchVal = document.getElementById("search-input").value.trim().toLowerCase();

  filteredMerchants = allMerchants.filter(m => {
    const tierMatch = currentFilter === "all" || m.tier.label === currentFilter;
    const searchMatch = !searchVal ||
      m.name.toLowerCase().includes(searchVal) ||
      m.merchant_id.toLowerCase().includes(searchVal);
    return tierMatch && searchMatch;
  });

  // Sort
  filteredMerchants.sort((a, b) => {
    switch (currentSort) {
      case "score-desc": return b.score - a.score;
      case "score-asc":  return a.score - b.score;
      case "name-asc":   return a.name.localeCompare(b.name);
      case "tier-asc": {
        const order = { High: 0, Medium: 1, Low: 2 };
        return order[a.tier.label] - order[b.tier.label];
      }
      default: return 0;
    }
  });

  renderTable();
}

// ============================================================
// TABLE RENDERING
// ============================================================
function renderTable() {
  const tbody = document.getElementById("merchant-tbody");
  const empty = document.getElementById("empty-state");
  const table = document.getElementById("merchant-table");

  tbody.innerHTML = "";

  if (filteredMerchants.length === 0) {
    table.classList.add("hidden");
    empty.classList.remove("hidden");
    return;
  }

  table.classList.remove("hidden");
  empty.classList.add("hidden");

  filteredMerchants.forEach(m => {
    const row = document.createElement("tr");
    row.dataset.mid = m.merchant_id;
    row.id = `row-${m.merchant_id}`;

    // Score bar width (cap at 100 for visuals)
    const scoreWidth = Math.min(100, m.score);
    const fillClass = `fill-${m.tier.label.toLowerCase()}`;
    const scoreClass = `score-${m.tier.label.toLowerCase()}`;

    // Active signals
    const activeSigPills = buildSignalPills(m.signals);

    // Action cell
    const actionHtml = m.recommendedAction
      ? `<div class="action-cell">
           <span class="action-label">${m.recommendedAction.icon} ${m.recommendedAction.label}</span>
           <span class="action-text">${m.recommendedAction.text.split("—")[0].trim()}</span>
         </div>`
      : `<span class="action-none">No action needed</span>`;

    const isOpen = openDrawerMid === m.merchant_id;

    row.innerHTML = `
      <td>
        <div class="merchant-cell">
          <span class="merchant-name">${escHtml(m.name)}</span>
          <span class="merchant-id">${escHtml(m.merchant_id)}</span>
        </div>
      </td>
      <td><span class="plan-badge plan-${escHtml(m.plan_tier)}">${escHtml(m.plan_tier)}</span></td>
      <td>
        <div class="score-cell">
          <span class="score-number ${scoreClass}">${m.score}</span>
          <div class="score-bar-track">
            <div class="score-bar-fill ${fillClass}" style="width:${scoreWidth}%"></div>
          </div>
        </div>
      </td>
      <td><span class="tier-badge ${m.tier.cls}">${tierDot(m.tier.label)} ${m.tier.label}</span></td>
      <td><div class="signals-cell">${activeSigPills || '<span class="no-signals">None</span>'}</div></td>
      <td>${actionHtml}</td>
      <td>
        <button class="expand-btn ${isOpen ? "open" : ""}" data-mid="${m.merchant_id}" aria-label="View details for ${escHtml(m.name)}" id="btn-expand-${m.merchant_id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </td>
    `;

    // Click row → open drawer
    row.addEventListener("click", (e) => {
      if (e.target.closest(".expand-btn")) return; // handled separately below
      openDrawer(m.merchant_id);
    });

    // Expand button
    row.querySelector(".expand-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (openDrawerMid === m.merchant_id) {
        closeDrawer();
      } else {
        openDrawer(m.merchant_id);
      }
    });

    tbody.appendChild(row);
  });
}

// ============================================================
// SIGNAL PILLS
// ============================================================
const SIG_META = {
  escalation: { icon: "🚨", label: "Escalation Spike", cls: "sig-escalation" },
  silent:     { icon: "🔇", label: "Went Silent",       cls: "sig-silent"     },
  csat:       { icon: "😞", label: "Low CSAT/NPS",      cls: "sig-csat"       },
  backlog:    { icon: "📋", label: "Backlog",            cls: "sig-backlog"    },
  sentiment:  { icon: "📉", label: "Sentiment ↓",       cls: "sig-sentiment"  },
};

function buildSignalPills(signals) {
  return SIGNAL_PRIORITY
    .filter(key => signals[key])
    .map(key => {
      const s = SIG_META[key];
      return `<span class="sig-pill ${s.cls}">${s.icon} ${s.label}</span>`;
    })
    .join("");
}

// ============================================================
// TIER DOT EMOJI
// ============================================================
function tierDot(label) {
  return label === "High" ? "🔴" : label === "Medium" ? "🟡" : "🟢";
}

// ============================================================
// DETAIL DRAWER
// ============================================================
function openDrawer(mid) {
  const merchant = allMerchants.find(m => m.merchant_id === mid);
  if (!merchant) return;
  openDrawerMid = mid;

  populateDrawer(merchant);

  document.getElementById("drawer-overlay").classList.remove("hidden");
  document.getElementById("detail-drawer").classList.remove("hidden");

  // Mark expand button open
  document.querySelectorAll(".expand-btn").forEach(btn => {
    btn.classList.toggle("open", btn.dataset.mid === mid);
  });
}

function closeDrawer() {
  openDrawerMid = null;
  document.getElementById("drawer-overlay").classList.add("hidden");
  document.getElementById("detail-drawer").classList.add("hidden");
  document.querySelectorAll(".expand-btn").forEach(btn => btn.classList.remove("open"));
}

function populateDrawer(m) {
  document.getElementById("drawer-name").textContent = m.name;
  document.getElementById("drawer-meta").textContent =
    `${m.merchant_id} · ${m.plan_tier} Plan · Signed up ${m.signup_date}`;

  const body = document.getElementById("drawer-body");
  const d = m.derived;

  // ── Score section ──
  const scoreClass = `score-${m.tier.label.toLowerCase()}`;
  const scoreSection = `
    <div class="drawer-section">
      <div class="drawer-section-title">Risk Assessment</div>
      <div class="score-display">
        <span class="score-big ${scoreClass}">${m.score}</span>
        <div class="score-big-info">
          <span class="tier-badge ${m.tier.cls}" style="display:inline-flex; width:fit-content">${tierDot(m.tier.label)} ${m.tier.label} Risk</span>
          <span style="font-size:12px; color:var(--text-muted); margin-top:6px;">Composite score out of 100</span>
        </div>
      </div>
    </div>`;

  // ── Recommended action ──
  const actionSection = m.recommendedAction ? `
    <div class="action-highlight">
      <div class="action-highlight-icon">${m.recommendedAction.icon}</div>
      <div>
        <div class="action-highlight-label">Recommended Next Step</div>
        <div class="action-highlight-text">${escHtml(m.recommendedAction.text)}</div>
      </div>
    </div>` : `
    <div class="action-highlight" style="border-color:var(--low-border); background:var(--low-bg)">
      <div class="action-highlight-icon">✅</div>
      <div>
        <div class="action-highlight-label" style="color:var(--low-text)">No Action Required</div>
        <div class="action-highlight-text">This merchant shows no churn signals. Continue regular monitoring.</div>
      </div>
    </div>`;

  // ── Derived metrics ──
  const fmt = (v, unit = "") => v !== null && v !== undefined ? `${v}${unit}` : '<span class="na">N/A</span>';
  const metricsSection = `
    <div class="drawer-section">
      <div class="drawer-section-title">Derived Metrics</div>
      <div class="metrics-grid">
        <div class="metric-item">
          <span class="metric-label">Tickets (last 30d)</span>
          <span class="metric-value">${fmt(d.support_tickets_30d)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg tickets/month (90d)</span>
          <span class="metric-value">${fmt(d.support_tickets_90d_avg)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Unresolved tickets</span>
          <span class="metric-value ${d.unresolved_ticket_count >= 3 ? 'score-high' : ''}">${fmt(d.unresolved_ticket_count)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Escalations (90d)</span>
          <span class="metric-value ${d.escalation_count_90d >= 3 ? 'score-medium' : ''}">${fmt(d.escalation_count_90d)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Avg sentiment (90d)</span>
          <span class="metric-value ${d.avg_sentiment_score !== null && d.avg_sentiment_score < -0.2 ? 'score-high' : ''}">${fmt(d.avg_sentiment_score)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">CSAT avg (last 5)</span>
          <span class="metric-value ${d.csat_last_5 !== null && d.csat_last_5 < 3 ? 'score-high' : ''}">${fmt(d.csat_last_5, "/5")}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">NPS Score</span>
          <span class="metric-value ${m.nps_score !== null && m.nps_score < 0 ? 'score-high' : ''}">${fmt(m.nps_score)}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Days since contact</span>
          <span class="metric-value ${m.signals.silent ? 'score-high' : ''}">${fmt(d.days_since_last_contact, "d")}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Hist. avg contact gap</span>
          <span class="metric-value">${fmt(d.historical_avg_contact_gap, "d")}</span>
        </div>
        <div class="metric-item">
          <span class="metric-label">Silent threshold (2×)</span>
          <span class="metric-value">${d.historical_avg_contact_gap !== null ? fmt(Math.round(d.historical_avg_contact_gap * 2 * 10)/10, "d") : '<span class="na">N/A</span>'}</span>
        </div>
      </div>
    </div>`;

  // ── Signals breakdown ──
  const signalRows = SIGNAL_PRIORITY.map(key => {
    const s = SIG_META[key];
    const active = m.signals[key];
    const dotCls = active ? `dot-active-${key}` : "dot-inactive";
    const nameCls = active ? "signal-row-active" : "signal-row-inactive";
    const weight = WEIGHTS[key];
    return `
      <div class="signal-row">
        <div class="signal-dot ${dotCls}"></div>
        <div class="signal-row-icon">${s.icon}</div>
        <div class="signal-row-name ${nameCls}">${s.label}</div>
        <div style="font-size:12px; color:${active ? '#f0f4ff' : 'var(--text-muted)'}; font-weight:${active ? '600' : '400'}">
          ${active ? `+${weight}` : `—`}
        </div>
      </div>`;
  }).join("");

  const signalsSection = `
    <div class="drawer-section">
      <div class="drawer-section-title">Signal Breakdown</div>
      ${signalRows}
      <div style="margin-top:12px; padding-top:12px; border-top: 1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:12px; color:var(--text-muted);">Total score</span>
        <span style="font-size:18px; font-weight:700;" class="score-${m.tier.label.toLowerCase()}">${m.score} / 100</span>
      </div>
    </div>`;

  // ── Ticket history ──
  const sortedTickets = [...m.ticket_history].sort((a, b) => new Date(b.date) - new Date(a.date));
  const ticketRows = sortedTickets.map(t => {
    const sentColor = t.sentiment < -0.2 ? "var(--sig-escalation)" : t.sentiment > 0.2 ? "var(--low-text)" : "var(--text-muted)";
    return `
      <div class="ticket-row">
        <span class="ticket-date">${t.date}</span>
        <div class="ticket-badges">
          <span class="ticket-badge ${t.resolved ? 'tb-resolved' : 'tb-unresolved'}">${t.resolved ? "✓ Resolved" : "⚠ Open"}</span>
          ${t.escalated ? '<span class="ticket-badge tb-escalated">🚨 Escalated</span>' : ""}
          <span class="ticket-badge tb-sentiment" style="color:${sentColor}">Snt: ${t.sentiment > 0 ? "+" : ""}${t.sentiment}</span>
          ${t.csat !== null ? `<span class="ticket-badge tb-csat">CSAT ${t.csat}/5</span>` : ""}
        </div>
      </div>`;
  }).join("");

  const historySection = `
    <div class="drawer-section">
      <div class="drawer-section-title">Ticket History (${sortedTickets.length} tickets)</div>
      <div class="ticket-history-list">${ticketRows || '<span style="color:var(--text-muted); font-size:12px;">No tickets on record.</span>'}</div>
    </div>`;

  body.innerHTML = scoreSection + actionSection + metricsSection + signalsSection + historySection;
}

// ============================================================
// CONTROLS BINDING
// ============================================================
function bindControls() {
  // Filter chips
  document.querySelectorAll(".chip").forEach(chip => {
    chip.addEventListener("click", () => {
      currentFilter = chip.dataset.filter;
      document.querySelectorAll(".chip").forEach(c => {
        c.classList.remove("chip-active");
      });
      chip.classList.add("chip-active");
      applyFilterAndSort();
    });
  });

  // Sort
  document.getElementById("sort-select").addEventListener("change", (e) => {
    currentSort = e.target.value;
    applyFilterAndSort();
  });

  // Search
  document.getElementById("search-input").addEventListener("input", () => {
    applyFilterAndSort();
  });

  // Drawer close
  document.getElementById("drawer-close").addEventListener("click", closeDrawer);
  document.getElementById("drawer-overlay").addEventListener("click", closeDrawer);

  // ESC key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && openDrawerMid) closeDrawer();
  });
}

// ============================================================
// UTILS
// ============================================================
function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
