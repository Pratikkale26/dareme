import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import {
    getUserNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
} from "../services/notification.service";

const router = Router();

// All notification routes require auth
router.use(authMiddleware);

// ── GET /api/notifications ────────────────────────────────────────────────
// Paginated list of user's notifications.
const listQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/", validateQuery(listQuerySchema), async (req, res) => {
    try {
        const { page, limit } = (res.locals.query || req.query) as any;
        const result = await getUserNotifications(req.user!.id, page, limit);
        res.json(result);
    } catch (err) {
        console.error("Get notifications error:", err);
        res.status(500).json({ error: "Failed to fetch notifications" });
    }
});

// ── GET /api/notifications/unread-count ───────────────────────────────────
// Get unread notification count (for badge).
router.get("/unread-count", async (req, res) => {
    try {
        const count = await getUnreadCount(req.user!.id);
        res.json({ count });
    } catch (err) {
        console.error("Unread count error:", err);
        res.status(500).json({ error: "Failed to get unread count" });
    }
});

// ── PATCH /api/notifications/read-all ─────────────────────────────────────
// Mark all notifications as read.
router.patch("/read-all", async (req, res) => {
    try {
        await markAllAsRead(req.user!.id);
        res.json({ success: true });
    } catch (err) {
        console.error("Mark all read error:", err);
        res.status(500).json({ error: "Failed to mark all as read" });
    }
});

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────
// Mark a single notification as read.
router.patch("/:id/read", async (req, res) => {
    try {
        await markAsRead(req.params.id as string, req.user!.id);
        res.json({ success: true });
    } catch (err) {
        console.error("Mark read error:", err);
        res.status(500).json({ error: "Failed to mark as read" });
    }
});

export default router;
