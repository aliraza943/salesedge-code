import { describe, it, expect } from "vitest";

describe("Notification Reminder Options", () => {
  const REMINDER_OPTIONS = [
    { label: "None", value: 0 },
    { label: "At time of event", value: 1 },
    { label: "5 minutes before", value: 5 },
    { label: "15 minutes before", value: 15 },
    { label: "30 minutes before", value: 30 },
    { label: "1 hour before", value: 60 },
    { label: "2 hours before", value: 120 },
    { label: "1 day before", value: 1440 },
  ];

  it("should have correct number of reminder options", () => {
    expect(REMINDER_OPTIONS).toHaveLength(8);
  });

  it("should have 'None' as the first option with value 0", () => {
    expect(REMINDER_OPTIONS[0].label).toBe("None");
    expect(REMINDER_OPTIONS[0].value).toBe(0);
  });

  it("should have options in ascending order of minutes", () => {
    for (let i = 1; i < REMINDER_OPTIONS.length; i++) {
      expect(REMINDER_OPTIONS[i].value).toBeGreaterThan(REMINDER_OPTIONS[i - 1].value);
    }
  });

  it("should find the correct label for a given value", () => {
    const findLabel = (value: number) =>
      REMINDER_OPTIONS.find((o) => o.value === value)?.label || "None";

    expect(findLabel(0)).toBe("None");
    expect(findLabel(15)).toBe("15 minutes before");
    expect(findLabel(60)).toBe("1 hour before");
    expect(findLabel(1440)).toBe("1 day before");
    expect(findLabel(999)).toBe("None");
  });
});

describe("Notification Trigger Date Calculation", () => {
  it("should calculate trigger date correctly for 15 min before", () => {
    const eventDate = new Date("2026-03-01T14:00:00");
    const reminderMinutes = 15;
    const triggerDate = new Date(eventDate.getTime() - reminderMinutes * 60 * 1000);

    expect(triggerDate.getHours()).toBe(13);
    expect(triggerDate.getMinutes()).toBe(45);
  });

  it("should calculate trigger date correctly for 1 hour before", () => {
    const eventDate = new Date("2026-03-01T14:00:00");
    const reminderMinutes = 60;
    const triggerDate = new Date(eventDate.getTime() - reminderMinutes * 60 * 1000);

    expect(triggerDate.getHours()).toBe(13);
    expect(triggerDate.getMinutes()).toBe(0);
  });

  it("should calculate trigger date correctly for 1 day before", () => {
    const eventDate = new Date("2026-03-01T14:00:00");
    const reminderMinutes = 1440;
    const triggerDate = new Date(eventDate.getTime() - reminderMinutes * 60 * 1000);

    expect(triggerDate.getDate()).toBe(28); // Feb 28
    expect(triggerDate.getHours()).toBe(14);
  });

  it("should detect past trigger dates", () => {
    const pastDate = new Date(Date.now() - 60000); // 1 min ago
    const isPast = pastDate.getTime() <= Date.now();
    expect(isPast).toBe(true);
  });

  it("should detect future trigger dates", () => {
    const futureDate = new Date(Date.now() + 3600000); // 1 hour from now
    const isPast = futureDate.getTime() <= Date.now();
    expect(isPast).toBe(false);
  });
});

describe("Reminder Map Storage", () => {
  it("should serialize and deserialize reminder map", () => {
    const reminderMap: Record<number, { notificationId: string; reminderMinutes: number }> = {
      1: { notificationId: "abc-123", reminderMinutes: 15 },
      2: { notificationId: "def-456", reminderMinutes: 60 },
    };

    const serialized = JSON.stringify(reminderMap);
    const deserialized = JSON.parse(serialized);

    expect(deserialized[1].notificationId).toBe("abc-123");
    expect(deserialized[1].reminderMinutes).toBe(15);
    expect(deserialized[2].notificationId).toBe("def-456");
    expect(deserialized[2].reminderMinutes).toBe(60);
  });

  it("should handle empty reminder map", () => {
    const reminderMap: Record<number, { notificationId: string; reminderMinutes: number }> = {};
    const serialized = JSON.stringify(reminderMap);
    const deserialized = JSON.parse(serialized);

    expect(Object.keys(deserialized)).toHaveLength(0);
  });

  it("should get reminder minutes for an event", () => {
    const reminderMap: Record<number, { notificationId: string; reminderMinutes: number }> = {
      5: { notificationId: "xyz", reminderMinutes: 30 },
    };

    const getReminderMinutes = (eventId: number) =>
      reminderMap[eventId]?.reminderMinutes || 0;

    expect(getReminderMinutes(5)).toBe(30);
    expect(getReminderMinutes(99)).toBe(0);
  });
});

describe("AI Action Reminder Parsing", () => {
  it("should extract reminderMinutes from create_event action", () => {
    const actionStr = '{"type": "create_event", "data": {"title": "Follow up with John", "date": "2026-03-01", "startTime": "14:00", "reminderMinutes": 15}}';
    const action = JSON.parse(actionStr);

    expect(action.type).toBe("create_event");
    expect(action.data.reminderMinutes).toBe(15);
    expect(action.data.title).toBe("Follow up with John");
  });

  it("should handle create_event without reminderMinutes", () => {
    const actionStr = '{"type": "create_event", "data": {"title": "Meeting", "date": "2026-03-01"}}';
    const action = JSON.parse(actionStr);

    expect(action.data.reminderMinutes).toBeUndefined();
    const reminderMinutes = action.data.reminderMinutes || 0;
    expect(reminderMinutes).toBe(0);
  });

  it("should separate reminderMinutes from event data for DB storage", () => {
    const actionData = {
      title: "Team Standup",
      date: "2026-03-01",
      startTime: "09:00",
      endTime: "09:30",
      reminderMinutes: 5,
    };

    const { reminderMinutes, ...eventData } = actionData;

    expect(reminderMinutes).toBe(5);
    expect(eventData).toEqual({
      title: "Team Standup",
      date: "2026-03-01",
      startTime: "09:00",
      endTime: "09:30",
    });
    expect("reminderMinutes" in eventData).toBe(false);
  });
});
