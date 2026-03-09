/**
 * Weekly Report Router
 *
 * Provides the sendEnviroSepReport mutation that:
 * 1. Queries client_page_clicks for the past 7 days of EnviroSep data
 * 2. Generates an HTML email with total clicks, resource breakdown, and day-by-day activity
 * 3. Sends via Resend API to jonathan.midura@mutualofomaha.com
 *
 * BUG FIX: The original implementation used `new Date()` directly as a SQL
 * parameter for the end date, which produces the JavaScript `.toString()` format
 * (e.g. "Mon Mar 09 2026 00:00:00 GMT+0000 (Coordinated Universal Time)").
 * MySQL cannot parse this format. The fix uses a helper function `formatDateForSQL`
 * to ensure both start and end dates are formatted as "YYYY-MM-DD HH:MM:SS.sss".
 */
import { publicProcedure, router } from "./_core/trpc";
import { sql } from "drizzle-orm";
import { clientPageClicks } from "../drizzle/schema";

/**
 * Format a JavaScript Date object into a MySQL-compatible datetime string.
 * Returns format: "YYYY-MM-DD HH:MM:SS.sss"
 */
function formatDateForSQL(date: Date): string {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

/**
 * Build the HTML email body for the weekly EnviroSep click report.
 */
function buildReportHtml(
  totalClicks: number,
  resourceBreakdown: { resourceTitle: string; count: number }[],
  dailyActivity: { date: string; count: number }[],
  startDate: string,
  endDate: string,
): string {
  const resourceRows = resourceBreakdown
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${r.resourceTitle}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${r.count}</td></tr>`,
    )
    .join("");

  const dailyRows = dailyActivity
    .map(
      (d) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${d.date}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${d.count}</td></tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:24px;border-radius:12px 12px 0 0;">
    <h1 style="color:#fff;margin:0;font-size:22px;">📊 Weekly EnviroSep Click Report</h1>
    <p style="color:#93c5fd;margin:8px 0 0;font-size:14px;">${startDate} — ${endDate}</p>
  </div>

  <div style="background:#f8fafc;padding:20px;border:1px solid #e2e8f0;">
    <div style="background:#fff;border-radius:8px;padding:16px;text-align:center;margin-bottom:20px;border:1px solid #e2e8f0;">
      <p style="margin:0;font-size:14px;color:#64748b;">Total Clicks</p>
      <p style="margin:4px 0 0;font-size:36px;font-weight:bold;color:#1e3a5f;">${totalClicks}</p>
    </div>

    ${
      resourceBreakdown.length > 0
        ? `
    <h2 style="font-size:16px;color:#1e3a5f;margin:16px 0 8px;">Clicks by Resource</h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#64748b;">Resource</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;">Clicks</th>
        </tr>
      </thead>
      <tbody>${resourceRows}</tbody>
    </table>`
        : ""
    }

    ${
      dailyActivity.length > 0
        ? `
    <h2 style="font-size:16px;color:#1e3a5f;margin:20px 0 8px;">Day-by-Day Activity</h2>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#f1f5f9;">
          <th style="padding:10px 12px;text-align:left;font-size:13px;color:#64748b;">Date</th>
          <th style="padding:10px 12px;text-align:center;font-size:13px;color:#64748b;">Clicks</th>
        </tr>
      </thead>
      <tbody>${dailyRows}</tbody>
    </table>`
        : ""
    }
  </div>

  <div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 12px 12px;">
    <p style="margin:0;">Main Street Insurance — Virtual Benefit Wallet</p>
    <p style="margin:4px 0 0;">Automated weekly report</p>
  </div>
</body>
</html>`;
}

export const weeklyReportRouter = router({
  sendEnviroSepReport: publicProcedure.mutation(async () => {
    // Import getDb lazily to avoid circular dependency issues
    const { getDb } = await import("./db");
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // FIX: Use formatDateForSQL for BOTH dates to ensure MySQL-compatible format
    const startDateSQL = formatDateForSQL(sevenDaysAgo);
    const endDateSQL = formatDateForSQL(now);

    // Query 1: Total clicks in the past 7 days
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(clientPageClicks)
      .where(
        sql`${clientPageClicks.clientSlug} = 'envirosep' AND ${clientPageClicks.createdAt} >= ${startDateSQL} AND ${clientPageClicks.createdAt} < ${endDateSQL}`,
      );
    const totalClicks = totalResult[0]?.count ?? 0;

    // Query 2: Clicks by resource
    const resourceResult = await db
      .select({
        resourceTitle: clientPageClicks.resourceTitle,
        count: sql<number>`count(*)`,
      })
      .from(clientPageClicks)
      .where(
        sql`${clientPageClicks.clientSlug} = 'envirosep' AND ${clientPageClicks.createdAt} >= ${startDateSQL} AND ${clientPageClicks.createdAt} < ${endDateSQL}`,
      )
      .groupBy(clientPageClicks.resourceTitle)
      .orderBy(sql`count(*) DESC`);

    // Query 3: Day-by-day activity
    // FIX: This was the query that failed due to the bad end date format
    const dailyResult = await db
      .select({
        date: sql<string>`DATE(${clientPageClicks.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(clientPageClicks)
      .where(
        sql`${clientPageClicks.clientSlug} = 'envirosep' AND ${clientPageClicks.createdAt} >= ${startDateSQL} AND ${clientPageClicks.createdAt} < ${endDateSQL}`,
      )
      .groupBy(sql`DATE(${clientPageClicks.createdAt})`)
      .orderBy(sql`DATE(${clientPageClicks.createdAt})`);

    const startDateDisplay = sevenDaysAgo.toISOString().split("T")[0];
    const endDateDisplay = now.toISOString().split("T")[0];

    const resourceBreakdown = resourceResult.map((r) => ({
      resourceTitle: r.resourceTitle || "Unknown",
      count: Number(r.count),
    }));

    const dailyActivity = dailyResult.map((d) => ({
      date: String(d.date),
      count: Number(d.count),
    }));

    const html = buildReportHtml(
      Number(totalClicks),
      resourceBreakdown,
      dailyActivity,
      startDateDisplay,
      endDateDisplay,
    );

    // Send via Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Main Street Insurance <reports@mainstreetinsurance.com>",
        to: ["jonathan.midura@mutualofomaha.com"],
        subject: `EnviroSep Weekly Click Report — ${startDateDisplay} to ${endDateDisplay}`,
        html,
      }),
    });

    if (!emailResponse.ok) {
      const detail = await emailResponse.text().catch(() => "");
      throw new Error(
        `Resend API error (${emailResponse.status}): ${detail}`,
      );
    }

    return { success: true };
  }),
});
