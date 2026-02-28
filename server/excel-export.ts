/**
 * Excel export routes — generates .xlsx files from client-submitted data.
 * The client sends JSON arrays; the server builds an Excel workbook and
 * either returns it as a download or stores it temporarily for browser access.
 */

import { type Express, type Request, type Response } from "express";
import ExcelJS from "exceljs";

// ─── Temporary file store (same pattern as attack-plan-preview) ──────
const excelStore = new Map<string, { buffer: Buffer; filename: string; createdAt: number }>();

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of excelStore) {
    if (now - value.createdAt > 30 * 60 * 1000) {
      excelStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

// ─── Style helpers ───────────────────────────────────────────────────
const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1A56DB" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 12,
};

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFD1D5DB" } },
  bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
  left: { style: "thin", color: { argb: "FFD1D5DB" } },
  right: { style: "thin", color: { argb: "FFD1D5DB" } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = BORDER_STYLE;
  });
  row.height = 28;
}

function styleDataRow(row: ExcelJS.Row, even: boolean) {
  row.eachCell((cell) => {
    cell.border = BORDER_STYLE;
    cell.alignment = { vertical: "middle", wrapText: true };
    if (even) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };
    }
  });
}

function formatDateStr(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(val?: string): string {
  if (!val) return "";
  const num = parseFloat(val.replace(/[^0-9.-]/g, ""));
  if (isNaN(num)) return val;
  return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Build RFP workbook ──────────────────────────────────────────────
async function buildRfpWorkbook(rfps: any[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SalesEdge";
  wb.created = new Date();

  // Active RFPs sheet (draft + recommended)
  const activeRfps = rfps.filter((r: any) => r.status !== "sold");
  const activeSheet = wb.addWorksheet("Active RFPs");
  activeSheet.columns = [
    { header: "Case", key: "case", width: 28 },
    { header: "Broker", key: "broker", width: 22 },
    { header: "Broker Contact", key: "brokerContact", width: 22 },
    { header: "Lives", key: "lives", width: 12 },
    { header: "Effective Date", key: "effectiveDate", width: 18 },
    { header: "Premium", key: "premium", width: 18 },
    { header: "Status", key: "status", width: 16 },
    { header: "Notes", key: "notes", width: 35 },
  ];
  styleHeader(activeSheet.getRow(1));

  activeRfps.forEach((rfp: any, idx: number) => {
    const row = activeSheet.addRow({
      case: rfp.title || "",
      broker: rfp.client || "",
      brokerContact: rfp.brokerContact || "",
      lives: rfp.lives != null ? rfp.lives : "",
      effectiveDate: formatDateStr(rfp.effectiveDate),
      premium: formatCurrency(rfp.premium),
      status: (rfp.status || "draft").charAt(0).toUpperCase() + (rfp.status || "draft").slice(1),
      notes: rfp.notes || "",
    });
    styleDataRow(row, idx % 2 === 0);
  });

  // Sold cases sheet
  const soldRfps = rfps.filter((r: any) => r.status === "sold");
  const soldSheet = wb.addWorksheet("Sold Cases");
  soldSheet.columns = [
    { header: "Case", key: "case", width: 28 },
    { header: "Broker", key: "broker", width: 22 },
    { header: "Broker Contact", key: "brokerContact", width: 22 },
    { header: "Lives", key: "lives", width: 12 },
    { header: "Effective Date", key: "effectiveDate", width: 18 },
    { header: "Premium", key: "premium", width: 18 },
    { header: "Notes", key: "notes", width: 35 },
  ];
  styleHeader(soldSheet.getRow(1));

  soldRfps.forEach((rfp: any, idx: number) => {
    const row = soldSheet.addRow({
      case: rfp.title || "",
      broker: rfp.client || "",
      brokerContact: rfp.brokerContact || "",
      lives: rfp.lives != null ? rfp.lives : "",
      effectiveDate: formatDateStr(rfp.effectiveDate),
      premium: formatCurrency(rfp.premium),
      notes: rfp.notes || "",
    });
    styleDataRow(row, idx % 2 === 0);
  });

  return wb;
}

// ─── Build Schedule workbook ─────────────────────────────────────────
async function buildScheduleWorkbook(events: any[]): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SalesEdge";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Schedule");
  sheet.columns = [
    { header: "Date", key: "date", width: 18 },
    { header: "Time", key: "time", width: 14 },
    { header: "Event", key: "title", width: 30 },
    { header: "Description", key: "description", width: 40 },
  ];
  styleHeader(sheet.getRow(1));

  // Sort by date then time
  const sorted = [...events].sort((a: any, b: any) => {
    const dateCompare = (a.date || "").localeCompare(b.date || "");
    if (dateCompare !== 0) return dateCompare;
    return (a.startTime || "").localeCompare(b.startTime || "");
  });

  sorted.forEach((evt: any, idx: number) => {
    let timeStr = "";
    if (evt.startTime) {
      try {
        const [h, m] = evt.startTime.split(":");
        const hour = parseInt(h);
        const ampm = hour >= 12 ? "PM" : "AM";
        const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        timeStr = `${h12}:${m} ${ampm}`;
      } catch {
        timeStr = evt.startTime;
      }
    }

    const row = sheet.addRow({
      date: formatDateStr(evt.date),
      time: timeStr,
      title: evt.title || "",
      description: evt.description || "",
    });
    styleDataRow(row, idx % 2 === 0);
  });

  return wb;
}

// ─── Register routes ─────────────────────────────────────────────────
export function registerExcelRoutes(app: Express) {
  // Export RFPs + Sold cases
  app.post("/api/export/rfps", async (req: Request, res: Response) => {
    try {
      const { rfps } = req.body;
      if (!Array.isArray(rfps)) {
        res.status(400).json({ error: "Missing rfps array" });
        return;
      }

      const wb = await buildRfpWorkbook(rfps);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const filename = `SalesEdge_RFPs_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const id = `xl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      excelStore.set(id, { buffer, filename, createdAt: Date.now() });

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const url = `${protocol}://${host}/api/export/download/${id}`;

      res.json({ url, id, filename });
    } catch (err) {
      console.error("Excel export error:", err);
      res.status(500).json({ error: "Failed to generate Excel file" });
    }
  });

  // Export Schedule
  app.post("/api/export/schedule", async (req: Request, res: Response) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events)) {
        res.status(400).json({ error: "Missing events array" });
        return;
      }

      const wb = await buildScheduleWorkbook(events);
      const buffer = Buffer.from(await wb.xlsx.writeBuffer());
      const filename = `SalesEdge_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;

      const id = `xl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      excelStore.set(id, { buffer, filename, createdAt: Date.now() });

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const url = `${protocol}://${host}/api/export/download/${id}`;

      res.json({ url, id, filename });
    } catch (err) {
      console.error("Excel export error:", err);
      res.status(500).json({ error: "Failed to generate Excel file" });
    }
  });

  // Download stored Excel file - serve an HTML page that auto-downloads
  app.get("/api/export/download/:id", (req: Request, res: Response) => {
    const entry = excelStore.get(req.params.id);
    if (!entry) {
      res.status(404).send("<html><body style='font-family:system-ui;text-align:center;padding:60px 20px'><h2>File Expired</h2><p>Please generate a new export from the app.</p></body></html>");
      return;
    }

    // If ?raw=1, serve the actual file for direct download
    if (req.query.raw === "1") {
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${entry.filename}"`);
      res.send(entry.buffer);
      return;
    }

    // Otherwise serve an HTML page that auto-triggers the download
    const downloadUrl = `/api/export/download/${req.params.id}?raw=1`;
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Download ${entry.filename}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; text-align: center; padding: 60px 20px; background: #f8f9fa; margin: 0; }
  .card { background: white; border-radius: 16px; padding: 32px 24px; max-width: 400px; margin: 0 auto; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  h2 { color: #1a1a1a; margin: 0 0 8px; font-size: 22px; }
  p { color: #666; margin: 0 0 24px; font-size: 15px; line-height: 1.5; }
  .filename { background: #f0f0f0; padding: 8px 16px; border-radius: 8px; font-size: 14px; color: #333; margin-bottom: 24px; display: inline-block; word-break: break-all; }
  .btn { display: inline-block; background: #1A56DB; color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-size: 17px; font-weight: 600; }
  .btn:active { opacity: 0.8; }
  .hint { color: #999; font-size: 13px; margin-top: 20px; }
</style>
</head><body>
<div class="card">
  <h2>\u2705 Excel File Ready</h2>
  <p>Your export has been generated.</p>
  <div class="filename">${entry.filename}</div><br><br>
  <a class="btn" href="${downloadUrl}" download="${entry.filename}">Download Excel File</a>
  <p class="hint">Tap the button above to download. On iPhone, tap the download icon (\u2B07\uFE0F) in Safari's toolbar, then tap the file to open in Excel or Numbers.</p>
</div>
<script>setTimeout(function(){window.location.href="${downloadUrl}"},500);</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });
}
