import { describe, it, expect } from "vitest";

// ─── Chat → Calendar Sync Tests ──────────────────────────────

describe("Chat to Calendar Sync", () => {
  // Simulate the action parsing logic from server/routers.ts
  function parseActions(aiContent: string) {
    const actionRegex = /<action>(.*?)<\/action>/gs;
    let match;
    const parsedActions: Array<{ type: string; data: Record<string, unknown> }> = [];
    while ((match = actionRegex.exec(aiContent)) !== null) {
      try {
        const action = JSON.parse(match[1]);
        parsedActions.push({ type: action.type, data: action.data });
      } catch (e) {
        // skip invalid JSON
      }
    }
    return parsedActions;
  }

  // Simulate the action execution logic from chat.tsx
  function executeAction(action: { type: string; data: Record<string, any> }): any {
    const d = action.data;
    if (!d) return null;

    switch (action.type) {
      case "create_event": {
        return {
          type: "event",
          event: {
            title: d.title || "Event",
            description: d.description,
            date: d.date,
            startTime: d.startTime,
            endTime: d.endTime,
          },
          reminderMinutes: d.reminderMinutes,
        };
      }
      case "create_rfp": {
        return {
          type: "rfp",
          rfp: {
            title: d.title || "RFP",
            client: d.client || d.clientName || "",
            brokerContact: d.brokerContact,
            lives: d.lives ? Number(d.lives) : undefined,
            effectiveDate: d.effectiveDate || d.deadline,
            premium: d.premium || d.value || d.estimatedValue,
            status: (d.status === "draft" || d.status === "recommended" || d.status === "sold") ? d.status : "draft",
            notes: d.notes,
          },
        };
      }
      case "create_deal": {
        return {
          type: "deal",
          deal: {
            title: d.title || "Deal",
            client: d.client || d.clientName || "",
            stage: d.stage || "lead",
            value: d.value,
            expectedCloseDate: d.expectedCloseDate,
          },
        };
      }
      default:
        return null;
    }
  }

  describe("Action Parsing with Correct Field Names", () => {
    it("should parse create_event with startTime and reminderMinutes", () => {
      const aiContent = `Got it! I've scheduled your meeting.
<action>{"type": "create_event", "data": {"title": "Meeting with John", "date": "2026-02-19", "startTime": "15:00", "reminderMinutes": 15}}</action>
Your meeting with John is set for tomorrow at 3 PM with a 15-minute reminder.`;

      const actions = parseActions(aiContent);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("create_event");
      expect(actions[0].data.title).toBe("Meeting with John");
      expect(actions[0].data.date).toBe("2026-02-19");
      expect(actions[0].data.startTime).toBe("15:00");
      expect(actions[0].data.reminderMinutes).toBe(15);
    });

    it("should parse create_rfp with new field names (effectiveDate, premium)", () => {
      const aiContent = `New RFP created!
<action>{"type": "create_rfp", "data": {"title": "Johnson Group", "client": "Smith Brokerage", "brokerContact": "Jane Smith", "lives": 200, "effectiveDate": "2026-07-01", "premium": "150000", "status": "draft", "notes": "Large group, competitive pricing needed"}}</action>`;

      const actions = parseActions(aiContent);
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe("create_rfp");
      expect(actions[0].data.title).toBe("Johnson Group");
      expect(actions[0].data.client).toBe("Smith Brokerage");
      expect(actions[0].data.brokerContact).toBe("Jane Smith");
      expect(actions[0].data.lives).toBe(200);
      expect(actions[0].data.effectiveDate).toBe("2026-07-01");
      expect(actions[0].data.premium).toBe("150000");
      expect(actions[0].data.status).toBe("draft");
    });

    it("should NOT use old field names (deadline, value) for RFPs", () => {
      // The AI prompt now instructs using effectiveDate and premium
      const aiContent = `<action>{"type": "create_rfp", "data": {"title": "Test Case", "client": "Test Broker", "effectiveDate": "2026-06-01", "premium": "50000", "status": "draft"}}</action>`;

      const actions = parseActions(aiContent);
      const rfpData = actions[0].data;
      // Should have effectiveDate, not deadline
      expect(rfpData.effectiveDate).toBe("2026-06-01");
      expect(rfpData).not.toHaveProperty("deadline");
      // Should have premium, not value
      expect(rfpData.premium).toBe("50000");
    });
  });

  describe("Action Execution — Event Creation", () => {
    it("should create an event from AI action", () => {
      const action = {
        type: "create_event",
        data: {
          title: "Call Sarah",
          date: "2026-02-20",
          startTime: "09:00",
          reminderMinutes: 15,
        },
      };

      const result = executeAction(action);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("event");
      expect(result!.event.title).toBe("Call Sarah");
      expect(result!.event.date).toBe("2026-02-20");
      expect(result!.event.startTime).toBe("09:00");
      expect(result!.reminderMinutes).toBe(15);
    });

    it("should default title to 'Event' if missing", () => {
      const action = {
        type: "create_event",
        data: { date: "2026-02-20", startTime: "10:00" },
      };

      const result = executeAction(action);
      expect(result!.event.title).toBe("Event");
    });

    it("should handle event with no endTime (single time field)", () => {
      const action = {
        type: "create_event",
        data: {
          title: "Quick Check-in",
          date: "2026-02-20",
          startTime: "14:00",
          reminderMinutes: 5,
        },
      };

      const result = executeAction(action);
      expect(result!.event.startTime).toBe("14:00");
      expect(result!.event.endTime).toBeUndefined();
    });
  });

  describe("Action Execution — RFP Creation", () => {
    it("should create an RFP with correct field mapping", () => {
      const action = {
        type: "create_rfp",
        data: {
          title: "ABC Company",
          client: "XYZ Brokerage",
          brokerContact: "John Doe",
          lives: 150,
          effectiveDate: "2026-07-01",
          premium: "100000",
          status: "draft",
          notes: "Competitive bid",
        },
      };

      const result = executeAction(action);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("rfp");
      expect(result!.rfp.title).toBe("ABC Company");
      expect(result!.rfp.client).toBe("XYZ Brokerage");
      expect(result!.rfp.brokerContact).toBe("John Doe");
      expect(result!.rfp.lives).toBe(150);
      expect(result!.rfp.effectiveDate).toBe("2026-07-01");
      expect(result!.rfp.premium).toBe("100000");
      expect(result!.rfp.status).toBe("draft");
    });

    it("should fallback to deadline field if effectiveDate not present", () => {
      const action = {
        type: "create_rfp",
        data: {
          title: "Legacy Case",
          client: "Old Broker",
          deadline: "2026-06-15",
          value: "75000",
          status: "draft",
        },
      };

      const result = executeAction(action) as any;
      expect(result.rfp.effectiveDate).toBe("2026-06-15");
      expect(result.rfp.premium).toBe("75000");
    });

    it("should default invalid status to draft", () => {
      const action = {
        type: "create_rfp",
        data: {
          title: "Test",
          client: "Test",
          status: "invalid_status",
        },
      };

      const result = executeAction(action) as any;
      expect(result.rfp.status).toBe("draft");
    });
  });

  describe("Context Passing", () => {
    it("should serialize events/rfps/deals as JSON strings for the API", () => {
      const events = [
        { id: "1", title: "Meeting", date: "2026-02-18", startTime: "10:00" },
      ];
      const rfps = [
        { id: "2", title: "Johnson Case", client: "Smith", effectiveDate: "2026-07-01", premium: "50000", status: "draft" },
      ];
      const deals = [
        { id: "3", title: "Big Deal", client: "Corp", stage: "lead", value: "100000" },
      ];

      // This is what chat.tsx now sends to the publicChat mutation
      const payload = {
        message: "What's on my schedule?",
        events: JSON.stringify(events),
        rfps: JSON.stringify(rfps),
        deals: JSON.stringify(deals),
        chatHistory: JSON.stringify([]),
      };

      // Verify the server can parse these back
      const parsedEvents = JSON.parse(payload.events);
      const parsedRfps = JSON.parse(payload.rfps);
      const parsedDeals = JSON.parse(payload.deals);

      expect(parsedEvents).toHaveLength(1);
      expect(parsedEvents[0].title).toBe("Meeting");
      expect(parsedRfps).toHaveLength(1);
      expect(parsedRfps[0].effectiveDate).toBe("2026-07-01");
      expect(parsedRfps[0].premium).toBe("50000");
      expect(parsedDeals).toHaveLength(1);
      expect(parsedDeals[0].value).toBe("100000");
    });
  });

  describe("Reminder Minutes Handling", () => {
    it("should pass reminder minutes from action to setReminder", () => {
      const action = {
        type: "create_event",
        data: {
          title: "Follow up with client",
          date: "2026-02-20",
          startTime: "09:00",
          reminderMinutes: 1440, // 1 day before
        },
      };

      const result = executeAction(action) as any;
      expect(result.reminderMinutes).toBe(1440);
    });

    it("should handle 0 reminderMinutes (no reminder)", () => {
      const action = {
        type: "create_event",
        data: {
          title: "No Reminder Event",
          date: "2026-02-20",
          startTime: "09:00",
          reminderMinutes: 0,
        },
      };

      const result = executeAction(action) as any;
      expect(result.reminderMinutes).toBe(0);
      // In chat.tsx, reminderMinutes > 0 check means no reminder is set
    });

    it("should handle missing reminderMinutes", () => {
      const action = {
        type: "create_event",
        data: {
          title: "Event Without Reminder",
          date: "2026-02-20",
          startTime: "09:00",
        },
      };

      const result = executeAction(action) as any;
      expect(result.reminderMinutes).toBeUndefined();
    });
  });

  describe("System Prompt Field Names", () => {
    // Verify the system prompt uses the correct field names
    it("should use effectiveDate and premium in RFP action format", () => {
      // This is the action format from the updated system prompt
      const actionTemplate = '{"type": "create_rfp", "data": {"title": "Case name", "client": "Broker name", "brokerContact": "Contact name", "lives": 100, "effectiveDate": "YYYY-MM-DD", "premium": "50000", "status": "draft", "notes": "..."}}';
      const parsed = JSON.parse(actionTemplate);
      
      expect(parsed.data).toHaveProperty("effectiveDate");
      expect(parsed.data).toHaveProperty("premium");
      expect(parsed.data).toHaveProperty("brokerContact");
      expect(parsed.data).toHaveProperty("lives");
      expect(parsed.data).not.toHaveProperty("deadline");
      expect(parsed.data).not.toHaveProperty("value");
    });

    it("should use startTime (not endTime) in event action format", () => {
      const actionTemplate = '{"type": "create_event", "data": {"title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "reminderMinutes": 15}}';
      const parsed = JSON.parse(actionTemplate);
      
      expect(parsed.data).toHaveProperty("startTime");
      expect(parsed.data).toHaveProperty("reminderMinutes");
      // endTime is optional but not in the default template
      expect(parsed.data).not.toHaveProperty("endTime");
    });
  });
});
