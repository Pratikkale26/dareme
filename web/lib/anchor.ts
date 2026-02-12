import {
    Connection,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction,
} from '@solana/web3.js';

// ── Browser-safe helpers (NO Node.js Buffer!) ─────────────────────────────────

/** Encode a string to Uint8Array (browser-safe) */
function strToBytes(s: string): Uint8Array {
    return new TextEncoder().encode(s);
}

/** Uint8Array from plain byte values */
function bytesOf(...values: number[]): Uint8Array {
    return new Uint8Array(values);
}

/** Little-endian encode a u64 bigint into 8 bytes */
function encodeU64(value: bigint): Uint8Array {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigUint64(0, value, true); // true = little-endian
    return new Uint8Array(buf);
}

/** Little-endian encode an i64 bigint into 8 bytes */
function encodeI64(value: bigint): Uint8Array {
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setBigInt64(0, value, true);
    return new Uint8Array(buf);
}

/** Concatenate multiple Uint8Arrays into one */
function concatBytes(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const PROGRAM_ID = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '8Vg3ximsFxoaEveSLQNe49i8tkSaeNubnxa54ypwXiD8');
const DARE_SEED = strToBytes('dare');
const VAULT_SEED = strToBytes('vault');
const USER_STATS_SEED = strToBytes('user_stats');

// ── IDL Discriminators ────────────────────────────────────────────────────────
// Pre-computed from the IDL (sha256("global:<instruction_name>")[0..8])
const DISCRIMINATORS = {
    createDare: bytesOf(165, 248, 7, 27, 99, 187, 25, 198),
    acceptDare: bytesOf(238, 123, 72, 103, 159, 234, 210, 83),
    submitProof: bytesOf(54, 241, 46, 84, 4, 212, 46, 94),
    approveDare: bytesOf(75, 217, 114, 212, 39, 128, 254, 190),
    rejectDare: bytesOf(24, 236, 243, 244, 209, 25, 109, 91),
    cancelDare: bytesOf(170, 254, 168, 239, 96, 236, 53, 126),
    refuseDare: bytesOf(29, 81, 37, 218, 38, 163, 183, 9),
    expireDare: bytesOf(250, 215, 157, 210, 10, 18, 124, 61),
};

// ── Enum Values ───────────────────────────────────────────────────────────────
const DARE_TYPE_VALUES = { DirectDare: 0, PublicBounty: 1 } as const;
const WINNER_SELECTION_VALUES = { ChallengerSelect: 0, CommunityVote: 1 } as const;

// ── PDA Derivation ────────────────────────────────────────────────────────────
export function deriveDarePDA(challenger: PublicKey, dareId: bigint): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [DARE_SEED, challenger.toBuffer(), encodeU64(dareId)],
        PROGRAM_ID
    );
}

export function deriveVaultPDA(darePDA: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [VAULT_SEED, darePDA.toBuffer()],
        PROGRAM_ID
    );
}

export function deriveUserStatsPDA(user: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
        [USER_STATS_SEED, user.toBuffer()],
        PROGRAM_ID
    );
}

// ── SHA-256 hash (browser Web Crypto API) ─────────────────────────────────────
export async function sha256Hash(data: string): Promise<Uint8Array> {
    const encoded = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    return new Uint8Array(hashBuffer);
}

// ── Generate a unique dare ID from timestamp ──────────────────────────────────
export function generateDareId(): bigint {
    return BigInt(Date.now());
}

// ── Helper to get Solana connection ───────────────────────────────────────────
export function getConnection(): Connection {
    return new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
    );
}

// ── Transaction Builders ──────────────────────────────────────────────────────

/**
 * Build the createDare instruction.
 * Returns the instruction + derived PDAs so the frontend can save them.
 */
export function buildCreateDareInstruction(params: {
    challenger: PublicKey;
    dareId: bigint;
    descriptionHash: Uint8Array; // 32 bytes
    amount: bigint; // lamports
    deadline: bigint; // unix timestamp (seconds)
    dareType: 'DirectDare' | 'PublicBounty';
    winnerSelection: 'ChallengerSelect' | 'CommunityVote';
    targetDaree: PublicKey; // new PublicKey(new Uint8Array(32)) for open dares
}): {
    instruction: TransactionInstruction;
    darePDA: PublicKey;
    vaultPDA: PublicKey;
    challengerStatsPDA: PublicKey;
} {
    const { challenger, dareId, descriptionHash, amount, deadline, dareType, winnerSelection, targetDaree } = params;

    const [darePDA] = deriveDarePDA(challenger, dareId);
    const [vaultPDA] = deriveVaultPDA(darePDA);
    const [challengerStatsPDA] = deriveUserStatsPDA(challenger);

    // Serialize args: dare_id(u64) + description_hash([u8;32]) + amount(u64) + deadline(i64) + dare_type(u8) + winner_selection(u8) + target_daree(32 bytes)
    const data = concatBytes(
        DISCRIMINATORS.createDare,
        encodeU64(dareId),
        descriptionHash,
        encodeU64(amount),
        encodeI64(deadline),
        bytesOf(DARE_TYPE_VALUES[dareType]),
        bytesOf(WINNER_SELECTION_VALUES[winnerSelection]),
        targetDaree.toBytes(),
    );

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: challenger, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: vaultPDA, isSigner: false, isWritable: true },
            { pubkey: challengerStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });

    return { instruction, darePDA, vaultPDA, challengerStatsPDA };
}

