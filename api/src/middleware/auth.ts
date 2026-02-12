import type { Request, Response, NextFunction } from "express";
import { privyClient } from "../lib/privy";
import { prisma } from "../db/client";
import { loginOrCreateUser, syncPrivyAccounts } from "../services/user.service";

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                privyId: string;
                walletAddress: string | null;
                xHandle: string | null;
                email: string | null;
                displayName: string | null;
            };
        }
    }
}

/**
 * Auth middleware — verifies Privy JWT access token.
 * Extracts user from DB (or creates on first login).
 * Attaches req.user for downstream handlers.
 */
export async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing or invalid Authorization header" });
            return;
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            res.status(401).json({ error: "Missing Authorizatino token" });
            return;
        }

        // Verify token with Privy
        let verifiedClaims;
        try {
            verifiedClaims = await privyClient.verifyAuthToken(token);
        } catch (err) {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
        }

        const privyId = verifiedClaims.userId;

        // Look up user in DB
        let user = await prisma.user.findUnique({
            where: { privyId },
            select: {
                id: true,
                privyId: true,
                walletAddress: true,
                xHandle: true,
                email: true,
                displayName: true,
            },
        });

        // 1. User doesn't exist? Create with full Privy sync
        if (!user) {
            user = await loginOrCreateUser(privyId);
        }
        // 2. User exists but missing critical info (e.g. just linked Twitter)? Sync.
        else if (!user.xHandle || !user.walletAddress) {
            const linked = await syncPrivyAccounts(privyId);

            // Only update if we found new data that we were missing
            const shouldUpdate =
                (!user.xHandle && linked.xHandle) ||
                (!user.walletAddress && linked.walletAddress);

            if (shouldUpdate) {
                user = await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        ...(linked.xHandle && { xHandle: linked.xHandle }),
                        ...(linked.xId && { xId: linked.xId }),
                        ...(linked.walletAddress && { walletAddress: linked.walletAddress }),
                    },
                    select: {
                        id: true,
                        privyId: true,
                        walletAddress: true,
                        xHandle: true,
                        email: true,
                        displayName: true,
                    },
                });
            }
        }

        req.user = user || undefined;
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        res.status(500).json({ error: "Internal auth error" });
    }
}
