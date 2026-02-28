/**
 * Generates an HTML string for the Daily Attack Plan PDF.
 * Used with expo-print's printToFileAsync to create a PDF on-device.
 * This avoids the need to call the server and transfer large base64 data.
 */

import type { LocalEvent, LocalRfp, LocalDeal } from "@/lib/local-store";

function formatTime12(time: string | undefined): string {
  if (!time) return "";
  const parts = time.split(":");
  if (parts.length < 2) return time;
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return time;
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${ampm}`;
}

function formatCurrency(value: string | undefined): string {
  if (!value) return "";
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0 });
}

function getStageLabel(stage: string): string {
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T23:59:59");
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

type AttackPlanInput = {
  events: LocalEvent[];
  rfps: LocalRfp[];
  deals: LocalDeal[];
  date: string;
};

export function generateAttackPlanHTML(data: AttackPlanInput): string {
  const todayEvents = data.events
    .filter((e) => e.date === data.date)
    .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const activeRfps = data.rfps.filter((r) => r.status !== "sold");
  const urgentRfps = activeRfps.filter((r) => {
    if (!r.effectiveDate) return false;
    const d = daysUntil(r.effectiveDate);
    return d >= 0 && d <= 14;
  });

  const openDeals = data.deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
  const hotDeals = openDeals.filter((d) => {
    if (!d.expectedCloseDate) return false;
    const d2 = daysUntil(d.expectedCloseDate);
    return d2 >= 0 && d2 <= 14;
  });

  const totalPipeline = openDeals.reduce((sum, d) => sum + (parseFloat(d.value || "0") || 0), 0);

  // Build action items
  const actionItems: string[] = [];
  urgentRfps.forEach((r) => {
    const dl = r.effectiveDate ? daysUntil(r.effectiveDate) : 99;
    actionItems.push(`RFP: "${r.title}" — Broker: ${r.client} — effective date ${dl === 0 ? "TODAY" : dl === 1 ? "tomorrow" : "in " + dl + " days"}`);
  });
  hotDeals.forEach((d) => {
    const dl = d.expectedCloseDate ? daysUntil(d.expectedCloseDate) : 99;
    actionItems.push(`Deal: "${d.title}" with ${d.client} (${formatCurrency(d.value)}) — closing in ${dl} days`);
  });
  const followUpEvents = todayEvents.filter((e) =>
    e.title.toLowerCase().includes("follow") ||
    e.title.toLowerCase().includes("remind") ||
    e.title.toLowerCase().includes("check in")
  );
  followUpEvents.forEach((e) => {
    actionItems.push(`Follow-up: ${e.title}${e.startTime ? " at " + formatTime12(e.startTime) : ""}`);
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #374151;
      font-size: 11px;
      line-height: 1.4;
      padding: 0;
    }
    .page {
      padding: 40px 50px;
      max-width: 100%;
    }
    .accent-bar {
      height: 5px;
      background: #2563EB;
      margin: -40px -50px 20px -50px;
    }
    .confidential {
      text-align: right;
      font-size: 9px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    h1 {
      font-size: 24px;
      color: #1A2B4A;
      font-weight: 700;
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }
    .date-line {
      font-size: 11px;
      color: #6B7280;
      margin-bottom: 16px;
    }
    .divider {
      height: 2px;
      background: #2563EB;
      margin-bottom: 16px;
    }
    /* Executive Summary Box */
    .summary-box {
      background: #F0F4FF;
      border-left: 3px solid #2563EB;
      padding: 12px 16px;
      margin-bottom: 20px;
      border-radius: 0 4px 4px 0;
    }
    .summary-title {
      font-size: 9px;
      color: #6B7280;
      font-weight: 700;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .stats-row {
      display: flex;
      justify-content: space-between;
    }
    .stat {
      text-align: left;
    }
    .stat-number {
      font-size: 20px;
      font-weight: 700;
      color: #1A2B4A;
    }
    .stat-label {
      font-size: 8px;
      color: #6B7280;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    /* Section Headers */
    .section-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
      margin-top: 16px;
    }
    .section-bar {
      width: 4px;
      height: 16px;
      border-radius: 2px;
      margin-right: 8px;
      display: inline-block;
    }
    .section-bar.blue { background: #2563EB; }
    .section-bar.orange { background: #D97706; }
    .section-bar.green { background: #059669; }
    .section-bar.red { background: #DC2626; }
    .section-title {
      font-size: 12px;
      font-weight: 700;
      color: #1A2B4A;
      letter-spacing: 0.3px;
    }
    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      font-size: 8px;
      color: #6B7280;
      font-weight: 700;
      text-align: left;
      padding: 4px 6px;
      border-bottom: 1px solid #E5E7EB;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      font-size: 9px;
      padding: 6px;
      border-bottom: 1px solid #F3F4F6;
      vertical-align: top;
    }
    .text-navy { color: #1A2B4A; font-weight: 600; }
    .text-blue { color: #2563EB; font-weight: 600; }
    .text-orange { color: #D97706; font-weight: 600; }
    .text-green { color: #059669; font-weight: 600; }
    .text-red { color: #DC2626; font-weight: 600; }
    .text-muted { color: #6B7280; }
    .text-dark { color: #374151; }
    .empty-message {
      font-size: 10px;
      color: #6B7280;
      font-style: italic;
      padding: 8px 0;
    }
    /* Action Items */
    .action-item {
      display: flex;
      align-items: flex-start;
      margin-bottom: 6px;
    }
    .checkbox {
      width: 11px;
      height: 11px;
      border: 1px solid #6B7280;
      border-radius: 2px;
      margin-right: 8px;
      margin-top: 1px;
      flex-shrink: 0;
    }
    .action-text {
      font-size: 9px;
      color: #374151;
    }
    /* Footer */
    .footer {
      margin-top: 24px;
      padding-top: 8px;
      border-top: 1px solid #2563EB;
      display: flex;
      justify-content: space-between;
      font-size: 7px;
      color: #6B7280;
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="accent-bar"></div>
    <div class="confidential">CONFIDENTIAL</div>
    <h1>DAILY ATTACK PLAN</h1>
    <div class="date-line">${formatDateLong(data.date)}</div>
    <div class="divider"></div>

    <!-- Executive Summary -->
    <div class="summary-box">
      <div class="summary-title">EXECUTIVE SUMMARY</div>
      <div class="stats-row">
        <div class="stat">
          <div class="stat-number">${todayEvents.length}</div>
          <div class="stat-label">MEETINGS</div>
        </div>
        <div class="stat">
          <div class="stat-number">${activeRfps.length}</div>
          <div class="stat-label">ACTIVE RFPs</div>
        </div>
        <div class="stat">
          <div class="stat-number">${openDeals.length}</div>
          <div class="stat-label">OPEN DEALS</div>
        </div>
        <div class="stat">
          <div class="stat-number">${formatCurrency(totalPipeline.toString()) || "$0"}</div>
          <div class="stat-label">PIPELINE VALUE</div>
        </div>
      </div>
    </div>

    <!-- Today's Schedule -->
    <div class="section-header">
      <span class="section-bar blue"></span>
      <span class="section-title">TODAY'S SCHEDULE</span>
    </div>
    ${todayEvents.length === 0
      ? '<div class="empty-message">No meetings or events scheduled for today.</div>'
      : `<table>
        <thead><tr><th style="width:25%">TIME</th><th style="width:35%">EVENT</th><th>DETAILS</th></tr></thead>
        <tbody>
          ${todayEvents.map((e) => `<tr>
            <td class="text-blue">${e.startTime ? formatTime12(e.startTime) + (e.endTime ? " - " + formatTime12(e.endTime) : "") : "All Day"}</td>
            <td class="text-navy">${e.title}</td>
            <td class="text-muted">${e.description || "—"}</td>
          </tr>`).join("")}
        </tbody>
      </table>`
    }

    <!-- RFP Pipeline -->
    <div class="section-header">
      <span class="section-bar orange"></span>
      <span class="section-title">RFP PIPELINE</span>
    </div>
    ${activeRfps.length === 0
      ? '<div class="empty-message">No active RFPs in the pipeline.</div>'
      : `<table>
        <thead><tr><th>CASE</th><th>BROKER</th><th>LIVES</th><th>EFF. DATE</th><th>PREMIUM</th><th>STATUS</th></tr></thead>
        <tbody>
          ${activeRfps.map((r) => {
            const statusClass = r.status === "recommended" ? "text-blue" : r.status === "sold" ? "text-green" : "text-muted";
            return `<tr>
              <td class="text-navy">${r.title}</td>
              <td class="text-dark">${r.client}${r.brokerContact ? ` (${r.brokerContact})` : ""}</td>
              <td class="text-dark">${r.lives != null ? r.lives : "—"}</td>
              <td class="text-dark">${r.effectiveDate || "—"}</td>
              <td class="text-dark">${formatCurrency(r.premium) || "—"}</td>
              <td class="${statusClass}">${getStatusLabel(r.status).toUpperCase()}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`
    }

    <!-- Sales Pipeline -->
    <div class="section-header">
      <span class="section-bar green"></span>
      <span class="section-title">SALES PIPELINE</span>
    </div>
    ${openDeals.length === 0
      ? '<div class="empty-message">No open deals in the pipeline.</div>'
      : `<table>
        <thead><tr><th>CLIENT</th><th>DEAL</th><th>STAGE</th><th>VALUE</th><th>CLOSE DATE</th></tr></thead>
        <tbody>
          ${openDeals.map((d) => {
            const dl = d.expectedCloseDate ? daysUntil(d.expectedCloseDate) : null;
            const dateClass = dl !== null && dl <= 3 ? "text-red" : dl !== null && dl <= 7 ? "text-orange" : "text-muted";
            const dateText = dl === null ? "—" : dl === 0 ? "TODAY" : `${dl} days`;
            const stageClass = d.stage === "negotiation" ? "text-orange" : d.stage === "proposal" ? "text-blue" : "text-muted";
            return `<tr>
              <td class="text-navy">${d.client}</td>
              <td class="text-dark">${d.title}</td>
              <td class="${stageClass}">${getStageLabel(d.stage).toUpperCase()}</td>
              <td class="text-navy">${formatCurrency(d.value) || "—"}</td>
              <td class="${dateClass}">${dateText}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>`
    }

    <!-- Key Action Items -->
    <div class="section-header">
      <span class="section-bar red"></span>
      <span class="section-title">KEY ACTION ITEMS</span>
    </div>
    ${actionItems.length === 0
      ? '<div class="empty-message">No urgent action items for today. Stay proactive!</div>'
      : actionItems.map((item) => `<div class="action-item">
          <div class="checkbox"></div>
          <div class="action-text">${item}</div>
        </div>`).join("")
    }

    <!-- Footer -->
    <div class="footer">
      <span>SalesEdge — Daily Attack Plan — ${formatDateLong(data.date)}</span>
    </div>
  </div>
</body>
</html>`;
}
