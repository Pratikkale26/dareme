import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import {
    getUserById,
    getUserByWallet,
    getUserByXHandle,
    updateUserProfile,
    getUserDares,
} from "../services/user.service";

const router = Router();

// ── GET /api/users/me ─────────────────────────────────────────────────────
// Returns current authenticated user's profile.
router.get("/me", authMiddleware, async (req, res) => {
    try {
        const user = await getUserById(req.user!.id);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        res.json({ user });
    } catch (err) {
        console.error("Get me error:", err);
        res.status(500).json({ error: "Failed to fetch profile" });
    }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────
// Update current user's profile (displayName, bio, avatarUrl).
const updateProfileSchema = z.object({
    displayName: z.string().max(50).optional(),
    bio: z.string().max(280).optional(),
    avatarUrl: z.string().url().optional(),
});

router.patch(
    "/me",
    authMiddleware,
    validateBody(updateProfileSchema),
    async (req, res) => {
        try {
            const user = await updateUserProfile(req.user!.id, req.body);
            res.json({ user });
        } catch (err) {
            console.error("Update profile error:", err);
            res.status(500).json({ error: "Failed to update profile" });
        }
    }
);

// ── GET /api/users/handle/:handle ─────────────────────────────────────────
// Lookup user by X/Twitter handle (for resolving target wallet).
router.get("/handle/:handle", async (req, res) => {
    try {
        const handle = req.params.handle.replace('@', '');
        const user = await getUserByXHandle(handle);
        if (!user) {
            res.status(404).json({ error: "User not found for this X handle" });
            return;
        }
        res.json({ user });
    } catch (err) {
        console.error("Get user by handle error:", err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// ── GET /api/users/:id ────────────────────────────────────────────────────
// Public profile by user ID.
router.get("/:id", async (req, res) => {
    try {
        const user = await getUserById(req.params.id);
        if (!user) {
            res.status(404).json({ error: "User not found" });
            return;
        }
        // Strip private fields for public view
        const { privyId, email, ...publicProfile } = user;
        res.json({ user: publicProfile });
    } catch (err) {
        console.error("Get user error:", err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// ── GET /api/users/wallet/:address ────────────────────────────────────────
// Lookup user by Solana wallet address.
router.get("/wallet/:address", async (req, res) => {
    try {
        const user = await getUserByWallet(req.params.address);
        if (!user) {
            res.status(404).json({ error: "User not found for this wallet" });
            return;
        }
        res.json({ user });
    } catch (err) {
        console.error("Get user by wallet error:", err);
        res.status(500).json({ error: "Failed to fetch user" });
    }
});

// ── GET /api/users/:id/dares ──────────────────────────────────────────────
// User's dare history: ?role=created|accepted&page=1&limit=20
const dareHistorySchema = z.object({
    role: z.enum(["created", "accepted"]).default("created"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/:id/dares", validateQuery(dareHistorySchema), async (req, res) => {
    try {
        const { role, page, limit } = (res.locals.query || req.query) as any;
        const result = await getUserDares(req.params.id as string, role, page, limit);
        res.json(result);
    } catch (err) {
        console.error("Get user dares error:", err);
        res.status(500).json({ error: "Failed to fetch dares" });
    }
});

export default router;
