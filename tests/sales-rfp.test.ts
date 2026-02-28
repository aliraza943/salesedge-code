import { describe, it, expect } from "vitest";

/**
 * Tests for the Sales tab integration with sold RFPs.
 *
 * The Sales tab now reads directly from the RFPs collection,
 * filtering for status === "sold", instead of using a separate deals collection.
 */

// Simulate the filtering logic used by the Sales tab
function filterSoldRfps(rfps: Array<{ id: string; title?: string; status: string; premium?: string; lives?: number; createdAt: string }>) {
  return rfps
    .filter((r) => r.status === "sold")
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

function computeStats(soldRfps: Array<{ premium?: string; lives?: number }>) {
  const totalSold = soldRfps.reduce(
    (sum, r) => sum + (parseFloat((r.premium || "0").replace(/[^0-9.-]/g, "")) || 0),
    0
  );
  const totalLives = soldRfps.reduce((sum, r) => sum + (r.lives || 0), 0);
  return { totalSold, totalLives, count: soldRfps.length };
}

describe("Sales Tab — Sold RFPs Integration", () => {
  const sampleRfps = [
    { id: "1", title: "ABC Corp", client: "Smith & Associates", status: "draft", premium: "50000", lives: 100, createdAt: "2026-01-01T00:00:00Z" },
    { id: "2", title: "XYZ Inc", client: "Jones Brokerage", status: "recommended", premium: "75000", lives: 200, createdAt: "2026-01-15T00:00:00Z" },
    { id: "3", title: "Acme LLC", client: "Brown Agency", status: "sold", premium: "120000", lives: 350, createdAt: "2026-02-01T00:00:00Z" },
    { id: "4", title: "Widget Co", client: "Davis Group", status: "sold", premium: "85000", lives: 150, createdAt: "2026-02-10T00:00:00Z" },
    { id: "5", title: "Mega Corp", client: "Wilson Partners", status: "sold", premium: "250000", lives: 500, createdAt: "2026-02-20T00:00:00Z" },
  ];

  it("filters only sold RFPs", () => {
    const sold = filterSoldRfps(sampleRfps);
    expect(sold.length).toBe(3);
    expect(sold.every((r) => r.status === "sold")).toBe(true);
  });

  it("excludes draft and recommended RFPs", () => {
    const sold = filterSoldRfps(sampleRfps);
    expect(sold.find((r) => r.id === "1")).toBeUndefined(); // draft
    expect(sold.find((r) => r.id === "2")).toBeUndefined(); // recommended
  });

  it("sorts sold RFPs by createdAt descending (newest first)", () => {
    const sold = filterSoldRfps(sampleRfps);
    expect(sold[0].id).toBe("5"); // Feb 20
    expect(sold[1].id).toBe("4"); // Feb 10
    expect(sold[2].id).toBe("3"); // Feb 1
  });

  it("computes correct total premium", () => {
    const sold = filterSoldRfps(sampleRfps);
    const stats = computeStats(sold);
    expect(stats.totalSold).toBe(455000); // 120000 + 85000 + 250000
  });

  it("computes correct total lives", () => {
    const sold = filterSoldRfps(sampleRfps);
    const stats = computeStats(sold);
    expect(stats.totalLives).toBe(1000); // 350 + 150 + 500
  });

  it("computes correct deal count", () => {
    const sold = filterSoldRfps(sampleRfps);
    const stats = computeStats(sold);
    expect(stats.count).toBe(3);
  });

  it("handles empty RFP list", () => {
    const sold = filterSoldRfps([]);
    expect(sold.length).toBe(0);
    const stats = computeStats(sold);
    expect(stats.totalSold).toBe(0);
    expect(stats.totalLives).toBe(0);
    expect(stats.count).toBe(0);
  });

  it("handles RFPs with no premium", () => {
    const rfps = [
      { id: "1", title: "No Premium", client: "Test", status: "sold", createdAt: "2026-01-01T00:00:00Z" },
    ];
    const sold = filterSoldRfps(rfps);
    const stats = computeStats(sold);
    expect(stats.count).toBe(1);
    expect(stats.totalSold).toBe(0);
  });

  it("handles premium with currency formatting", () => {
    const rfps = [
      { id: "1", title: "Formatted", client: "Test", status: "sold", premium: "$120,000", lives: 100, createdAt: "2026-01-01T00:00:00Z" },
    ];
    const sold = filterSoldRfps(rfps);
    const stats = computeStats(sold);
    expect(stats.totalSold).toBe(120000);
  });

  it("when RFP moves from draft to sold, it appears in sold list", () => {
    // Simulate the flow: RFP starts as draft, then gets moved to sold
    const rfps = [
      { id: "1", title: "New Case", client: "Broker A", status: "draft", premium: "100000", lives: 50, createdAt: "2026-01-01T00:00:00Z" },
    ];

    // Initially no sold RFPs
    let sold = filterSoldRfps(rfps);
    expect(sold.length).toBe(0);

    // Move to sold
    rfps[0].status = "sold";
    sold = filterSoldRfps(rfps);
    expect(sold.length).toBe(1);
    expect(sold[0].title).toBe("New Case");
  });

  it("when RFP moves from recommended to sold, it appears in sold list", () => {
    const rfps = [
      { id: "1", title: "Recommended Case", client: "Broker B", status: "recommended", premium: "200000", lives: 300, createdAt: "2026-01-01T00:00:00Z" },
    ];

    let sold = filterSoldRfps(rfps);
    expect(sold.length).toBe(0);

    rfps[0].status = "sold";
    sold = filterSoldRfps(rfps);
    expect(sold.length).toBe(1);
    expect(sold[0].premium).toBe("200000");

    const stats = computeStats(sold);
    expect(stats.totalSold).toBe(200000);
    expect(stats.totalLives).toBe(300);
  });
});
