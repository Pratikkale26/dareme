import { prisma } from "../db/client";
import { privyClient } from "../lib/privy";

interface LinkedAccounts {
    walletAddress?: string;
    xHandle?: string;
    xId?: string;
    email?: string;
}

/**
 * Fetch linked accounts from Privy and sync to our DB.
 * Called on login to keep wallet/X/email data fresh.
 */
export async function syncPrivyAccounts(privyId: string): Promise<LinkedAccounts> {
    try {
        const privyUser = await privyClient.getUser(privyId);
        const linked: LinkedAccounts = {};

        // Extract wallet address
        const wallet = privyUser.linkedAccounts.find(
            (a: any) => a.type === "wallet" && a.chainType === "solana"
        ) as any;
        if (wallet?.address) {
            linked.walletAddress = wallet.address;
        }

        // Extract X/Twitter handle
        const twitter = privyUser.linkedAccounts.find(
            (a: any) => a.type === "twitter_oauth"
        ) as any;
        if (twitter) {
            linked.xHandle = twitter.username || undefined;
            linked.xId = twitter.subject || undefined;
        }

        // Extract email
        const email = privyUser.linkedAccounts.find(
            (a: any) => a.type === "email" || a.type === "google_oauth"
        ) as any;
        if (email?.address) {
            linked.email = email.address;
        } else if (email?.email) {
            linked.email = email.email;
        }

        return linked;
    } catch (err) {
        console.error("Failed to fetch Privy user:", err);
        return {};
    }
}

/**
 * Login / first-time registration: upsert user with latest Privy data.
 */
export async function loginOrCreateUser(privyId: string) {
    const linked = await syncPrivyAccounts(privyId);

    const user = await prisma.user.upsert({
        where: { privyId },
        update: {
            ...(linked.walletAddress && { walletAddress: linked.walletAddress }),
            ...(linked.xHandle && { xHandle: linked.xHandle }),
            ...(linked.xId && { xId: linked.xId }),
            ...(linked.email && { email: linked.email }),
        },
        create: {
            privyId,
            walletAddress: linked.walletAddress || null,
            xHandle: linked.xHandle || null,
            xId: linked.xId || null,
            email: linked.email || null,
        },
    });

    return user;
}

/**
 * Get user by DB id with full profile.
 */
export async function getUserById(id: string) {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            privyId: true,
            walletAddress: true,
            xHandle: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
        },
    });
}

/**
 * Get user by wallet address.
 */
export async function getUserByWallet(walletAddress: string) {
    return prisma.user.findUnique({
        where: { walletAddress },
        select: {
            id: true,
            walletAddress: true,
            xHandle: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
        },
    });
}

/**
 * Update user profile fields.
 */
export async function updateUserProfile(
    id: string,
    data: { displayName?: string; bio?: string; avatarUrl?: string }
) {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            id: true,
            privyId: true,
            walletAddress: true,
            xHandle: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            createdAt: true,
        },
    });
}

/**
 * Get a user's dare history (created + accepted).
 */
export async function getUserDares(
    userId: string,
    role: "created" | "accepted",
    page: number = 1,
    limit: number = 20
) {
    const skip = (page - 1) * limit;
    const where =
        role === "created"
            ? { challengerId: userId }
            : { dareeId: userId };

    const [dares, total] = await Promise.all([
        prisma.dare.findMany({
            where,
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                onChainId: true,
                title: true,
                status: true,
                dareType: true,
                amount: true,
                deadline: true,
                createdAt: true,
                challenger: { select: { id: true, displayName: true, xHandle: true, avatarUrl: true } },
                daree: { select: { id: true, displayName: true, xHandle: true, avatarUrl: true } },
            },
        }),
        prisma.dare.count({ where }),
    ]);

    return { dares, total, page, limit, totalPages: Math.ceil(total / limit) };
}
