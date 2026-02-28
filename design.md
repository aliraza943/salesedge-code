# SalesEdge — Clean Rebuild Design

## App Identity

**Name:** SalesEdge  
**Purpose:** AI-powered personal assistant for insurance professionals — calendar, RFPs, sales pipeline, voice-first interaction.  
**Orientation:** Portrait (9:16), one-handed use.

---

## Screen List

| # | Screen | Tab | Description |
|---|--------|-----|-------------|
| 1 | Home | Home | Dashboard with greeting, today's attack plan, quick actions, stats, PDF/Excel export |
| 2 | Chat | Chat | AI assistant with text + voice input, action execution |
| 3 | RFPs | RFPs | RFP tracker grouped by stage (Draft / Recommended / Sold) |
| 4 | Calendar | Calendar | Month calendar with dot indicators, day event list, add/edit modal |
| 5 | Sales | Sales | Sales pipeline with deal list and stage management |
| 6 | RFP Detail | Stack | Full RFP detail view with edit/delete |
| 7 | Deal Detail | Stack | Full deal detail view with edit/delete |
| 8 | Add/Edit Event | Modal | Event form (title, description, date, time, reminder) |
| 9 | Add/Edit RFP | Modal | RFP form (Case, Broker, Contact, Lives, Effective Date, Premium, Notes) |
| 10 | Add/Edit Deal | Modal | Deal form (title, client, stage, value, close date, notes) |

---

## Tab Bar

5 tabs in order: **Home** · **Chat** · **RFPs** · **Calendar** · **Sales**

| Tab | Icon (SF Symbol) | Material Icon |
|-----|-------------------|---------------|
| Home | house.fill | home |
| Chat | bubble.left.fill | chat |
| RFPs | doc.text.fill | description |
| Calendar | calendar | event |
| Sales | chart.line.uptrend.xyaxis | trending-up |

---

## Color Palette

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| primary | #2563EB | #3B82F6 | Buttons, active states, tint |
| background | #F8FAFC | #0F172A | Screen backgrounds |
| surface | #FFFFFF | #1E293B | Cards, elevated surfaces |
| foreground | #0F172A | #F1F5F9 | Primary text |
| muted | #64748B | #94A3B8 | Secondary text |
| border | #E2E8F0 | #334155 | Dividers, card borders |
| success | #16A34A | #4ADE80 | Sold/won states |
| warning | #D97706 | #FBBF24 | Recommended/pending states |
| error | #DC2626 | #F87171 | Delete, error states |

---

## Primary Content & Functionality

### 1. Home Screen
- **Greeting** — "Good Morning/Afternoon/Evening" + current date
- **Today's Attack Plan** card — shows today's events count, tappable to see details
- **Quick Actions** — 3 buttons: "Talk to AI", "Calendar", "Weekly Summary"
- **Stats Row** — Active RFPs count, Open Deals count, Pipeline $ value
- **Download Daily Attack Plan** — button that generates PDF via server and opens in browser
- **Export Excel** — two buttons: "RFPs & Sold" and "Schedule"

### 2. Chat Screen
- **Message List** — scrollable chat history (FlatList)
- **Text Input** — bottom bar with text field + send button
- **Voice Button** — hold-to-record mic button (records audio, sends to server for transcription, then sends text to AI)
- **AI Actions** — when AI returns actions (create_event, create_rfp, create_deal), execute them locally via DataProvider and show confirmation cards
- **Context** — sends current events/rfps/deals + recent chat history to AI for full context

### 3. RFP Screen
- **Stage Sections** — grouped into Draft (blue), Recommended (amber), Sold (green) with counts
- **RFP Cards** — show Case name, Broker, Lives, Effective Date, Premium
- **Quick Stage Move** — "Move to Recommended" / "Move to Sold" button on each card
- **Add Button** — floating or header button to add new RFP
- **Voice Input** — mic button on add form to auto-fill fields via AI transcription

### 4. Calendar Screen
- **Month View** — custom calendar grid with dot indicators on dates that have events
- **Selected Day Events** — list below calendar showing events for tapped date
- **Add Event** — "+" button to open add event modal
- **Event Cards** — show title, time (12-hour format), description preview
- **Tap to Edit** — tap event card to open edit modal

