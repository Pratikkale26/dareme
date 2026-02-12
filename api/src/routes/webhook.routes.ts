import { Router } from "express";
import { env } from "../config/env";
import { processHeliusWebhook } from "../services/indexer.service";

const router = Router();

/**
 * POST /api/webhooks/helius
 * 
 * Helius sends enhanced transaction data here whenever our program
 * processes a transaction on-chain. This is how we keep the DB
 * in sync with the blockchain.
 * 
 * Setup TODO: Configure a Helius webhook at https://dev.helius.xyz/
 *   - URL: https://your-api.com/api/webhooks/helius
 *   - Type: Enhanced
 *   - Program: Your deployed program ID
 *   - Auth Header: Your HELIUS_API_KEY
 */
router.post("/helius", async (req, res) => {
    try {
        // Verify Helius auth header
        const authHeader = req.headers["authorization"];
        if (!authHeader || authHeader !== env.HELIUS_API_KEY) {
            console.warn("⚠️ Webhook: Unauthorized request");
            res.status(401).json({ error: "Unauthorized" });
            return;
        }

        const transactions = Array.isArray(req.body) ? req.body : [req.body];

        console.log(`📡 Webhook: Received ${transactions.length} transaction(s)`);

        // Process async — respond immediately to Helius
        // (Helius has a 15s timeout, we don't want to hold the connection)
        res.status(200).json({ received: true });

        // Process in background
        await processHeliusWebhook(transactions);
    } catch (err) {
        console.error("Webhook error:", err);
        // Still respond 200 so Helius doesn't retry endlessly
        if (!res.headersSent) {
            res.status(200).json({ received: true, error: "Processing error" });
        }
    }
});

export default router;
