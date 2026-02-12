import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { prisma } from "./db/client";

const app = express();

// Middleware
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "dareme-api" });
});

// Health check with DB
app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok", db: "connected" });
    } catch (err) {
        res.status(500).json({ status: "error", db: "disconnected" });
    }
});

// Routes will be mounted here in subsequent steps:
// app.use("/api/auth", authRoutes);
// app.use("/api/users", userRoutes);
// app.use("/api/dares", dareRoutes);
// app.use("/api/upload", uploadRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/webhooks", webhookRoutes);

app.listen(env.PORT, () => {
    console.log(`🚀 DareMe API running on http://localhost:${env.PORT}`);
});

export { app };