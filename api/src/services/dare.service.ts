import { prisma } from "../db/client";
import type { DareStatus, DareType, WinnerSelection } from "../generated/prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────

interface CreateDareInput {
    onChainId: bigint;
    darePDA: string;
    vaultPDA: string;
    challengerId: string;
    title: string;
    description: string;
    descriptionHash: string;
    amount: bigint;
    dareType: DareType;
    winnerSelection: WinnerSelection;
    deadline: Date;
    category?: string;
    tags?: string[];
    targetXHandle?: string;
}

interface FeedFilters {
    status?: DareStatus;
    dareType?: DareType;
    category?: string;
    search?: string;
    sort?: "newest" | "amount" | "deadline";
    page?: number;
    limit?: number;
}

// ── Dare select shape ─────────────────────────────────────────────────────

const dareListSelect = {
    id: true,
    onChainId: true,
    darePDA: true,
    title: true,
    description: true,
    status: true,
    dareType: true,
    amount: true,
    deadline: true,
    category: true,
    tags: true,
    targetXHandle: true,
    createdAt: true,
    acceptedAt: true,
    completedAt: true,
    challenger: {
        select: { id: true, displayName: true, xHandle: true, avatarUrl: true, walletAddress: true },
    },
    daree: {
        select: { id: true, displayName: true, xHandle: true, avatarUrl: true, walletAddress: true },
    },
    _count: { select: { proofs: true } },
} as const;

const dareDetailSelect = {
    ...dareListSelect,
    vaultPDA: true,
    descriptionHash: true,
    winnerSelection: true,
    refusedAt: true,
    updatedAt: true,
    proofs: {
        select: {
            id: true,
            mediaUrl: true,
            mediaType: true,
            proofHash: true,
            caption: true,
            status: true,
            createdAt: true,
            submitter: {
                select: { id: true, displayName: true, xHandle: true, avatarUrl: true },
            },
        },
        orderBy: { createdAt: "desc" as const },
    },
} as const;

// ── Service functions ─────────────────────────────────────────────────────

/**
 * Create a dare record in the DB (called after on-chain tx confirms).
 */
export async function createDare(input: CreateDareInput) {
    return prisma.dare.create({
        data: {
            onChainId: input.onChainId,
            darePDA: input.darePDA,
            vaultPDA: input.vaultPDA,
            challengerId: input.challengerId,
            title: input.title,
            description: input.description,
            descriptionHash: input.descriptionHash,
            amount: input.amount,
            dareType: input.dareType,
            winnerSelection: input.winnerSelection,
            deadline: input.deadline,
            category: input.category || null,
            tags: input.tags || [],
            targetXHandle: input.targetXHandle || null,
        },
        select: dareDetailSelect,
    });
}

/**
 * Get a single dare by DB id.
 */
export async function getDareById(id: string) {
    return prisma.dare.findUnique({
        where: { id },
        select: dareDetailSelect,
    });
}

/**
 * Get a single dare by on-chain PDA address.
 */
export async function getDareByPDA(darePDA: string) {
    return prisma.dare.findUnique({
        where: { darePDA },
        select: dareDetailSelect,
    });
}

/**
 * Get a single dare by on-chain dare ID.
 */
export async function getDareByOnChainId(onChainId: bigint) {
    return prisma.dare.findUnique({
        where: { onChainId },
        select: dareDetailSelect,
    });
}

/**
 * Paginated feed of dares with filters and search.
 */
export async function getDareFeed(filters: FeedFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 50);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {};

    if (filters.status) {
        where.status = filters.status;
    }
    if (filters.dareType) {
        where.dareType = filters.dareType;
    }
    if (filters.category) {
        where.category = filters.category;
    }
    if (filters.search) {
        where.OR = [
            { title: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    // Build orderBy
    let orderBy: any = { createdAt: "desc" };
    if (filters.sort === "amount") {
        orderBy = { amount: "desc" };
    } else if (filters.sort === "deadline") {
        orderBy = { deadline: "asc" };
    }

    const [dares, total] = await Promise.all([
        prisma.dare.findMany({
            where,
            orderBy,
            skip,
            take: limit,
            select: dareListSelect,
        }),
        prisma.dare.count({ where }),
    ]);

    return {
        dares,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
    };
}

/**
 * Get trending dares (highest amount, still open).
 */
export async function getTrendingDares(limit: number = 10) {
    return prisma.dare.findMany({
        where: {
            status: { in: ["CREATED", "ACTIVE"] },
            deadline: { gt: new Date() },
        },
        orderBy: { amount: "desc" },
        take: limit,
        select: dareListSelect,
    });
}

/**
 * Update dare status (typically called by the webhook indexer).
 */
export async function updateDareStatus(
    darePDA: string,
    status: DareStatus,
    extra?: { dareeId?: string; acceptedAt?: Date; completedAt?: Date; refusedAt?: Date }
) {
    return prisma.dare.update({
        where: { darePDA },
        data: {
            status,
            ...extra,
        },
    });
}

/**
 * Find dares targeted at an X handle (for matching when user signs up).
 */
export async function findDaresForXHandle(xHandle: string) {
    return prisma.dare.findMany({
        where: {
            targetXHandle: xHandle,
            status: "CREATED",
        },
        select: dareListSelect,
    });
}
