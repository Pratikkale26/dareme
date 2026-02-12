import { prisma } from "../db/client";
import type { NotificationType } from "../generated/prisma/client";

/**
 * Create a notification for a user.
 */
export async function createNotification(input: {
    userId: string;
    dareId?: string;
    type: NotificationType;
    title: string;
    body: string;
}) {
    return prisma.notification.create({
        data: {
            userId: input.userId,
            dareId: input.dareId || null,
            type: input.type,
            title: input.title,
            body: input.body,
        },
    });
}

/**
 * Get paginated notifications for a user (newest first).
 */
export async function getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20
) {
    const skip = (page - 1) * limit;

    const [notifications, total] = await Promise.all([
        prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
            select: {
                id: true,
                type: true,
                title: true,
                body: true,
                read: true,
                createdAt: true,
                dare: {
                    select: { id: true, title: true, onChainId: true, darePDA: true },
                },
            },
        }),
        prisma.notification.count({ where: { userId } }),
    ]);

    return { notifications, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/**
 * Get unread notification count.
 */
export async function getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
        where: { userId, read: false },
    });
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string, userId: string) {
    return prisma.notification.updateMany({
        where: { id: notificationId, userId },
        data: { read: true },
    });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
    });
}

/**
 * Helper: notify a user about a dare event (won't fail if user doesn't exist).
 */
export async function notifyUser(
    userId: string | null | undefined,
    dareId: string | null | undefined,
    type: NotificationType,
    title: string,
    body: string
) {
    if (!userId) return;
    try {
        await createNotification({ userId, dareId: dareId || undefined, type, title, body });
    } catch (err) {
        console.error(`Failed to notify user ${userId}:`, err);
    }
}
