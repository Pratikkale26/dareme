import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { prisma } from "./db/client";

// Route imports
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import dareRoutes from "./routes/dare.routes";

const app = express();

// Middleware
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"], credentials: true }));
app.use(express.json());

// Health check
app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "dareme-api" });
});

app.get("/health", async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: "ok", db: "connected" });
    } catch (err) {
        res.status(500).json({ status: "error", db: "disconnected" });
    }
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dares", dareRoutes);

// Future routes (Steps 5-8):
// app.use("/api/upload", uploadRoutes);
// app.use("/api/notifications", notificationRoutes);
// app.use("/api/webhooks", webhookRoutes);

app.listen(env.PORT, () => {
    console.log(`🚀 DareMe API running on http://localhost:${env.PORT}`);
});

export { app };