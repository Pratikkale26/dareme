import { createHash } from "crypto";

/** SHA-256 hash of a string, returns hex */
export function sha256(input: string): string {
    return createHash("sha256").update(input).digest("hex");
}

/** SHA-256 hash of a string, returns 32-byte Uint8Array (for on-chain comparison) */
export function sha256Bytes(input: string): Uint8Array {
    return new Uint8Array(createHash("sha256").update(input).digest());
}
