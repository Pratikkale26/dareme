import type { Request, Response, NextFunction } from "express";
import { z, type ZodSchema } from "zod";

/**
 * Creates an Express middleware that validates request body against a Zod schema.
 * On failure, returns 400 with validation errors.
 */
export function validateBody(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error: "Validation failed",
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}

/**
 * Creates an Express middleware that validates query params against a Zod schema.
 * On failure, returns 400 with validation errors.
 * Note: In Bun, req.query is readonly so we store parsed data on res.locals.query
 * and also copy individual keys to avoid the readonly assignment error.
 */
export function validateQuery(schema: ZodSchema) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);
        if (!result.success) {
            res.status(400).json({
                error: "Validation failed",
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        // Store validated data on res.locals (Bun's req.query is readonly)
        res.locals.query = result.data;
        // Also try to copy individual keys for compatibility
        try {
            for (const [key, value] of Object.entries(result.data as Record<string, unknown>)) {
                (req.query as any)[key] = value;
            }
        } catch {
            // If req.query is fully frozen, that's fine — use res.locals.query
        }
        next();
    };
}
