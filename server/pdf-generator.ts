import PDFDocument from "pdfkit";

type EventItem = {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
  reminderMinutes?: number;
};

type RfpItem = {
  title: string;
  client: string;
  status: string;
  value?: string;
  deadline?: string;
  summary?: string;
  notes?: string;
};

type DealItem = {
  title: string;
  client: string;
  stage: string;
  value?: string;
  expectedCloseDate?: string;
};

type AttackPlanData = {
  events: EventItem[];
  rfps: RfpItem[];
  deals: DealItem[];
  date: string;
};

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

// Colors
const NAVY = "#1A2B4A";
const BLUE = "#2563EB";
const DARK_GRAY = "#374151";
const MED_GRAY = "#6B7280";
const LIGHT_GRAY = "#E5E7EB";
const WHITE = "#FFFFFF";
const ORANGE = "#D97706";
const GREEN = "#059669";
const RED = "#DC2626";

export function generateAttackPlanPDF(data: AttackPlanData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const pageWidth = 612 - 100; // letter width minus margins

    // ─── HEADER ──────────────────────────────────────────
    // Top accent line
    doc.rect(0, 0, 612, 6).fill(BLUE);

    // Title block
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor(MED_GRAY).text("CONFIDENTIAL", 50, 30, { align: "right" });

    doc.fontSize(26).fillColor(NAVY).font("Helvetica-Bold")
      .text("DAILY ATTACK PLAN", 50, 55);

    doc.fontSize(11).fillColor(MED_GRAY).font("Helvetica")
      .text(formatDateLong(data.date), 50, 86);

    // Divider
    doc.moveTo(50, 108).lineTo(562, 108).strokeColor(BLUE).lineWidth(2).stroke();

    // ─── EXECUTIVE SUMMARY BOX ───────────────────────────
    const todayEvents = data.events.filter((e) => e.date === data.date);
    const activeRfps = data.rfps.filter((r) => r.status !== "won" && r.status !== "lost");
    const urgentRfps = activeRfps.filter((r) => {
      if (!r.deadline) return false;
      const d = daysUntil(r.deadline);
      return d >= 0 && d <= 7;
    });
    const openDeals = data.deals.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
    const hotDeals = openDeals.filter((d) => {
      if (!d.expectedCloseDate) return false;
      const d2 = daysUntil(d.expectedCloseDate);
      return d2 >= 0 && d2 <= 14;
    });
    const totalPipeline = openDeals.reduce((sum, d) => sum + (parseFloat(d.value || "0") || 0), 0);

    const summaryY = 120;
    doc.rect(50, summaryY, pageWidth, 60).fill("#F0F4FF");
    doc.rect(50, summaryY, 3, 60).fill(BLUE);

    doc.fontSize(9).fillColor(MED_GRAY).font("Helvetica-Bold")
      .text("EXECUTIVE SUMMARY", 65, summaryY + 10);

    const statY = summaryY + 28;
    const statWidth = pageWidth / 4;

    // Stat 1: Meetings
    doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
      .text(String(todayEvents.length), 65, statY);
    doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
      .text("MEETINGS", 65, statY + 20);

    // Stat 2: Active RFPs
    doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
      .text(String(activeRfps.length), 65 + statWidth, statY);
    doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
      .text("ACTIVE RFPs", 65 + statWidth, statY + 20);

    // Stat 3: Open Deals
    doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
      .text(String(openDeals.length), 65 + statWidth * 2, statY);
    doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
      .text("OPEN DEALS", 65 + statWidth * 2, statY + 20);

    // Stat 4: Pipeline
    doc.fontSize(18).fillColor(NAVY).font("Helvetica-Bold")
      .text(formatCurrency(totalPipeline.toString()) || "$0", 65 + statWidth * 3, statY);
    doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
      .text("PIPELINE VALUE", 65 + statWidth * 3, statY + 20);

    let curY = summaryY + 75;

    // ─── SECTION: TODAY'S SCHEDULE ───────────────────────
    curY = drawSectionHeader(doc, "TODAY'S SCHEDULE", curY, BLUE);

    if (todayEvents.length === 0) {
      doc.fontSize(10).fillColor(MED_GRAY).font("Helvetica-Oblique")
        .text("No meetings or events scheduled for today.", 65, curY);
      curY += 20;
    } else {
      // Table header
      doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica-Bold");
      doc.text("TIME", 65, curY);
      doc.text("EVENT", 170, curY);
      doc.text("DETAILS", 380, curY);
      curY += 14;
      doc.moveTo(50, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      curY += 6;

      todayEvents
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""))
        .forEach((event) => {
          if (curY > 700) { doc.addPage(); curY = 50; }

          const timeStr = event.startTime
            ? `${formatTime12(event.startTime)}${event.endTime ? " - " + formatTime12(event.endTime) : ""}`
            : "All Day";

          doc.fontSize(9).fillColor(BLUE).font("Helvetica-Bold")
            .text(timeStr, 65, curY, { width: 100 });
          doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
            .text(event.title, 170, curY, { width: 200 });
          doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
            .text(event.description || "—", 380, curY, { width: 180 });

          curY += Math.max(doc.heightOfString(event.title, { width: 200 }), 16) + 6;

          doc.moveTo(65, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.3).stroke();
          curY += 6;
        });
    }

    curY += 10;

    // ─── SECTION: RFP PIPELINE ───────────────────────────
    if (curY > 640) { doc.addPage(); curY = 50; }
    curY = drawSectionHeader(doc, "RFP PIPELINE", curY, ORANGE);

    if (activeRfps.length === 0) {
      doc.fontSize(10).fillColor(MED_GRAY).font("Helvetica-Oblique")
        .text("No active RFPs in the pipeline.", 65, curY);
      curY += 20;
    } else {
      // Table header
      doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica-Bold");
      doc.text("CLIENT", 65, curY);
      doc.text("RFP TITLE", 180, curY);
      doc.text("STATUS", 370, curY);
      doc.text("VALUE", 440, curY);
      doc.text("DEADLINE", 505, curY);
      curY += 14;
      doc.moveTo(50, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      curY += 6;

      activeRfps.forEach((rfp) => {
        if (curY > 700) { doc.addPage(); curY = 50; }

        const isUrgent = rfp.deadline && daysUntil(rfp.deadline) <= 3;

        doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
          .text(rfp.client, 65, curY, { width: 110 });
        doc.fontSize(9).fillColor(DARK_GRAY).font("Helvetica")
          .text(rfp.title, 180, curY, { width: 185 });

        const statusColor = rfp.status === "submitted" ? BLUE : rfp.status === "under_review" ? ORANGE : MED_GRAY;
        doc.fontSize(8).fillColor(statusColor).font("Helvetica-Bold")
          .text(getStatusLabel(rfp.status).toUpperCase(), 370, curY, { width: 65 });

        doc.fontSize(9).fillColor(DARK_GRAY).font("Helvetica")
          .text(formatCurrency(rfp.value) || "—", 440, curY, { width: 60 });

        if (rfp.deadline) {
          const dl = daysUntil(rfp.deadline);
          const deadlineColor = dl <= 2 ? RED : dl <= 5 ? ORANGE : MED_GRAY;
          const deadlineLabel = dl === 0 ? "TODAY" : dl === 1 ? "TOMORROW" : `${dl} days`;
          doc.fontSize(8).fillColor(deadlineColor).font("Helvetica-Bold")
            .text(deadlineLabel, 505, curY, { width: 55 });
        } else {
          doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
            .text("—", 505, curY);
        }

        curY += 18;
        doc.moveTo(65, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.3).stroke();
        curY += 6;
      });
    }

    curY += 10;

    // ─── SECTION: SALES PIPELINE ─────────────────────────
    if (curY > 640) { doc.addPage(); curY = 50; }
    curY = drawSectionHeader(doc, "SALES PIPELINE", curY, GREEN);

    if (openDeals.length === 0) {
      doc.fontSize(10).fillColor(MED_GRAY).font("Helvetica-Oblique")
        .text("No open deals in the pipeline.", 65, curY);
      curY += 20;
    } else {
      // Table header
      doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica-Bold");
      doc.text("CLIENT", 65, curY);
      doc.text("DEAL", 180, curY);
      doc.text("STAGE", 370, curY);
      doc.text("VALUE", 440, curY);
      doc.text("CLOSE DATE", 505, curY);
      curY += 14;
      doc.moveTo(50, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.5).stroke();
      curY += 6;

      openDeals.forEach((deal) => {
        if (curY > 700) { doc.addPage(); curY = 50; }

        doc.fontSize(9).fillColor(NAVY).font("Helvetica-Bold")
          .text(deal.client, 65, curY, { width: 110 });
        doc.fontSize(9).fillColor(DARK_GRAY).font("Helvetica")
          .text(deal.title, 180, curY, { width: 185 });

        const stageColor = deal.stage === "negotiation" ? ORANGE : deal.stage === "proposal" ? BLUE : MED_GRAY;
        doc.fontSize(8).fillColor(stageColor).font("Helvetica-Bold")
          .text(getStageLabel(deal.stage).toUpperCase(), 370, curY, { width: 65 });

        doc.fontSize(9).fillColor(DARK_GRAY).font("Helvetica-Bold")
          .text(formatCurrency(deal.value) || "—", 440, curY, { width: 60 });

        if (deal.expectedCloseDate) {
          const dl = daysUntil(deal.expectedCloseDate);
          const dateColor = dl <= 3 ? RED : dl <= 7 ? ORANGE : MED_GRAY;
          doc.fontSize(8).fillColor(dateColor).font("Helvetica-Bold")
            .text(`${dl} days`, 505, curY, { width: 55 });
        } else {
          doc.fontSize(8).fillColor(MED_GRAY).font("Helvetica")
            .text("—", 505, curY);
        }

        curY += 18;
        doc.moveTo(65, curY).lineTo(562, curY).strokeColor(LIGHT_GRAY).lineWidth(0.3).stroke();
        curY += 6;
      });
    }

    curY += 10;

    // ─── SECTION: KEY ACTION ITEMS ───────────────────────
    if (curY > 640) { doc.addPage(); curY = 50; }
    curY = drawSectionHeader(doc, "KEY ACTION ITEMS", curY, RED);

    const actionItems: string[] = [];

    if (urgentRfps.length > 0) {
      urgentRfps.forEach((r) => {
        const dl = r.deadline ? daysUntil(r.deadline) : 99;
        actionItems.push(`RFP: "${r.title}" for ${r.client} — deadline in ${dl === 0 ? "TODAY" : dl === 1 ? "1 day" : dl + " days"}`);
      });
    }

    if (hotDeals.length > 0) {
      hotDeals.forEach((d) => {
        const dl = d.expectedCloseDate ? daysUntil(d.expectedCloseDate) : 99;
        actionItems.push(`Deal: "${d.title}" with ${d.client} (${formatCurrency(d.value)}) — closing in ${dl} days`);
      });
    }

    const followUpEvents = todayEvents.filter((e) =>
      e.title.toLowerCase().includes("follow") ||
      e.title.toLowerCase().includes("remind") ||
      e.title.toLowerCase().includes("check in")
    );
    followUpEvents.forEach((e) => {
      actionItems.push(`Follow-up: ${e.title}${e.startTime ? " at " + formatTime12(e.startTime) : ""}`);
    });

    if (actionItems.length === 0) {
      doc.fontSize(10).fillColor(MED_GRAY).font("Helvetica-Oblique")
        .text("No urgent action items for today. Stay proactive!", 65, curY);
      curY += 20;
    } else {
      actionItems.forEach((item, i) => {
        if (curY > 720) { doc.addPage(); curY = 50; }
        // Checkbox style
        doc.rect(65, curY + 1, 10, 10).strokeColor(MED_GRAY).lineWidth(0.8).stroke();
        doc.fontSize(9).fillColor(DARK_GRAY).font("Helvetica")
          .text(item, 82, curY, { width: pageWidth - 40 });
        curY += Math.max(doc.heightOfString(item, { width: pageWidth - 40 }), 14) + 4;
      });
    }

    // ─── FOOTER ──────────────────────────────────────────
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
      doc.switchToPage(i);
      // Bottom accent line
      doc.rect(0, 762, 612, 2).fill(BLUE);
      // Footer text
      doc.fontSize(7).fillColor(MED_GRAY).font("Helvetica")
        .text(`SalesEdge — Daily Attack Plan — ${formatDateLong(data.date)}`, 50, 745, { width: pageWidth - 60 })
        .text(`Page ${i + 1} of ${pageCount}`, 50, 745, { align: "right", width: pageWidth });
    }

    doc.end();
  });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number, color: string): number {
  doc.rect(50, y, 4, 18).fill(color);
  doc.fontSize(11).fillColor(NAVY).font("Helvetica-Bold")
    .text(title, 62, y + 2);
  y += 26;
  return y;
}
