import { describe, it, expect } from "vitest";

// ─── Utility Tests ─────────────────────────────────────────────

describe("Utility Functions", () => {
  describe("formatDate", () => {
    it("should format date components to YYYY-MM-DD string", () => {
      const formatDate = (year: number, month: number, day: number) =>
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      expect(formatDate(2026, 0, 1)).toBe("2026-01-01");
      expect(formatDate(2026, 11, 31)).toBe("2026-12-31");
      expect(formatDate(2026, 1, 15)).toBe("2026-02-15");
    });
  });

  describe("getDaysInMonth", () => {
    it("should return correct days for each month", () => {
      const getDaysInMonth = (year: number, month: number) =>
        new Date(year, month + 1, 0).getDate();

      expect(getDaysInMonth(2026, 0)).toBe(31); // January
      expect(getDaysInMonth(2026, 1)).toBe(28); // February (non-leap)
      expect(getDaysInMonth(2024, 1)).toBe(29); // February (leap)
      expect(getDaysInMonth(2026, 3)).toBe(30); // April
    });
  });

  describe("getFirstDayOfMonth", () => {
    it("should return correct first day of month", () => {
      const getFirstDayOfMonth = (year: number, month: number) =>
        new Date(year, month, 1).getDay();

      // February 2026 starts on Sunday (0)
      expect(getFirstDayOfMonth(2026, 1)).toBe(0);
    });
  });
});

// ─── Currency Formatting Tests ─────────────────────────────────

describe("Currency Formatting", () => {
  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "—";
    const num = parseFloat(value);
    if (isNaN(num)) return "—";
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const formatShortCurrency = (value: string | null | undefined) => {
    if (!value) return "$0";
    const num = parseFloat(value);
    if (isNaN(num)) return "$0";
    if (num >= 1000000) return "$" + (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return "$" + (num / 1000).toFixed(0) + "K";
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0 });
  };

  it("should format null/undefined as dash", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency("")).toBe("—");
  });

  it("should format NaN as dash", () => {
    expect(formatCurrency("abc")).toBe("—");
  });

  it("should format valid numbers with dollar sign", () => {
    expect(formatCurrency("50000")).toBe("$50,000");
    expect(formatCurrency("1000000")).toBe("$1,000,000");
  });

  it("should format short currency with K/M suffixes", () => {
    expect(formatShortCurrency("500")).toBe("$500");
    expect(formatShortCurrency("5000")).toBe("$5K");
    expect(formatShortCurrency("50000")).toBe("$50K");
    expect(formatShortCurrency("1500000")).toBe("$1.5M");
  });

  it("should handle null/undefined for short currency", () => {
    expect(formatShortCurrency(null)).toBe("$0");
    expect(formatShortCurrency(undefined)).toBe("$0");
  });
});

// ─── Status/Stage Label Tests ──────────────────────────────────

describe("Status and Stage Labels", () => {
  const getStatusLabel = (status: string) =>
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  it("should convert snake_case status to Title Case", () => {
    expect(getStatusLabel("draft")).toBe("Draft");
    expect(getStatusLabel("submitted")).toBe("Submitted");
    expect(getStatusLabel("under_review")).toBe("Under Review");
    expect(getStatusLabel("won")).toBe("Won");
    expect(getStatusLabel("lost")).toBe("Lost");
  });

  it("should convert snake_case stage to Title Case", () => {
    expect(getStatusLabel("lead")).toBe("Lead");
    expect(getStatusLabel("qualified")).toBe("Qualified");
    expect(getStatusLabel("proposal")).toBe("Proposal");
    expect(getStatusLabel("negotiation")).toBe("Negotiation");
    expect(getStatusLabel("closed_won")).toBe("Closed Won");
    expect(getStatusLabel("closed_lost")).toBe("Closed Lost");
  });
});

// ─── Days Until Deadline Tests ─────────────────────────────────

describe("Days Until Deadline", () => {
  const daysUntil = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const diff = Math.ceil(
      (new Date(deadline + "T23:59:59").getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  it("should return null for null/undefined deadline", () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });

  it("should return a number for valid date", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split("T")[0];
    const result = daysUntil(dateStr);
    expect(result).toBeGreaterThanOrEqual(10);
    expect(result).toBeLessThanOrEqual(12);
  });

  it("should return negative for past dates", () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 5);
    const dateStr = pastDate.toISOString().split("T")[0];
    const result = daysUntil(dateStr);
    expect(result).toBeLessThan(0);
  });
});

// ─── Greeting Tests ────────────────────────────────────────────

describe("Greeting Logic", () => {
  it("should return a valid greeting string", () => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return "Good Morning";
      if (hour < 17) return "Good Afternoon";
      return "Good Evening";
    };

    const greeting = getGreeting();
    expect(["Good Morning", "Good Afternoon", "Good Evening"]).toContain(greeting);
  });
});

// ─── Pipeline Stats Tests ──────────────────────────────────────

