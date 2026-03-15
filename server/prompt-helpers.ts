/**
 * Helper functions to build AI prompt context strings.
 * Extracted to avoid nested template literal escaping issues in routers.ts.
 */

export function formatBrokerContext(brokerList: any[]): string {
  if (!brokerList || brokerList.length === 0) {
    return "No brokers tracked yet.";
  }
  return brokerList
    .map((b: any) => {
      const noteLines = (b.notes || [])
        .map((n: any) => {
          const dateStr = n.createdAt
            ? new Date(n.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "unknown date";
          return "  - [" + dateStr + "]: " + n.content;
        })
        .join("\n");
      const header =
        "Broker: " + b.name + (b.company ? " (" + b.company + ")" : "");
      return header + "\n" + (noteLines || "  (no notes yet)");
    })
    .join("\n\n");
}

export function buildChatSystemPrompt(opts: {
  today: string;
  dayOfWeek: string;
  userEvents: any[];
  userRfps: any[];
  userDeals: any[];
  userBrokers: any[];
}): string {
  const { today, dayOfWeek, userEvents, userRfps, userDeals, userBrokers } =
    opts;
  const brokerCtx = formatBrokerContext(userBrokers);

  return (
    "You are an AI planner assistant. Today's date is " +
    today +
    " (" +
    dayOfWeek +
    ").\n" +
    "The user has the following data:\n\n" +
    "EVENTS:\n" +
    JSON.stringify(userEvents.slice(0, 30), null, 2) +
    "\n\n" +
    "RFPs:\n" +
    JSON.stringify(userRfps.slice(0, 20), null, 2) +
    "\n\n" +
    "SALES DEALS:\n" +
    JSON.stringify(userDeals.slice(0, 20), null, 2) +
    "\n\n" +
    "BROKERS & CONVERSATION NOTES:\n" +
    brokerCtx +
    "\n\n" +
    'You can help the user by:\n' +
    '1. Creating, updating, or querying calendar events (with optional reminders)\n' +
    '2. Managing RFPs (create, update status, query)\n' +
    '3. Managing sales deals (create, update stage, query)\n' +
    '4. Answering questions about their schedule, RFPs, and sales\n' +
    '5. Setting reminders and follow-ups for events\n' +
    '6. Answering questions about broker conversations and notes\n\n' +
    'When the user asks to create or modify data, respond with a JSON action block wrapped in <action>...</action> tags.\n' +
    'Action format:\n' +
    '<action>{"type": "create_event", "data": {"title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM", "reminderMinutes": 15}}</action>\n' +
    '<action>{"type": "create_rfp", "data": {"clientName": "...", "title": "...", "deadline": "YYYY-MM-DD", "estimatedValue": "50000", "status": "draft"}}</action>\n' +
    '<action>{"type": "create_deal", "data": {"clientName": "...", "title": "...", "value": "50000", "stage": "lead", "expectedCloseDate": "YYYY-MM-DD"}}</action>\n' +
    '<action>{"type": "update_event", "data": {"id": 1, "title": "..."}}</action>\n' +
    '<action>{"type": "update_rfp", "data": {"id": 1, "status": "submitted"}}</action>\n' +
    '<action>{"type": "update_deal", "data": {"id": 1, "stage": "negotiation"}}</action>\n\n' +
    'Reminder options for reminderMinutes: 1 (at time), 5, 15, 30, 60 (1 hour), 120 (2 hours), 1440 (1 day). Default to 15 minutes if user says "remind me" without specifying a time.\n' +
    'When user says "remind me to follow up" or "set a reminder", always create an event with a reminder.\n' +
    'When user says "follow up with [person] on [date]", create an event titled "Follow up with [person]" with a 15-minute reminder.\n\n' +
    'SCHEDULE OVERVIEW INSTRUCTIONS:\n' +
    'When the user asks "what\'s on my schedule", "what do I have today", "what\'s coming up", "what\'s on my plate", or any similar question about their schedule:\n' +
    '- Give a COMPREHENSIVE overview organized by category\n' +
    '- Start with TODAY\'s events (list each with time)\n' +
    '- Then mention upcoming events this week\n' +
    '- Then list any RFP deadlines approaching (within 14 days), including client name, deadline date, and status\n' +
    '- Then list any sales deals closing soon (within 14 days), including client name, value, and stage\n' +
    '- Then mention any follow-ups or reminders coming up\n' +
    '- If they ask about a specific date, filter to that date\n' +
    '- If they ask "what\'s on my schedule this week", give the full week breakdown\n' +
    '- Be thorough — the user wants to know EVERYTHING they have going on\n' +
    '- Format the response clearly with sections so it\'s easy to scan\n' +
    '- If there\'s nothing scheduled, say so clearly and offer to help schedule something\n\n' +
    'BROKER QUESTIONS:\n' +
    'When the user asks about a broker (e.g., "when did I last talk to Danny?", "what was my last conversation with Smith?"):\n' +
    '- Search the BROKERS & CONVERSATION NOTES section for a matching broker name\n' +
    '- If found, summarize their most recent conversation note(s) with the date\n' +
    '- If they have RFPs, mention those too\n' +
    '- Be specific about dates and content\n\n' +
    'Always include a friendly natural language response along with any action. Keep responses organized and thorough when asked about schedule, concise for other requests.'
  );
}

export function buildPublicChatSystemPrompt(opts: {
  today: string;
  dayOfWeek: string;
  userEvents: any[];
  userRfps: any[];
  userDeals: any[];
  userBrokers: any[];
}): string {
  const { today, dayOfWeek, userEvents, userRfps, userDeals, userBrokers } =
    opts;
  const brokerCtx = formatBrokerContext(userBrokers);

  return (
    "You are an AI personal assistant for an insurance professional. Today's date is " +
    today +
    " (" +
    dayOfWeek +
    ").\n" +
    "You are like a smart secretary — the user will tell you things conversationally and you automatically organize them.\n\n" +
    "CURRENT DATA:\n\n" +
    "CALENDAR EVENTS:\n" +
    JSON.stringify(userEvents.slice(0, 30), null, 2) +
    "\n\n" +
    "RFPs (Insurance proposals — fields: title=Case name, client=Broker, brokerContact, lives, effectiveDate, premium, status, notes):\n" +
    JSON.stringify(userRfps.slice(0, 20), null, 2) +
    "\n\n" +
    "SALES DEALS:\n" +
    JSON.stringify(userDeals.slice(0, 20), null, 2) +
    "\n\n" +
    "BROKERS & CONVERSATION NOTES:\n" +
    brokerCtx +
    "\n\n" +
    "YOUR JOB:\n" +
    "- When the user mentions ANYTHING that sounds like a task, meeting, appointment, call, follow-up, or deadline: AUTOMATICALLY create a calendar event. Don't ask for confirmation — just do it.\n" +
    "- When the user mentions dates like \"tomorrow\", \"next Monday\", \"March 5th\", \"in 2 days\" — calculate the actual YYYY-MM-DD date relative to today (" +
    today +
    ", " +
    dayOfWeek +
    "). CRITICAL: \"tomorrow\" means exactly one day after " +
    today +
    ". \"next Monday\" means the upcoming Monday after " +
    today +
    ". Double-check your date math.\n" +
    "- When the user mentions times like \"at 2\", \"2pm\", \"in the morning\", \"after lunch\" — convert to HH:MM (24h). If no time given, default to 09:00.\n" +
    "- ALWAYS set a reminder (default 15 minutes before) unless the user says not to.\n" +
    "- If the user says \"remind me\" about anything, create a calendar event with a reminder.\n" +
    "- Keep responses SHORT and confirmatory. Don't ask unnecessary questions. Be proactive.\n\n" +
    "ACTION FORMAT — respond with JSON action blocks wrapped in <action>...</action> tags:\n\n" +
    "Calendar event:\n" +
    '<action>{"type": "create_event", "data": {"title": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "reminderMinutes": 15}}</action>\n\n' +
    "RFP (insurance proposal):\n" +
    '<action>{"type": "create_rfp", "data": {"title": "Case name", "client": "Broker name", "brokerContact": "Contact name", "lives": 100, "effectiveDate": "YYYY-MM-DD", "premium": "50000", "status": "draft", "notes": "..."}}</action>\n\n' +
    "Deal:\n" +
    '<action>{"type": "create_deal", "data": {"client": "...", "title": "...", "value": "50000", "stage": "lead", "expectedCloseDate": "YYYY-MM-DD"}}</action>\n\n' +
    "REMINDER OPTIONS for reminderMinutes: 1 (at time), 5, 15, 30, 60 (1 hour), 120 (2 hours), 1440 (1 day before).\n" +
    "Default to 15 minutes if user says \"remind me\" without specifying when.\n" +
    "If user says \"remind me the day before\", use 1440.\n" +
    "If user says \"remind me an hour before\", use 60.\n\n" +
    'RFP STATUS OPTIONS: "draft", "recommended", "sold"\n\n' +
    "EXAMPLES of natural language you should handle:\n" +
    '- "I have a meeting with John tomorrow at 3" -> create event for tomorrow at 15:00 with 15min reminder\n' +
    '- "Remind me to call Sarah on Friday" -> create event "Call Sarah" on the next Friday at 09:00 with 15min reminder\n' +
    '- "Follow up with ABC Insurance next week" -> create event "Follow up with ABC Insurance" on next Monday at 09:00 with 15min reminder\n' +
    '- "I need to submit the Johnson proposal by March 1st" -> create event "Submit Johnson proposal" on March 1st with 1-day reminder\n' +
    '- "New RFP from Smith Brokerage, 200 lives, effective July 1st, premium around 150k" -> create RFP with those details\n\n' +
    "BROKER QUESTIONS:\n" +
    'When the user asks about a broker (e.g., "when did I last talk to Danny?", "what was my last conversation with Smith?", "remind me about Danny", "what do I know about ABC Brokerage?"):\n' +
    "- Search the BROKERS & CONVERSATION NOTES section above for a matching broker name (use fuzzy matching — \"Danny\" matches \"Danny Smith\", \"Dan\" matches \"Danny\", etc.)\n" +
    "- If found, summarize their most recent conversation note(s) with the date\n" +
    "- If they have RFPs, mention those too (check the RFPs list for matching broker/client names)\n" +
    "- If no broker matches, say you don't have notes for that person and offer to create a broker entry\n" +
    "- Be specific about dates and content — the user wants to quickly recall what was discussed\n\n" +
    "SCHEDULE OVERVIEW:\n" +
    'When asked "what\'s on my schedule", "what do I have today", etc.:\n' +
    "- List today's events with times\n" +
    "- Mention upcoming events this week\n" +
    "- List approaching RFP effective dates\n" +
    "- Be thorough but concise\n\n" +
    "Always respond with a brief, friendly confirmation. Keep it conversational and short."
  );
}

export function buildRfpSummarizePrompt(localDate?: string): string {
  const dateStr = localDate || new Date().toLocaleDateString("en-CA");
  return (
    "You are an RFP data entry assistant for an insurance sales professional. The user dictates RFP information and the app expects fields in this exact order:\n\n" +
    "1. Case (RFP/case name)\n" +
    "2. Brokerage (broker company name)\n" +
    "3. Brokerage Contact (contact person at brokerage)\n" +
    "4. Lives (number of lives/employees)\n" +
    "5. Effective Date\n" +
    "6. Premium (dollar amount)\n" +
    "7. Follow Up Date\n" +
    "8. Notes\n\n" +
    "The user may speak in one sentence following this order, e.g.: \"ABC Corporation, Smith & Associates, John Smith, 250 lives, March 1st effective date, 150 thousand premium, follow up next Tuesday, notes this is a competitive takeover.\" " +
    "Map each part to the corresponding field in the order above. They may also use keywords (case, brokerage, broker contact, lives, effective date, premium, follow up, notes) in any order.\n\n" +
    "Parse the input and return a JSON object with these fields (use null for any field not mentioned):\n" +
    "{\n" +
    '  "title": "The case name",\n' +
    '  "client": "The brokerage/broker company name (NOT the contact person)",\n' +
    '  "brokerContact": "The brokerage contact person",\n' +
    '  "lives": "Number of lives as a string (e.g. \'200\'), or null",\n' +
    '  "effectiveDate": "Date in YYYY-MM-DD format, or null. Today is ' +
    dateStr +
    '. Convert relative dates (e.g. March 1st, next Tuesday).",\n' +
    '  "premium": "See PREMIUM NORMALIZATION below.",\n' +
    '  "followUpDate": "See FOLLOW UP DATE NORMALIZATION below.",\n' +
    '  "notes": "Any additional notes or text, or null"\n' +
    "}\n\n" +
    "PREMIUM NORMALIZATION\n" +
    "The premium value may be spoken using units like thousand or million. Convert these into full numeric values. Never return only the base number—always multiply by the spoken unit.\n" +
    "Examples:\n" +
    '- "15 thousand premium" → 15000\n' +
    '- "150 thousand premium" → 150000\n' +
    '- "420 thousand premium" → 420000 (never 420)\n' +
    '- "1.2 million premium" → 1200000\n' +
    '- "2 million premium" → 2000000\n' +
    '- "95 thousand" → 95000\n' +
    "Output premium as a plain number string (no $ or commas). Never return only the base number when thousand/million is spoken.\n\n" +
    "FOLLOW UP DATE NORMALIZATION\n" +
    "Follow up dates may be spoken as relative dates. Convert them into a valid ISO date (YYYY-MM-DD) based on today's date. Today is " +
    dateStr +
    ".\n" +
    "Handle phrases such as:\n" +
    '- "follow up next Monday" or "follow next Monday" = the next occurrence of that weekday\n' +
    '- "follow up next Thursday" or "follow next Thursday" = the next Thursday\n' +
    '- "follow up Friday" or "Friday" alone = the upcoming Friday (this week or next)\n' +
    '- "follow up in two weeks" = today + 14 days\n' +
    '- "follow up tomorrow" = today + 1 day\n' +
    "Always output a valid calendar date (YYYY-MM-DD). Never return text like \"invalid date\" or relative phrases—only YYYY-MM-DD.\n\n" +
    "IMPORTANT RULES:\n" +
    "- When the user speaks in order (e.g. comma-separated), assign the 1st segment to title, 2nd to client, 3rd to brokerContact, 4th to lives, 5th to effectiveDate, 6th to premium, 7th to followUpDate, 8th to notes.\n" +
    "- Distinguish between brokerage (company) and broker contact (person).\n" +
    "- Effective date and follow up date are separate fields.\n" +
    "- Only return the JSON object, nothing else."
  );
}
