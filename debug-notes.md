# Bug Analysis

## Bug 1: RFP premium not updating sales goal
The code in rfps.tsx handleMoveToNextStage looks correct — it checks `nextStage === "sold"` and calls `updateSalesGoal`. 
BUT the issue might be that `salesGoal` in the useCallback dependency is stale — when the callback captures `salesGoal.currentSales`, it uses the value from when the callback was created, not the latest value. Need to use a ref or functional update pattern.

Also the `updateSalesGoal` uses `setSalesGoal((prev) => ...)` which is correct for the state update, but the caller passes `salesGoal.currentSales + premiumNum` which uses the stale closure value. The fix: pass a function-based update or use a ref.

Actually wait — the updateSalesGoal already uses `setSalesGoal((prev) => { const updated = { ...prev, ...updates }; ... })`. So if the caller passes `{ currentSales: salesGoal.currentSales + premiumNum }`, the `salesGoal.currentSales` might be stale. But since we're only doing one update at a time, this should be fine unless there's a race condition.

The real issue might be simpler: the premium field is stored as a string like "50000" or "$50,000". The `parseFloat(rfp.premium.replace(/[^0-9.-]/g, ""))` should handle both formats. Let me check if the premium is actually being stored correctly.

## Bug 2: Chat-created events not showing on calendar
The createEvent in data-provider correctly updates local state. The calendar filters by `e.date === selectedDate`. The AI generates dates in YYYY-MM-DD format. The issue might be:
1. The date format from AI doesn't match what the calendar expects
2. The `refreshAll` in calendar's useFocusEffect overwrites local state
3. The event is created but the calendar doesn't re-render

Let me check the useFocusEffect in calendar.tsx.