describe("Pipeline Stats Calculation", () => {
  const calculateStats = (data: Array<{ stage: string; value: string | null }>) => {
    const openDeals = data.filter((d) => d.stage !== "closed_won" && d.stage !== "closed_lost");
    const wonDeals = data.filter((d) => d.stage === "closed_won");
    const lostDeals = data.filter((d) => d.stage === "closed_lost");
    const totalPipeline = openDeals.reduce((sum, d) => sum + (parseFloat(d.value || "0") || 0), 0);
    const wonValue = wonDeals.reduce((sum, d) => sum + (parseFloat(d.value || "0") || 0), 0);
    const closedCount = wonDeals.length + lostDeals.length;
    const winRate = closedCount > 0 ? Math.round((wonDeals.length / closedCount) * 100) : 0;
    return { totalPipeline, wonValue, openCount: openDeals.length, winRate, totalCount: data.length };
  };

  it("should calculate pipeline stats correctly", () => {
    const deals = [
      { stage: "lead", value: "10000" },
      { stage: "proposal", value: "25000" },
      { stage: "closed_won", value: "50000" },
      { stage: "closed_lost", value: "15000" },
    ];

    const stats = calculateStats(deals);
    expect(stats.totalPipeline).toBe(35000);
    expect(stats.wonValue).toBe(50000);
    expect(stats.openCount).toBe(2);
    expect(stats.winRate).toBe(50);
    expect(stats.totalCount).toBe(4);
  });

  it("should handle empty deals array", () => {
    const stats = calculateStats([]);
    expect(stats.totalPipeline).toBe(0);
    expect(stats.wonValue).toBe(0);
    expect(stats.openCount).toBe(0);
    expect(stats.winRate).toBe(0);
    expect(stats.totalCount).toBe(0);
  });

  it("should handle null values", () => {
    const deals = [
      { stage: "lead", value: null },
      { stage: "qualified", value: "5000" },
    ];

    const stats = calculateStats(deals);
    expect(stats.totalPipeline).toBe(5000);
    expect(stats.openCount).toBe(2);
  });
});

// ─── Action Parsing Tests ──────────────────────────────────────

describe("AI Action Parsing", () => {
  it("should extract action tags from AI response", () => {
    const aiContent = `Sure, I'll create that event for you!
<action>{"type": "create_event", "data": {"title": "Team Meeting", "date": "2026-02-20", "startTime": "14:00", "endTime": "15:00"}}</action>
Your meeting has been scheduled.`;

    const actionRegex = /<action>(.*?)<\/action>/gs;
    const actions: Array<{ type: string; data: unknown }> = [];
    let match;
    while ((match = actionRegex.exec(aiContent)) !== null) {
      actions.push(JSON.parse(match[1]));
    }

    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("create_event");
    expect((actions[0].data as any).title).toBe("Team Meeting");
  });

  it("should handle multiple actions", () => {
    const aiContent = `I'll set that up!
<action>{"type": "create_event", "data": {"title": "Call", "date": "2026-02-20"}}</action>
<action>{"type": "create_rfp", "data": {"clientName": "Acme", "title": "Website Redesign"}}</action>
Done!`;

    const actionRegex = /<action>(.*?)<\/action>/gs;
    const actions: Array<{ type: string; data: unknown }> = [];
    let match;
    while ((match = actionRegex.exec(aiContent)) !== null) {
      actions.push(JSON.parse(match[1]));
    }

    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe("create_event");
    expect(actions[1].type).toBe("create_rfp");
  });

  it("should clean action tags from display content", () => {
    const aiContent = `Sure! <action>{"type":"create_event","data":{"title":"Test"}}</action> Done!`;
    const cleanContent = aiContent.replace(/<action>.*?<\/action>/gs, "").trim();
    expect(cleanContent).toBe("Sure!  Done!");
  });

  it("should handle response with no actions", () => {
    const aiContent = "You have 3 events scheduled for tomorrow.";
    const actionRegex = /<action>(.*?)<\/action>/gs;
    const actions: Array<{ type: string; data: unknown }> = [];
    let match;
    while ((match = actionRegex.exec(aiContent)) !== null) {
      actions.push(JSON.parse(match[1]));
    }

    expect(actions).toHaveLength(0);
  });
});

// ─── RFP Filter Tests ──────────────────────────────────────────

describe("RFP Filtering", () => {
  const rfps = [
    { id: 1, status: "draft", title: "RFP A" },
    { id: 2, status: "submitted", title: "RFP B" },
    { id: 3, status: "under_review", title: "RFP C" },
    { id: 4, status: "won", title: "RFP D" },
    { id: 5, status: "draft", title: "RFP E" },
  ];

  it("should return all RFPs when filter is 'all'", () => {
    const filter = "all";
    const result = filter === "all" ? rfps : rfps.filter((r) => r.status === filter);
    expect(result).toHaveLength(5);
  });

  it("should filter by specific status", () => {
    const filter = "draft";
    const result = rfps.filter((r) => r.status === filter);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "draft")).toBe(true);
  });

  it("should return empty for status with no matches", () => {
    const filter = "lost";
    const result = rfps.filter((r) => r.status === filter);
    expect(result).toHaveLength(0);
  });
});
