import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validateBody } from "../middleware/validate";
import { createProof, getProofsForDare } from "../services/proof.service";

const router = Router();

// ── POST /api/dares/:dareId/proof ─────────────────────────────────────────
// Submit proof metadata after uploading media to S3 and sending on-chain tx.
const submitProofSchema = z.object({
    mediaUrl: z.string().url(),
    mediaType: z.enum(["VIDEO", "IMAGE"]),
    proofHash: z.string().min(1).max(128),
    caption: z.string().max(500).optional(),
});

router.post(
    "/:dareId/proof",
    authMiddleware,
    validateBody(submitProofSchema),
    async (req, res) => {
        try {
            const proof = await createProof({
                dareId: req.params.dareId as string,
                submitterId: req.user!.id,
                mediaUrl: req.body.mediaUrl,
                mediaType: req.body.mediaType,
                proofHash: req.body.proofHash,
                caption: req.body.caption,
            });

            res.status(201).json({ proof });
        } catch (err: any) {
            if (err?.code === "P2003") {
                res.status(404).json({ error: "Dare not found" });
                return;
            }
            console.error("Submit proof error:", err);
            res.status(500).json({ error: "Failed to submit proof" });
        }
    }
);

// ── GET /api/dares/:dareId/proofs ─────────────────────────────────────────
// Get all proofs for a dare.
router.get("/:dareId/proofs", async (req, res) => {
    try {
        const proofs = await getProofsForDare(req.params.dareId as string);
        res.json({ proofs });
    } catch (err) {
        console.error("Get proofs error:", err);
        res.status(500).json({ error: "Failed to fetch proofs" });
    }
});

export default router;
