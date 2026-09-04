import { createServer } from "http";
import express from "express";
import cors from "cors";
import { Server } from "socket.io";
import { prisma } from "@booking/database";
import { getProjectRoom, REALTIME_EVENTS } from "@booking/realtime";
import "./expiry-worker";

const WS_INTERNAL_SECRET = process.env.WS_INTERNAL_SECRET?.trim();
const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(express.json({ limit: "256kb" }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

function assertEmitAuthorized(req: express.Request, res: express.Response): boolean {
  if (process.env.NODE_ENV !== "production" && !WS_INTERNAL_SECRET) {
    return true;
  }
  if (!WS_INTERNAL_SECRET) {
    res.status(500).json({ error: "WS_INTERNAL_SECRET is not configured" });
    return false;
  }
  const provided = req.headers["x-ws-internal-secret"];
  if (provided !== WS_INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on("join:project", (projectId: string) => {
    if (typeof projectId !== "string" || projectId.length > 64) return;
    socket.join(getProjectRoom(projectId));
    console.log(`${socket.id} joined project ${projectId}`);
  });

  socket.on("leave:project", (projectId: string) => {
    if (typeof projectId !== "string" || projectId.length > 64) return;
    socket.leave(getProjectRoom(projectId));
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

app.post("/emit", (req, res) => {
  if (!assertEmitAuthorized(req, res)) return;

  const { projectId, event, payload } = req.body;
  if (!projectId || !event || typeof projectId !== "string" || typeof event !== "string") {
    return res.status(400).json({ error: "projectId and event required" });
  }
  io.to(getProjectRoom(projectId)).emit(event, payload);
  res.json({ ok: true });
});

app.get("/health", async (req, res) => {
  const live = String(req.query.live ?? "") === "1";
  const timestamp = new Date().toISOString();
  res.setHeader("cache-control", "no-store");

  if (live) {
    return res.status(200).json({ status: "ok", live: true, service: "ws-server", timestamp });
  }

  let database = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    database = true;
  } catch {
    database = false;
  }

  const ok = database;
  return res.status(ok ? 200 : 503).json({
    status: ok ? "ok" : "degraded",
    service: "ws-server",
    checks: { database },
    timestamp,
  });
});

const PORT = process.env.PORT || process.env.WS_PORT || 3002;
httpServer.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

export { io };