### 5. Sales Screen
- **Pipeline Summary** — total pipeline value, won value, win rate percentage
- **Deal List** — FlatList with stage badges (color-coded)
- **Add Deal** — button to add new deal
- **Tap to Detail** — tap deal card to open detail view

---

## Key User Flows

### Flow 1: Voice → Calendar Event
1. User opens Chat tab
2. Taps and holds mic button → recording starts
3. Releases mic → audio sent to server for transcription
4. Transcribed text sent to AI with current data context
5. AI returns action: `create_event` with parsed date/time/reminder
6. App executes action via DataProvider → event saved to local store + synced to server
7. Notification scheduled for reminder
8. User sees confirmation in chat
9. User switches to Calendar tab → event visible on that date

### Flow 2: Add RFP Manually
1. User opens RFPs tab
2. Taps "+" button → Add RFP modal opens
3. Fills in: Case, Broker, Broker Contact, Lives, Effective Date (calendar picker), Premium, Notes
4. Taps Save → RFP created via DataProvider
5. RFP appears in Draft section

### Flow 3: Move RFP Through Stages
1. User sees RFP card in Draft section
2. Taps "Move to Recommended" → status updated
3. Card moves to Recommended section
4. Later taps "Move to Sold" → status updated to sold

### Flow 4: Export PDF/Excel
1. User on Home screen
2. Taps "Download Daily Attack Plan" → generates HTML on server → opens in browser for print/save
3. Or taps "RFPs & Sold" → generates Excel on server → opens download page in browser

---

## Data Architecture (Clean Rebuild)

### Single Source of Truth: DataProvider Context

All screens read/write through a single `DataProvider` React Context that:
1. Loads data from AsyncStorage on mount
2. Syncs to server via device-ID REST API in background
3. Exposes stable callback refs (useRef pattern to avoid re-render loops)
4. Provides: events, rfps, deals, chatMessages + CRUD functions for each

### Device ID
- Generated once via `expo-secure-store` (native) or `localStorage` (web)
- Used as key for server-side data storage
- Persists across Metro URL changes and app reloads

### Server Sync
- On mount: fetch from server, merge with local (server wins if newer)
- On every write: save to AsyncStorage immediately, then sync to server in background
- Graceful fallback: if server unreachable, local data still works

---

## Notification System

- Request permission on app startup (expo-notifications)
- When event created with reminderMinutes > 0: schedule local notification
- When event deleted: cancel its notification
- Notification ID stored alongside event for cleanup

---

## File Structure (Clean)

```
app/
  _layout.tsx              ← Root layout with providers
  (tabs)/
    _layout.tsx            ← Tab bar (5 tabs)
    index.tsx              ← Home screen
    chat.tsx               ← AI Chat screen
    rfps.tsx               ← RFP tracker
    calendar.tsx           ← Calendar screen
    sales.tsx              ← Sales pipeline
  rfp/[id].tsx             ← RFP detail (stack)
  deal/[id].tsx            ← Deal detail (stack)
  oauth/                   ← Auth callback (don't modify)
components/
  screen-container.tsx     ← SafeArea wrapper
  themed-view.tsx          ← View with theme bg
  ui/
    icon-symbol.tsx        ← Icon mapping
lib/
  data-provider.tsx        ← Single data context (events, rfps, deals, chat)
  local-store.ts           ← AsyncStorage CRUD helpers
  notification-manager.ts  ← Notification scheduling/cancellation
  utils.ts                 ← cn(), formatTime(), formatDate()
hooks/
  use-data.ts              ← Hook to access DataProvider
  use-colors.ts            ← Theme colors
constants/
  oauth.ts                 ← getApiBaseUrl() + OAuth config
server/
  routers.ts               ← tRPC routes (publicChat, voice, rfpSummarize, pdf)
  device-data.ts           ← Device-ID REST routes
  excel-export.ts          ← Excel generation
  _core/                   ← Framework (don't modify)
```

---

## Typography & Spacing

- Headers: Bold, 24-28px
- Subheaders: Semibold, 18-20px
- Body: Regular, 15-16px
- Caption: Regular, 12-13px, muted color
- Card padding: 16px
- Screen padding: 16-20px horizontal
- Section spacing: 24px vertical
