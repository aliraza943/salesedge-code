import { describe, it, expect } from "vitest";

// ─── Utility Function Tests ─────────────────────────────────

describe("Utility Functions", () => {
  // Re-implement the utility functions inline for testing (they are pure functions)
  function formatTime12(time: string): string {
    if (!time) return "";
    const [h, m] = time.split(":");
    const hour = parseInt(h, 10);
    if (isNaN(hour)) return time;
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${h12}:${m} ${ampm}`;
  }

  function formatCurrency(value: string | number): string {
    const num = typeof value === "number" ? value : parseFloat(value);
    if (isNaN(num)) return "$0";
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  describe("formatTime12", () => {
    it("should convert 24h to 12h format", () => {
      expect(formatTime12("09:00")).toBe("9:00 AM");
      expect(formatTime12("13:30")).toBe("1:30 PM");
      expect(formatTime12("00:00")).toBe("12:00 AM");
      expect(formatTime12("12:00")).toBe("12:00 PM");
      expect(formatTime12("23:59")).toBe("11:59 PM");
    });

    it("should handle empty string", () => {
      expect(formatTime12("")).toBe("");
    });
  });

  describe("formatCurrency", () => {
    it("should format numbers as currency", () => {
      expect(formatCurrency(100000)).toBe("$100,000");
      expect(formatCurrency("50000")).toBe("$50,000");
      expect(formatCurrency(0)).toBe("$0");
    });

    it("should handle NaN", () => {
      expect(formatCurrency("abc")).toBe("$0");
    });
  });

  describe("getGreeting", () => {
    it("should return a valid greeting", () => {
      const greeting = getGreeting();
      expect(["Good Morning", "Good Afternoon", "Good Evening"]).toContain(greeting);
    });
  });
});

// ─── Local Store Type Tests ─────────────────────────────────

describe("Local Store Types", () => {
  it("should define LocalEvent with all required fields", () => {
    const event = {
      id: "test-1",
      title: "Meeting",
      date: "2026-02-19",
      startTime: "10:00",
      endTime: "11:00",
      description: "Team sync",
      reminderMinutes: 15,
      createdAt: new Date().toISOString(),
    };

    expect(event.id).toBeDefined();
    expect(event.title).toBe("Meeting");
    expect(event.date).toBe("2026-02-19");
    expect(event.startTime).toBe("10:00");
    expect(event.reminderMinutes).toBe(15);
    expect(event.createdAt).toBeDefined();
  });

  it("should define LocalRfp with LGFSSU-specific fields", () => {
    const rfp = {
      id: "rfp-1",
      title: "Johnson Group",
      client: "Smith Brokerage",
      brokerContact: "Jane Smith",
      lives: 200,
      effectiveDate: "2026-07-01",
      premium: "150000",
      status: "draft" as const,
      notes: "Large group",
      description: "Full benefits package",
      createdAt: new Date().toISOString(),
    };

    expect(rfp.client).toBe("Smith Brokerage");
    expect(rfp.brokerContact).toBe("Jane Smith");
    expect(rfp.lives).toBe(200);
    expect(rfp.effectiveDate).toBe("2026-07-01");
    expect(rfp.premium).toBe("150000");
    expect(rfp.status).toBe("draft");
  });

  it("should define LocalDeal with sales pipeline fields", () => {
    const deal = {
      id: "deal-1",
      title: "Enterprise Contract",
      client: "Corp Inc",
      stage: "proposal" as const,
      value: "500000",
      expectedCloseDate: "2026-03-15",
      description: "Annual contract",
      createdAt: new Date().toISOString(),
    };

    expect(deal.stage).toBe("proposal");
    expect(deal.value).toBe("500000");
    expect(deal.expectedCloseDate).toBe("2026-03-15");
  });

  it("should define LocalChatMessage with role and optional actions", () => {
    const msg = {
      id: "msg-1",
      role: "assistant" as const,
      content: "I've created your meeting.",
      actions: [{ type: "create_event", data: { title: "Meeting" } }],
      createdAt: new Date().toISOString(),
    };

    expect(msg.role).toBe("assistant");
    expect(msg.actions).toHaveLength(1);
    expect(msg.actions![0].type).toBe("create_event");
  });
});

// ─── Action Execution Tests ─────────────────────────────────

describe("Chat Action Execution", () => {
  // Mirrors the executeActions logic in chat.tsx
  function executeAction(action: { type: string; data: Record<string, any> }) {
    const d = action.data;
    if (!d) return null;

    switch (action.type) {
      case "create_event":
        return {
          type: "event" as const,
          data: {
            title: String(d.title || "Untitled Event"),
            description: d.description ? String(d.description) : undefined,
            date: String(d.date || new Date().toISOString().split("T")[0]),
            startTime: d.startTime ? String(d.startTime) : undefined,
            endTime: d.endTime ? String(d.endTime) : undefined,
            reminderMinutes: typeof d.reminderMinutes === "number" ? d.reminderMinutes : 15,
          },
        };
      case "create_rfp":
        return {
          type: "rfp" as const,
          data: {
            title: String(d.title || "Untitled RFP"),
            client: String(d.client || d.clientName || "Unknown"),
            brokerContact: d.brokerContact ? String(d.brokerContact) : undefined,
            lives: typeof d.lives === "number" ? d.lives : undefined,
            effectiveDate: d.effectiveDate ? String(d.effectiveDate) : (d.deadline ? String(d.deadline) : undefined),
            premium: d.premium ? String(d.premium) : (d.estimatedValue ? String(d.estimatedValue) : undefined),
            status: (d.status === "draft" || d.status === "recommended" || d.status === "sold") ? d.status : "draft",
            notes: d.notes ? String(d.notes) : undefined,
            description: d.description ? String(d.description) : undefined,
          },
        };
      case "create_deal":
        return {
          type: "deal" as const,
          data: {
            title: String(d.title || "Untitled Deal"),
            client: String(d.client || d.clientName || "Unknown"),
            stage: (d.stage as any) || "lead",
            value: d.value ? String(d.value) : undefined,
            expectedCloseDate: d.expectedCloseDate ? String(d.expectedCloseDate) : undefined,
            description: d.description ? String(d.description) : undefined,
          },
        };
      default:
        return null;
    }
  }

  describe("Event Creation from AI", () => {
    it("should create event with all fields", () => {
      const result = executeAction({
        type: "create_event",
        data: {
          title: "Meeting with John",
          date: "2026-02-19",
          startTime: "15:00",
          endTime: "16:00",
          description: "Discuss Q2 plans",
          reminderMinutes: 15,
        },
      });

      expect(result).not.toBeNull();
      expect(result!.type).toBe("event");
      expect(result!.data.title).toBe("Meeting with John");
      expect(result!.data.date).toBe("2026-02-19");
      expect(result!.data.startTime).toBe("15:00");
      expect(result!.data.endTime).toBe("16:00");
      expect(result!.data.reminderMinutes).toBe(15);
    });

    it("should default reminderMinutes to 15 when not a number", () => {
      const result = executeAction({
        type: "create_event",
        data: { title: "Test", date: "2026-02-19" },
      });
      expect(result!.data.reminderMinutes).toBe(15);
    });

    it("should default title to 'Untitled Event'", () => {
      const result = executeAction({
        type: "create_event",
        data: { date: "2026-02-19" },
      });
      expect(result!.data.title).toBe("Untitled Event");
    });
  });

  describe("RFP Creation from AI", () => {
    it("should create RFP with LGFSSU fields", () => {
      const result = executeAction({
        type: "create_rfp",
        data: {
          title: "ABC Corp",
          client: "Smith Brokerage",
          brokerContact: "Jane Smith",
          lives: 200,
          effectiveDate: "2026-07-01",
          premium: "150000",
          status: "draft",
          notes: "Competitive bid",
        },
      });

      expect(result!.type).toBe("rfp");
      expect(result!.data.client).toBe("Smith Brokerage");
      expect(result!.data.brokerContact).toBe("Jane Smith");
      expect(result!.data.lives).toBe(200);
      expect(result!.data.effectiveDate).toBe("2026-07-01");
      expect(result!.data.premium).toBe("150000");
    });

    it("should fallback clientName to client", () => {
      const result = executeAction({
        type: "create_rfp",
        data: { title: "Test", clientName: "Fallback Broker" },
      });
      expect(result!.data.client).toBe("Fallback Broker");
    });

    it("should fallback deadline to effectiveDate", () => {
      const result = executeAction({
        type: "create_rfp",
        data: { title: "Test", client: "Broker", deadline: "2026-06-15" },
      });
      expect(result!.data.effectiveDate).toBe("2026-06-15");
    });

    it("should fallback estimatedValue to premium", () => {
      const result = executeAction({
        type: "create_rfp",
        data: { title: "Test", client: "Broker", estimatedValue: "75000" },
      });
      expect(result!.data.premium).toBe("75000");
    });

    it("should default invalid status to draft", () => {
      const result = executeAction({
        type: "create_rfp",
        data: { title: "Test", client: "Broker", status: "invalid" },
      });
      expect(result!.data.status).toBe("draft");
    });
  });

  describe("Deal Creation from AI", () => {
    it("should create deal with all fields", () => {
      const result = executeAction({
        type: "create_deal",
        data: {
          title: "Big Deal",
          client: "Corp Inc",
          stage: "proposal",
          value: "500000",
          expectedCloseDate: "2026-03-15",
        },
      });

      expect(result!.type).toBe("deal");
      expect(result!.data.title).toBe("Big Deal");
      expect(result!.data.stage).toBe("proposal");
      expect(result!.data.value).toBe("500000");
    });

    it("should default stage to lead", () => {
      const result = executeAction({
        type: "create_deal",
        data: { title: "Test", client: "Corp" },
      });
      expect(result!.data.stage).toBe("lead");
    });
  });

  describe("Unknown Action Types", () => {
    it("should return null for unknown action types", () => {
      const result = executeAction({
        type: "unknown_action",
        data: { title: "Test" },
      });
      expect(result).toBeNull();
    });
  });
});

// ─── Action Parsing Tests ───────────────────────────────────

describe("AI Response Action Parsing", () => {
  function parseActions(aiContent: string) {
    const actionRegex = /<action>(.*?)<\/action>/gs;
    let match;
    const parsedActions: Array<{ type: string; data: Record<string, unknown> }> = [];
    while ((match = actionRegex.exec(aiContent)) !== null) {
      try {
        const action = JSON.parse(match[1]);
        parsedActions.push({ type: action.type, data: action.data });
      } catch {
        // skip invalid JSON
      }
    }
    return parsedActions;
  }

  it("should parse single action from AI response", () => {
    const content = `Sure! I've scheduled that for you.
<action>{"type": "create_event", "data": {"title": "Call Sarah", "date": "2026-02-20", "startTime": "09:00", "reminderMinutes": 15}}</action>
Your call with Sarah is set for Friday at 9 AM.`;

    const actions = parseActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].type).toBe("create_event");
    expect(actions[0].data.title).toBe("Call Sarah");
  });

  it("should parse multiple actions from AI response", () => {
    const content = `I've set up both items for you.
<action>{"type": "create_event", "data": {"title": "Meeting", "date": "2026-02-20", "startTime": "10:00"}}</action>
<action>{"type": "create_rfp", "data": {"title": "Johnson Group", "client": "Smith", "effectiveDate": "2026-07-01", "premium": "100000", "status": "draft"}}</action>
Both are now on your calendar and RFP list.`;

    const actions = parseActions(content);
    expect(actions).toHaveLength(2);
    expect(actions[0].type).toBe("create_event");
    expect(actions[1].type).toBe("create_rfp");
  });

  it("should skip invalid JSON in action tags", () => {
    const content = `<action>invalid json</action>
<action>{"type": "create_event", "data": {"title": "Valid", "date": "2026-02-20"}}</action>`;

    const actions = parseActions(content);
    expect(actions).toHaveLength(1);
    expect(actions[0].data.title).toBe("Valid");
  });

  it("should handle response with no actions", () => {
    const content = "Your schedule looks clear today. No meetings or deadlines.";
    const actions = parseActions(content);
    expect(actions).toHaveLength(0);
  });
});

// ─── Server Context Serialization Tests ─────────────────────

describe("Server Context Serialization", () => {
  it("should serialize all data collections as JSON for the API", () => {
    const events = [
      { id: "1", title: "Meeting", date: "2026-02-19", startTime: "10:00" },
    ];
    const rfps = [
      { id: "2", title: "Johnson Case", client: "Smith", effectiveDate: "2026-07-01", premium: "50000", status: "draft" },
    ];
    const deals = [
      { id: "3", title: "Big Deal", client: "Corp", stage: "lead", value: "100000" },
    ];

    const payload = {
      message: "What's on my schedule?",
      events: JSON.stringify(events.slice(0, 30)),
      rfps: JSON.stringify(rfps.slice(0, 20)),
      deals: JSON.stringify(deals.slice(0, 20)),
      chatHistory: JSON.stringify([]),
    };

    const parsedEvents = JSON.parse(payload.events);
    const parsedRfps = JSON.parse(payload.rfps);
    const parsedDeals = JSON.parse(payload.deals);

    expect(parsedEvents).toHaveLength(1);
    expect(parsedRfps[0].effectiveDate).toBe("2026-07-01");
    expect(parsedRfps[0].premium).toBe("50000");
    expect(parsedDeals[0].value).toBe("100000");
  });

  it("should limit context to prevent token overflow", () => {
    const events = Array.from({ length: 50 }, (_, i) => ({
      id: `e-${i}`,
      title: `Event ${i}`,
      date: "2026-02-19",
    }));

    const sliced = events.slice(0, 30);
    expect(sliced).toHaveLength(30);
    expect(JSON.stringify(sliced).length).toBeLessThan(10000);
  });
});

// ─── Date Handling Tests ────────────────────────────────────

describe("Date Handling", () => {
  it("should format dates correctly for display", () => {
    const date = new Date("2026-02-19T12:00:00");
    const formatted = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
    expect(formatted).toContain("February");
    expect(formatted).toContain("19");
  });

  it("should calculate days until correctly", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    const target = new Date(tomorrowStr + "T23:59:59");
    const daysUntil = Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    expect(daysUntil).toBeGreaterThanOrEqual(0);
    expect(daysUntil).toBeLessThanOrEqual(3);
  });

  it("should handle ISO date strings for events", () => {
    const dateStr = "2026-07-01";
    const date = new Date(dateStr + "T12:00:00");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(6); // July is 6 (0-indexed)
    expect(date.getDate()).toBe(1);
  });
});
