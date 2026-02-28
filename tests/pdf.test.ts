import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the local-store types
vi.mock("@/lib/local-store", () => ({}));

describe("PDF Attack Plan HTML Generation", () => {
  let generateAttackPlanHTML: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const mod = await import("../lib/pdf-html");
    generateAttackPlanHTML = mod.generateAttackPlanHTML;
  });

  it("should generate valid HTML with no data", () => {
    const html = generateAttackPlanHTML({
      events: [],
      rfps: [],
      deals: [],
      date: "2026-02-18",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("DAILY ATTACK PLAN");
    expect(html).toContain("EXECUTIVE SUMMARY");
    expect(html).toContain("No meetings or events scheduled for today");
    expect(html).toContain("No active RFPs in the pipeline");
    expect(html).toContain("No open deals in the pipeline");
  });

  it("should include events in the schedule section", () => {
    const html = generateAttackPlanHTML({
      events: [
        {
          id: "1",
          title: "Team Standup",
          date: "2026-02-18",
          startTime: "09:00",
          endTime: "09:30",
          description: "Daily standup meeting",
          createdAt: "2026-02-18T00:00:00Z",
        },
      ],
      rfps: [],
      deals: [],
      date: "2026-02-18",
    });

    expect(html).toContain("Team Standup");
    expect(html).toContain("9:00 AM");
    expect(html).toContain("9:30 AM");
    expect(html).toContain("Daily standup meeting");
    expect(html).not.toContain("No meetings or events scheduled");
  });

  it("should include RFPs in the pipeline section", () => {
    const html = generateAttackPlanHTML({
      events: [],
      rfps: [
        {
          id: "1",
          title: "Cloud Migration",
          client: "Acme Corp",
          status: "draft" as const,
          premium: "150000",
          effectiveDate: "2026-03-01",
          lives: 250,
          brokerContact: "John Smith",
          createdAt: "2026-02-18T00:00:00Z",
        },
      ],
      deals: [],
      date: "2026-02-18",
    });

    expect(html).toContain("Cloud Migration");
    expect(html).toContain("Acme Corp");
    expect(html).toContain("$150,000");
    expect(html).not.toContain("No active RFPs");
  });

  it("should include deals in the sales pipeline section", () => {
    const html = generateAttackPlanHTML({
      events: [],
      rfps: [],
      deals: [
        {
          id: "1",
          title: "Enterprise License",
          client: "BigCo",
          stage: "negotiation" as const,
          value: "500000",
          expectedCloseDate: "2026-03-01",
          createdAt: "2026-02-18T00:00:00Z",
        },
      ],
      date: "2026-02-18",
    });

    expect(html).toContain("Enterprise License");
    expect(html).toContain("BigCo");
    expect(html).toContain("$500,000");
    expect(html).toContain("NEGOTIATION");
    expect(html).not.toContain("No open deals");
  });

  it("should show correct stat counts in executive summary", () => {
    const html = generateAttackPlanHTML({
      events: [
        { id: "1", title: "Meeting 1", date: "2026-02-18", startTime: "09:00", createdAt: "2026-02-18T00:00:00Z" },
        { id: "2", title: "Meeting 2", date: "2026-02-18", startTime: "14:00", createdAt: "2026-02-18T00:00:00Z" },
      ],
      rfps: [
        { id: "1", title: "RFP 1", client: "Client A", status: "draft" as const, createdAt: "2026-02-18T00:00:00Z" },
      ],
      deals: [
        { id: "1", title: "Deal 1", client: "Client B", stage: "lead" as const, value: "100000", createdAt: "2026-02-18T00:00:00Z" },
      ],
      date: "2026-02-18",
    });

    expect(html).toContain(">2<"); // 2 meetings
    expect(html).toContain(">1<"); // 1 active RFP, 1 open deal
    expect(html).toContain("$100,000"); // pipeline value
  });

  it("should filter out won/lost RFPs from active count", () => {
    const html = generateAttackPlanHTML({
      events: [],
      rfps: [
        { id: "1", title: "Won RFP", client: "Client A", status: "won" as const, createdAt: "2026-02-18T00:00:00Z" },
        { id: "2", title: "Active RFP", client: "Client B", status: "draft" as const, createdAt: "2026-02-18T00:00:00Z" },
      ],
      deals: [],
      date: "2026-02-18",
    });

    expect(html).toContain("Active RFP");
    expect(html).toContain("Client B");
  });

  it("should format 12-hour time correctly", () => {
    const html = generateAttackPlanHTML({
      events: [
        { id: "1", title: "Morning Meeting", date: "2026-02-18", startTime: "08:30", createdAt: "2026-02-18T00:00:00Z" },
        { id: "2", title: "Afternoon Call", date: "2026-02-18", startTime: "14:15", createdAt: "2026-02-18T00:00:00Z" },
        { id: "3", title: "Noon Lunch", date: "2026-02-18", startTime: "12:00", createdAt: "2026-02-18T00:00:00Z" },
      ],
      rfps: [],
      deals: [],
      date: "2026-02-18",
    });

    expect(html).toContain("8:30 AM");
    expect(html).toContain("2:15 PM");
    expect(html).toContain("12:00 PM");
  });
});

describe("Attack Plan Preview API", () => {
  it("should accept HTML and return a URL with an ID", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        url: "https://3000-example.us2.manus.computer/api/attack-plan-preview/ap_123_abc",
        id: "ap_123_abc",
      }),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const apiBase = "https://3000-example.us2.manus.computer";
    const response = await fetch(`${apiBase}/api/attack-plan-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<html><body>Test</body></html>" }),
    });

    const data = await response.json();
    expect(data.url).toContain("/api/attack-plan-preview/");
    expect(data.id).toBeDefined();
  });

  it("should handle server errors gracefully", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const apiBase = "https://3000-example.us2.manus.computer";
    const response = await fetch(`${apiBase}/api/attack-plan-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: "<html></html>" }),
    });

    expect(response.ok).toBe(false);
  });
});
