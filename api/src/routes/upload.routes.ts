import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { generatePresignedUploadUrl } from "../lib/s3";

const router = Router();

// ── GET /api/upload/presigned-url ─────────────────────────────────────────
// Get a presigned S3 URL for direct client-side upload.
// this will not bring load to our servers and more effiecient way
const presignedQuerySchema = z.object({
    contentType: z.enum(["video/mp4", "video/webm", "image/jpeg", "image/png", "image/webp"]),
    fileSize: z.coerce.number().int().positive().max(100 * 1024 * 1024), // max 100MB
});

router.get(
    "/presigned-url",
    authMiddleware,
    validateQuery(presignedQuerySchema),
    async (req, res) => {
        try {
            const { contentType, fileSize } = req.query as any;
            const result = await generatePresignedUploadUrl(
                req.user!.id,
                contentType,
                fileSize
            );
            res.json(result);
        } catch (err: any) {
            console.error("Presigned URL error:", err);
            res.status(400).json({ error: err.message || "Failed to generate upload URL" });
        }
    }
);

export default router;
