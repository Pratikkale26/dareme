import { Connection, PublicKey } from "@solana/web3.js";
import { env } from "../config/env";

export const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");

/**
 * Verify a transaction exists and is confirmed on-chain.
 */
export async function verifyTransaction(signature: string): Promise<boolean> {
    try {
        const tx = await connection.getTransaction(signature, {
            commitment: "confirmed",
            maxSupportedTransactionVersion: 0,
        });
        return tx !== null && tx.meta?.err === null;
    } catch {
        return false;
    }
}

/**
 * Get SOL balance for a public key (in lamports).
 */
export async function getBalance(pubkey: string): Promise<number> {
    return connection.getBalance(new PublicKey(pubkey));
}
