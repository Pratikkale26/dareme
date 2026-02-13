import { prisma } from "../db/client";
import { notifyUser } from "./notification.service";
import type { DareStatus } from "../generated/prisma/client";
import { sha256 } from "../lib/hash";

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
 *
 * Helius Enhanced Transaction format keys:
 *   accountData, description, events, fee, feePayer, instructions,
 *   nativeTransfers, signature, slot, source, timestamp, tokenTransfers,
 *   transactionError, type
 */

// ── Anchor Instruction Discriminators ─────────────────────────────────────
// Anchor uses sha256("global:<instruction_name>")[0..8] as the instruction discriminator.
// We precompute them to match against the `data` field in Helius instructions.

function anchorDiscriminator(name: string): string {
    // Anchor discriminator is first 8 bytes of sha256("global:<name>")
    const hash = sha256(`global:${name}`);
    return hash.slice(0, 16); // 8 bytes = 16 hex chars
}

const DISCRIMINATORS: Record<string, string> = {
    create_dare: anchorDiscriminator("create_dare"),
    accept_dare: anchorDiscriminator("accept_dare"),
    refuse_dare: anchorDiscriminator("refuse_dare"),
    submit_proof: anchorDiscriminator("submit_proof"),
    approve_dare: anchorDiscriminator("approve_dare"),
    reject_dare: anchorDiscriminator("reject_dare"),
    cancel_dare: anchorDiscriminator("cancel_dare"),
    expire_dare: anchorDiscriminator("expire_dare"),
};

// Build reverse lookup: hex discriminator → instruction name
const DISC_TO_NAME: Record<string, string> = {};
for (const [name, disc] of Object.entries(DISCRIMINATORS)) {
    DISC_TO_NAME[disc] = name;
    console.log(`  📋 Discriminator for ${name}: ${disc}`);
}

// ── Main Entry Point ──────────────────────────────────────────────────────

interface ParsedAccounts {
    [key: string]: string;
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
    if (tx.transactionError) {
        console.log(`  ⚠️ Skipping failed tx: ${tx.signature?.slice(0, 8)}...`);
        return;
    }

    const signature = tx.signature;
    console.log(`� Processing tx: ${signature?.slice(0, 12)}...`);

    // Helius Enhanced format: instructions is an array of instruction objects
    const instructions = tx.instructions || [];
    console.log(`  🔍 Instructions count: ${instructions.length}`);

    for (const ix of instructions) {
        const programId = ix.programId;
        const data = ix.data; // base58-encoded instruction data
        const accounts = ix.accounts || [];

        console.log(`  🔍 Instruction: programId=${programId?.slice(0, 12)}..., accounts=${accounts.length}, data=${data?.slice(0, 20)}...`);

        // Try to match the instruction discriminator
        const instructionType = parseInstructionFromData(data);

        if (instructionType) {
            console.log(`  ✅ Matched instruction: ${instructionType}`);
            await handleInstruction(instructionType, accounts, tx);
        } else {
            // Also check inner instructions
            const innerIxs = ix.innerInstructions || [];
            for (const inner of innerIxs) {
                const innerType = parseInstructionFromData(inner.data);
                if (innerType) {
                    console.log(`  ✅ Matched inner instruction: ${innerType}`);
                    await handleInstruction(innerType, inner.accounts || accounts, tx);
                }
            }
        }
    }
}

/**
 * Parse instruction type from base58-encoded instruction data.
 * Compares the first 8 bytes against known Anchor discriminators.
 */
function parseInstructionFromData(data: string | undefined): string | null {
    if (!data) return null;

    try {
        // Instruction data from Helius is base58-encoded.
        // Decode it to get the raw bytes, then check the first 8 bytes (discriminator).
        const decoded = base58ToHex(data);
        if (decoded.length < 16) return null; // Need at least 8 bytes

        const disc = decoded.slice(0, 16);
        return DISC_TO_NAME[disc] || null;
    } catch {
        return null;
    }
}

/**
 * Simple base58 to hex decoder.
 */
function base58ToHex(input: string): string {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let num = BigInt(0);
    for (const char of input) {
        const idx = ALPHABET.indexOf(char);
        if (idx === -1) return "";
        num = num * 58n + BigInt(idx);
    }
    let hex = num.toString(16);
    if (hex.length % 2 !== 0) hex = "0" + hex;

    // Handle leading zeros (1 in base58 = 0x00)
    let leadingZeros = 0;
    for (const char of input) {
        if (char === "1") leadingZeros++;
        else break;
    }
    return "00".repeat(leadingZeros) + hex;
}

// ── Instruction Router ───────────────────────────────────────────────────

async function handleInstruction(instructionType: string, accounts: string[], tx: any) {
    switch (instructionType) {
        case "create_dare":
            await handleCreateDare(accounts, tx);
            break;
        case "accept_dare":
            await handleAcceptDare(accounts, tx);
            break;
        case "refuse_dare":
            await handleRefuseDare(accounts, tx);
            break;
        case "submit_proof":
            await handleSubmitProof(accounts, tx);
            break;
        case "approve_dare":
            await handleApproveDare(accounts, tx);
            break;
        case "reject_dare":
            await handleRejectDare(accounts, tx);
            break;
        case "cancel_dare":
            await handleCancelDare(accounts, tx);
            break;
        case "expire_dare":
            await handleExpireDare(accounts, tx);
            break;
        default:
            console.log(`  ⚠️ Unknown instruction type: ${instructionType}`);
    }
}

// ── Individual Handlers ───────────────────────────────────────────────────
// Account order matches the Anchor IDL context structs.
// Typically: [signer, dare_pda, vault_pda?, system_program?, ...]

async function handleCreateDare(accounts: string[], tx: any) {
    // accounts[0] = challenger (signer), accounts[1] = dare PDA
    const darePDA = accounts[1];
    if (!darePDA) return;

    const existing = await prisma.dare.findUnique({ where: { darePDA } });
    if (existing) {
        console.log(`  ✓ Dare ${darePDA.slice(0, 8)}... already in DB`);
        return;
    }

    console.log(`  ⏳ Dare ${darePDA.slice(0, 8)}... not in DB yet (waiting for frontend POST)`);
}

async function handleAcceptDare(accounts: string[], tx: any) {
    // accounts[0] = daree (signer), accounts[1] = dare PDA
    const dareePubkey = accounts[0];
    const darePDA = accounts[1];
    if (!darePDA) return;

    console.log(`  🔍 Accept dare: daree=${dareePubkey?.slice(0, 8)}..., darePDA=${darePDA.slice(0, 8)}...`);

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

async function handleRefuseDare(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: {
                status: "REFUSED",
                refusedAt: new Date(),
            },
        });

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

async function handleSubmitProof(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "PROOF_SUBMITTED" },
        });

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

async function handleApproveDare(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: {
                status: "COMPLETED",
                completedAt: new Date(),
            },
        });

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

async function handleRejectDare(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "REJECTED" },
        });

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

async function handleCancelDare(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "CANCELLED" },
        });

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

async function handleExpireDare(accounts: string[], tx: any) {
    const darePDA = accounts[1];
    if (!darePDA) return;

    try {
        const dare = await prisma.dare.update({
            where: { darePDA },
            data: { status: "EXPIRED" },
        });

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