/**
 * Build the acceptDare instruction.
 */
export function buildAcceptDareInstruction(params: {
    daree: PublicKey;
    darePDA: PublicKey;
}): TransactionInstruction {
    const { daree, darePDA } = params;
    const [dareeStatsPDA] = deriveUserStatsPDA(daree);

    const data = DISCRIMINATORS.acceptDare;

    return new TransactionInstruction({
        keys: [
            { pubkey: daree, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: dareeStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

/**
 * Build the submitProof instruction.
 */
export function buildSubmitProofInstruction(params: {
    submitter: PublicKey;
    darePDA: PublicKey;
    proofHash: Uint8Array; // 32 bytes
}): TransactionInstruction {
    const { submitter, darePDA, proofHash } = params;
    const [submitterStatsPDA] = deriveUserStatsPDA(submitter);

    const data = concatBytes(DISCRIMINATORS.submitProof, proofHash);

    return new TransactionInstruction({
        keys: [
            { pubkey: submitter, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: submitterStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

/**
 * Build the approveDare instruction.
 */
export function buildApproveDareInstruction(params: {
    challenger: PublicKey;
    darePDA: PublicKey;
    vaultPDA: PublicKey;
    daree: PublicKey;
}): TransactionInstruction {
    const { challenger, darePDA, vaultPDA, daree } = params;
    const [dareeStatsPDA] = deriveUserStatsPDA(daree);

    const data = DISCRIMINATORS.approveDare;

    return new TransactionInstruction({
        keys: [
            { pubkey: challenger, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: vaultPDA, isSigner: false, isWritable: true },
            { pubkey: daree, isSigner: false, isWritable: true },
            { pubkey: dareeStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

/**
 * Build the rejectDare instruction.
 */
export function buildRejectDareInstruction(params: {
    challenger: PublicKey;
    darePDA: PublicKey;
}): TransactionInstruction {
    const { challenger, darePDA } = params;

    const data = DISCRIMINATORS.rejectDare;

    return new TransactionInstruction({
        keys: [
            { pubkey: challenger, isSigner: true, isWritable: false },
            { pubkey: darePDA, isSigner: false, isWritable: true },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

/**
 * Build the cancelDare instruction.
 */
export function buildCancelDareInstruction(params: {
    challenger: PublicKey;
    darePDA: PublicKey;
    vaultPDA: PublicKey;
}): TransactionInstruction {
    const { challenger, darePDA, vaultPDA } = params;
    const [challengerStatsPDA] = deriveUserStatsPDA(challenger);

    const data = DISCRIMINATORS.cancelDare;

    return new TransactionInstruction({
        keys: [
            { pubkey: challenger, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: vaultPDA, isSigner: false, isWritable: true },
            { pubkey: challengerStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

/**
 * Build the refuseDare instruction.
 */
export function buildRefuseDareInstruction(params: {
    daree: PublicKey;
    darePDA: PublicKey;
    vaultPDA: PublicKey;
    challenger: PublicKey;
}): TransactionInstruction {
    const { daree, darePDA, vaultPDA, challenger } = params;
    const [challengerStatsPDA] = deriveUserStatsPDA(challenger);

    const data = DISCRIMINATORS.refuseDare;

    return new TransactionInstruction({
        keys: [
            { pubkey: daree, isSigner: true, isWritable: true },
            { pubkey: darePDA, isSigner: false, isWritable: true },
            { pubkey: vaultPDA, isSigner: false, isWritable: true },
            { pubkey: challenger, isSigner: false, isWritable: true },
            { pubkey: challengerStatsPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: data as Buffer,
    });
}

// ── Utility: create & send transaction via Privy wallet ───────────────────────
export async function buildTransaction(
    connection: Connection,
    feePayer: PublicKey,
    ...instructions: TransactionInstruction[]
): Promise<Transaction> {
    const tx = new Transaction();
    tx.add(...instructions);
    tx.feePayer = feePayer;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    return tx;
}
