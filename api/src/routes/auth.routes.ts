import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { loginOrCreateUser } from "../services/user.service";

const router = Router();

/**
 * POST /api/auth/login
 * Verify Privy token and return user profile with synced linked accounts.
 * The authMiddleware already verifies the token and creates the user if needed,
 * but this endpoint also syncs linked accounts from Privy (wallet, X, email).
 */
router.post("/login", authMiddleware, async (req, res) => {
    try {
        const user = await loginOrCreateUser(req.user!.privyId);
        res.json({ user });
    } catch (err: any) {
        console.error("Login error:", err);
        res.status(500).json({ error: "Login failed" });
    }
});

export default router;
