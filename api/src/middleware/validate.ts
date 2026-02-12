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
        req.query = result.data;
        next();
    };
}
