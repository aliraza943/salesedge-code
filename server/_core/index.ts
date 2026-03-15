import dns from "dns";

dns.setServers(["8.8.8.8", "1.1.1.1"]);
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerAuthRoutes } from "../auth-mongo";
import { registerExcelRoutes } from "../excel-export";
import { registerDeviceDataRoutes } from "../device-data";
import { registerRfpRoutes } from "../rfps-mongo";
import { registerEventRoutes } from "../events-mongo";
import { registerDealRoutes } from "../deals-mongo";
import { registerBrokerRoutes } from "../brokers-mongo";
import { registerChatRoutes } from "../chat-mongo";
import { registerSalesGoalRoutes } from "../sales-goal-mongo";
import { registerRfpFieldLabelsRoutes } from "../rfp-field-labels-mongo";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerAuthRoutes(app);
  registerExcelRoutes(app);
  registerDeviceDataRoutes(app);
  registerRfpRoutes(app);
  registerEventRoutes(app);
  registerDealRoutes(app);
  registerBrokerRoutes(app);
  registerChatRoutes(app);
  registerSalesGoalRoutes(app);
  registerRfpFieldLabelsRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // ─── Attack Plan Preview (temporary HTML storage) ───────
  // Stores HTML in memory and serves it as a page the user can print/save as PDF
  const attackPlanStore = new Map<string, { html: string; createdAt: number }>();

  // Clean up old entries every 10 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of attackPlanStore) {
      if (now - value.createdAt > 30 * 60 * 1000) { // 30 min expiry
        attackPlanStore.delete(key);
      }
    }
  }, 10 * 60 * 1000);

  app.post("/api/attack-plan-preview", (req, res) => {
    try {
      const { html } = req.body;
      if (!html || typeof html !== "string") {
        res.status(400).json({ error: "Missing html field" });
        return;
      }
      const id = `ap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      attackPlanStore.set(id, { html, createdAt: Date.now() });

      // Build the URL using the request's origin or host header
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "http";
      const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${port}`;
      const url = `${protocol}://${host}/api/attack-plan-preview/${id}`;

      res.json({ url, id });
    } catch (err) {
      console.error("Attack plan preview error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/attack-plan-preview/:id", (req, res) => {
    const entry = attackPlanStore.get(req.params.id);
    if (!entry) {
      res.status(404).send("<html><body><h1>Summary expired or not found</h1><p>Please generate a new summary from the app.</p></body></html>");
      return;
    }
    // Serve the HTML page directly — user can use browser's Share > Print > Save as PDF
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(entry.html);
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  // Serve web dashboard static files (production build)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDashboardPath = path.resolve(__dirname, "../../web-dashboard/dist");
  app.use("/dashboard", express.static(webDashboardPath));
  app.get("/dashboard/*", (_req, res) => {
    res.sendFile(path.join(webDashboardPath, "index.html"));
  });

  // Serve privacy policy and support pages
  const staticPath = path.resolve(__dirname, "../static");
  app.get("/privacy", (_req, res) => {
    res.sendFile(path.join(staticPath, "privacy.html"));
  });
  app.get("/support", (_req, res) => {
    res.sendFile(path.join(staticPath, "support.html"));
  });

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
    console.log(`[api] server listening on port ${port}`);
    console.log(`[web] dashboard available at http://localhost:${port}/dashboard`);
  });
}

startServer().catch(console.error);
