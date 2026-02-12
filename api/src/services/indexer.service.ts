import { prisma } from "../db/client";
import { notifyUser } from "./notification.service";
import type { DareStatus } from "../generated/prisma/client";

/**
 * Maps on-chain instruction names to the DB actions and notifications we generate.
 * This is the core sync layer: Helius → DB.
 *
 * Architecture note:
 * - The FRONTEND sends on-chain transactions directly via Anchor
 * - Helius webhooks fire when those txs confirm
 * - This indexer updates the DB to match on-chain state
 * - This ensures the DB is EVENTUALLY CONSISTENT with the chain
 * - The chain is always the source of truth
 */

// ── Instruction Handlers ──────────────────────────────────────────────────

interface ParsedAccounts {
    [key: string]: string; // account name → pubkey
}

/**
 * Process a Helius enhanced transaction webhook payload.
 * Helius sends an array of transaction objects.
 */
export async function processHeliusWebhook(transactions: any[]) {
    for (const tx of transactions) {
        try {
            await processTransaction(tx);
        } catch (err) {
            console.error("Error processing tx:", tx?.signature, err);
        }
    }
}

async function processTransaction(tx: any) {
    // Skip failed transactions
    if (tx.transactionError) return;

    const signature = tx.signature;
    const instructions = tx.instructions || [];

    for (const ix of instructions) {
        // Only process our program's instructions
        // The program ID should match our deployed program
        const innerIxs = ix.innerInstructions || [];

        // Helius enhanced transactions provide parsed instruction data
        // We look at the instruction type/name to determine what happened
        await processInstruction(ix, tx);
    }
}

async function processInstruction(ix: any, tx: any) {
    // Helius enhanced transaction format includes events and account data
    // We extract what we need from the transaction's account keys and logs
    const logs: string[] = tx.meta?.logMessages || tx.logMessages || [];

    // Parse instruction type from logs
    const instructionType = parseInstructionType(logs);
    if (!instructionType) return;

    console.log(`📡 Indexer: Processing ${instructionType} (tx: ${tx.signature?.slice(0, 8)}...)`);

    switch (instructionType) {
        case "create_dare":
            await handleCreateDare(tx);
            break;
        case "accept_dare":
            await handleAcceptDare(tx);
            break;
        case "refuse_dare":
            await handleRefuseDare(tx);
            break;
        case "submit_proof":
            await handleSubmitProof(tx);
            break;
        case "approve_dare":
            await handleApproveDare(tx);
            break;
        case "reject_dare":
            await handleRejectDare(tx);
            break;
        case "cancel_dare":
            await handleCancelDare(tx);
            break;
        case "expire_dare":
            await handleExpireDare(tx);
            break;
    }
}

/**
 * Parse instruction type from transaction logs.
 * Anchor logs: "Program log: Instruction: CreateDare"
 */
function parseInstructionType(logs: string[]): string | null {
    for (const log of logs) {
        const match = log.match(/Instruction: (\w+)/);
        if (match && match[1]) {
            // Convert PascalCase to snake_case
            return match[1].replace(/([A-Z])/g, "_$1").toLowerCase().slice(1);
        }
    }
    return null;
}

// ── Individual Handlers ───────────────────────────────────────────────────

async function handleCreateDare(tx: any) {
    // When webhook arrives before the frontend POST /api/dares,
    // we just log it. The frontend call will create the full record.
    // If webhook arrives after, the record already exists — skip.
    const darePDA = findAccountByIndex(tx, 1); // dare account is typically index 1
    if (!darePDA) return;

    const existing = await prisma.dare.findUnique({ where: { darePDA } });
    if (existing) {
        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... already in DB`);
        return;
    }

    // Dare doesn't exist yet — frontend hasn't called POST /api/dares yet.
    // That's fine, the frontend will create it. Log for monitoring.
    console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB yet (waiting for frontend POST)`);
}

