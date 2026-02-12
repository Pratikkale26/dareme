import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validateBody, validateQuery } from "../middleware/validate";
import { sha256 } from "../lib/hash";
import {
    createDare,
    getDareById,
    getDareByPDA,
    getDareFeed,
    getTrendingDares,
    findDaresForXHandle,
} from "../services/dare.service";

const router = Router();

// ── POST /api/dares ───────────────────────────────────────────────────────
// Create dare metadata (after on-chain tx confirms).
const createDareSchema = z.object({
    onChainId: z.coerce.number().int().positive(),
    darePDA: z.string().min(32).max(64),
    vaultPDA: z.string().min(32).max(64),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    amount: z.coerce.number().int().positive(), // lamports
    dareType: z.enum(["DIRECT_DARE", "PUBLIC_BOUNTY"]),
    winnerSelection: z.enum(["CHALLENGER_SELECT", "COMMUNITY_VOTE"]),
    deadline: z.string().datetime(),
    category: z.string().max(50).optional(),
    tags: z.array(z.string().max(30)).max(10).optional(),
    targetXHandle: z.string().max(50).optional(),
});

router.post(
    "/",
    authMiddleware,
    validateBody(createDareSchema),
    async (req, res) => {
        try {
            const body = req.body;
            const descriptionHash = sha256(body.description);

            const dare = await createDare({
                onChainId: BigInt(body.onChainId),
                darePDA: body.darePDA,
                vaultPDA: body.vaultPDA,
                challengerId: req.user!.id,
                title: body.title,
                description: body.description,
                descriptionHash,
                amount: BigInt(body.amount),
                dareType: body.dareType,
                winnerSelection: body.winnerSelection,
                deadline: new Date(body.deadline),
                category: body.category,
                tags: body.tags,
                targetXHandle: body.targetXHandle,
            });

            res.status(201).json({ dare: serializeDare(dare) });
        } catch (err: any) {
            if (err?.code === "P2002") {
                // Unique constraint violation (duplicate onChainId or darePDA)
                res.status(409).json({ error: "Dare already exists" });
                return;
            }
            console.error("Create dare error:", err);
            res.status(500).json({ error: "Failed to create dare" });
        }
    }
);

// ── GET /api/dares ────────────────────────────────────────────────────────
// Browse/filter dare feed (paginated).
const feedQuerySchema = z.object({
    status: z.enum(["CREATED", "ACTIVE", "PROOF_SUBMITTED", "COMPLETED", "EXPIRED", "CANCELLED", "REJECTED", "REFUSED"]).optional(),
    dareType: z.enum(["DIRECT_DARE", "PUBLIC_BOUNTY"]).optional(),
    category: z.string().optional(),
    search: z.string().max(200).optional(),
    sort: z.enum(["newest", "amount", "deadline"]).default("newest"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

router.get("/", validateQuery(feedQuerySchema), async (req, res) => {
    try {
        const filters = req.query as any;
        const result = await getDareFeed(filters);
        res.json({
            dares: result.dares.map(serializeDare),
            total: result.total,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages,
        });
    } catch (err) {
        console.error("Feed error:", err);
        res.status(500).json({ error: "Failed to fetch dares" });
    }
});

// ── GET /api/dares/trending ───────────────────────────────────────────────
// Top dares by amount.
router.get("/trending", async (_req, res) => {
    try {
        const dares = await getTrendingDares(10);
        res.json({ dares: dares.map(serializeDare) });
    } catch (err) {
        console.error("Trending error:", err);
        res.status(500).json({ error: "Failed to fetch trending dares" });
    }
});

// ── GET /api/dares/for-x/:handle ──────────────────────────────────────────
// Find open dares targeting a specific X handle (used on signup matching).
router.get("/for-x/:handle", async (req, res) => {
    try {
        const dares = await findDaresForXHandle(req.params.handle);
        res.json({ dares: dares.map(serializeDare) });
    } catch (err) {
        console.error("X handle dares error:", err);
        res.status(500).json({ error: "Failed to fetch dares" });
    }
});

// ── GET /api/dares/:id ────────────────────────────────────────────────────
// Single dare detail (by DB id or PDA address).
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Try DB id first, then PDA address
        let dare = await getDareById(id);
        if (!dare) {
            dare = await getDareByPDA(id);
        }

        if (!dare) {
            res.status(404).json({ error: "Dare not found" });
            return;
        }

        res.json({ dare: serializeDare(dare) });
    } catch (err) {
        console.error("Get dare error:", err);
        res.status(500).json({ error: "Failed to fetch dare" });
    }
});

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Serialize BigInt fields to strings for JSON response.
 * JSON.stringify can't handle BigInt natively.
 */
function serializeDare(dare: any): any {
    return {
        ...dare,
        onChainId: dare.onChainId?.toString(),
        amount: dare.amount?.toString(),
    };
}

export default router;
