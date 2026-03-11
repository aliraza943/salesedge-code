# How the app works without a hosted backend

This doc explains where your data lives, when the backend is called, and why PDF/Excel/chat can still work in a “production” build even if you haven’t deployed the server anywhere.

---

## 1. Where does the data come from?

| Scenario | Where data lives | Backend needed to view? |
|----------|------------------|-------------------------|
| **Not logged in** | Device only (AsyncStorage) | **No** – everything is local. |
| **Logged in** | Synced via tRPC; also cached in AsyncStorage | **Yes** – to sync; cached data can be shown offline. |

So: **viewing** events, RFPs, deals, brokers, and chat can work without a backend when you’re not authenticated, because that data is read from local storage.

---

## 2. When does the app call the backend?

The app uses **one base URL** for all API calls: `getApiBaseUrl()` in `constants/oauth.ts`. That value is used for:

- **tRPC** (e.g. chat, sync, auth): `{baseUrl}/api/trpc`
- **PDF (Attack Plan)**: `POST {baseUrl}/api/attack-plan-preview` (sends HTML; server returns a URL to open)
- **Excel export**: `POST {baseUrl}/api/export/rfps` or `{baseUrl}/api/export/schedule` (sends data; server returns download URL)
- **Auth**: `{baseUrl}/api/oauth/...`, `{baseUrl}/api/auth/...`

So:

- **Viewing** data: can be 100% local (AsyncStorage) when not authenticated.
- **PDF export, Excel export, chat (when logged in), auth**: always go through the backend; they only work if the app can reach that base URL.

---

## 3. Where does `baseUrl` come from?

`getApiBaseUrl()` (and in prebuild, `getApiBaseUrlAsync()`) decides the base URL in this order:

| Source | When it applies | Example |
|--------|------------------|---------|
| **`EXPO_PUBLIC_API_BASE_URL`** (app.config `extra.apiBaseUrl`) | Set at build/config time | `https://my-api.example.com` or `http://192.168.1.5:3000` |
| **Web** | Running in browser | Derived from `window.location` (e.g. port 8081 → 3000), or **empty** (relative URLs) |
| **Expo Go / dev with Metro** | `hostUri` / `debuggerHost` present | **Your computer’s IP** (e.g. `http://192.168.1.5:3000`) – the machine running Metro |
| **Prebuild (no Metro)** | No debugger host | **Your phone’s local IP** from expo-network (e.g. `http://192.168.1.105:3000`) |

So:

- **“Local IP” in dev/Expo Go** = computer’s IP → app talks to the server on your laptop. That’s why PDF/Excel/chat work when you run `pnpm dev`.
- **“Local IP” in a real production build** (no Metro) = phone’s IP → app would try to reach `http://<phone-ip>:3000`. Nothing runs on the phone on port 3000, so those API calls would fail unless you override the base URL.

---

## 4. How can PDF/Excel/chat work in the “production” app?

If you haven’t hosted the backend but the production app can still export PDFs/Excel and use chat, then the app is **not** relying on the phone’s IP for the API. One of these is true:

1. **You set `EXPO_PUBLIC_API_BASE_URL` (or `apiBaseUrl` in app.config)**  
   The app uses that URL for all API calls. Common cases:
   - A **tunnel** (e.g. ngrok, Cloudflare Tunnel) pointing to your laptop. You run the server locally; the production app hits the tunnel URL → your machine. So “not hosted” = not on a fixed server, but still reachable via tunnel.
   - Your **computer’s local IP** (e.g. `http://192.168.1.5:3000`) baked into the build for testing. Then PDF/Excel/chat work only when the phone and the computer are on the same WiFi and the server is running.

2. **You’re on Web**  
   If `getApiBaseUrl()` is empty, the app uses **relative** URLs (e.g. `fetch("/api/attack-plan-preview", ...)`). So the request goes to the **same origin** as the page. That only works if the same deployment serves both the app and the API (e.g. one host for frontend + backend). So the “backend” is hosted together with the app, even if you don’t think of it as a separate hosted backend.

3. **Only local data is used**  
   Viewing and scrolling work from AsyncStorage. If you didn’t actually trigger PDF/Excel export or login in that build, you wouldn’t see those API calls fail. So it can look like “everything works” until you try export or cloud sync.

---

## 5. Short summary

| What you see | Why it works |
|--------------|--------------|
| View data (events, RFPs, etc.) without backend | Data is in AsyncStorage; no API needed to read it. |
| PDF/Excel export and chat “work with local IP” | In dev/Expo Go, “local IP” is your **computer’s** IP (Metro), so the app hits the server on your machine. In a real production build, it only keeps working if you set `EXPO_PUBLIC_API_BASE_URL` (e.g. tunnel or same-origin on web). |
| No separate “hosted” backend | Either you use a tunnel to your laptop, or the API is served from the same host as the app (e.g. web), or you’re only using local-only features. |

So: **local storage** explains why viewing data works without a server. **API calls for PDF/Excel/chat** only succeed when the app can reach a running server at the resolved `baseUrl` – either your computer (via Metro or tunnel) or a real hosted/tunneled URL you set in config.