async function handleAcceptDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    const dareePubkey = findAccountByIndex(tx, 0); // daree is the signer
    if (!darePDA) return;

    // Find the daree user by wallet
    const dareeUser = dareePubkey
        ? await prisma.user.findUnique({ where: { walletAddress: dareePubkey } })
        : null;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: {
                status: "ACTIVE",
                dareeId: dareeUser?.id || undefined,
                acceptedAt: new Date(),
            },
        });

        // Notify challenger
        await notifyUser(
            dare.challengerId,
            dare.id,
            "DARE_ACCEPTED",
            "Dare Accepted! 🎯",
            `Someone accepted your dare "${dare.title}". The clock is ticking!`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → ACTIVE`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB yet (accept before create)`);
        } else throw err;
    }
}

async function handleRefuseDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: {
                status: "REFUSED",
                refusedAt: new Date(),
            },
        });

        // Notify challenger of refusal
        await notifyUser(
            dare.challengerId,
            dare.id,
            "DARE_REFUSED",
            "Dare Refused 😤",
            `Your dare "${dare.title}" was refused. Your SOL has been refunded.`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → REFUSED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (refuse)`);
        } else throw err;
    }
}

async function handleSubmitProof(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "PROOF_SUBMITTED" },
        });

        // Notify challenger to review
        await notifyUser(
            dare.challengerId,
            dare.id,
            "PROOF_SUBMITTED",
            "Proof Submitted! 📹",
            `Proof has been submitted for "${dare.title}". Review it now!`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → PROOF_SUBMITTED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (proof)`);
        } else throw err;
    }
}

async function handleApproveDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

        // Notify daree they earned SOL
        const amountSOL = Number(dare.amount) / 1_000_000_000;
        await notifyUser(
            dare.dareeId,
            dare.id,
            "DARE_APPROVED",
            "Dare Completed! 🎉💰",
            `Your proof for "${dare.title}" was approved! ${amountSOL} SOL earned.`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → COMPLETED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (approve)`);
        } else throw err;
    }
}

async function handleRejectDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "REJECTED" },
        });

        // Notify daree their proof was rejected
        await notifyUser(
            dare.dareeId,
            dare.id,
            "DARE_REJECTED",
            "Proof Rejected ❌",
            `Your proof for "${dare.title}" was rejected. You can resubmit.`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → REJECTED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (reject)`);
        } else throw err;
    }
}

async function handleCancelDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "CANCELLED" },
        });

        // Notify daree if one exists
        await notifyUser(
            dare.dareeId,
            dare.id,
            "DARE_CANCELLED",
            "Dare Cancelled",
            `The dare "${dare.title}" has been cancelled.`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → CANCELLED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (cancel)`);
        } else throw err;
    }
}

async function handleExpireDare(tx: any) {
    const darePDA = findAccountByIndex(tx, 1);
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "EXPIRED" },
        });

        // Notify both parties
        await notifyUser(
            dare.challengerId,
            dare.id,
            "DARE_EXPIRED",
            "Dare Expired ⏰",
            `Your dare "${dare.title}" has expired.`
        );
        await notifyUser(
            dare.dareeId,
            dare.id,
            "DARE_EXPIRED",
            "Dare Expired ⏰",
            `The dare "${dare.title}" has expired.`
        );

        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... → EXPIRED`);
    } catch (err: any) {
        if (err?.code === "P2025") {
            console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB (expire)`);
        } else throw err;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Extract an account pubkey by index from a Helius enhanced transaction.
 */
function findAccountByIndex(tx: any, index: number): string | null {
    const accounts = tx.transaction?.message?.accountKeys
        || tx.accountKeys
        || tx.transaction?.message?.staticAccountKeys
        || [];

    if (index < accounts.length) {
        // Helius can return string or { pubkey: string }
        const acct = accounts[index];
        return typeof acct === "string" ? acct : acct?.pubkey || null;
    }
    return null;
}
