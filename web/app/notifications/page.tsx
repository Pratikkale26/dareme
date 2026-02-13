'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import { useNotifications } from '../../hooks/useApi';
import { formatRelativeTime } from '../../lib/utils';

const TYPE_ICONS: Record<string, string> = {
    DARE_ACCEPTED: '🤝',
    DARE_REFUSED: '😤',
    PROOF_SUBMITTED: '📹',
    DARE_APPROVED: '✅',
    DARE_REJECTED: '❌',
    DARE_EXPIRED: '⏰',
    DARE_CANCELLED: '🚫',
    DARE_CREATED: '📝',
};

export default function Notifications() {
    const { ready, authenticated } = usePrivy();
    const router = useRouter();
    const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications();

    useEffect(() => {
        if (ready && !authenticated) router.push('/');
    }, [ready, authenticated, router]);

    if (!ready || !authenticated) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)]">
                <Navbar />
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">🔔 Notifications</h1>
                        {unreadCount > 0 && (
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                {unreadCount} unread
                            </p>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllRead}
                            className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#FF6B35] hover:text-white"
                        >
                            Mark all read
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-20 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
                        ))}
                    </div>
                ) : notifications.length > 0 ? (
                    <div className="space-y-2">
                        {notifications.map((notif) => (
                            <div
                                key={notif.id}
                                onClick={() => {
                                    if (!notif.read) markRead(notif.id);
                                }}
                                className={`cursor-pointer rounded-xl border p-4 transition-all ${notif.read
                                        ? 'border-[var(--color-border)] bg-[var(--color-bg-card)]'
                                        : 'border-[#FF6B35]/30 bg-[#FF6B35]/5'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <span className="mt-0.5 text-xl">
                                        {TYPE_ICONS[notif.type] || '🔔'}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className={`text-sm font-medium ${notif.read ? 'text-[var(--color-text-secondary)]' : 'text-white'}`}>
                                                {notif.title}
                                            </h3>
                                            <span className="flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
                                                {formatRelativeTime(notif.createdAt)}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{notif.body}</p>
                                        {notif.dare && (
                                            <Link
                                                href={`/dares/${notif.dare.id}`}
                                                className="mt-2 inline-block text-xs text-[#FF6B35] hover:underline"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                View dare →
                                            </Link>
                                        )}
                                    </div>
                                    {!notif.read && (
                                        <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-[#FF6B35]" />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-16 text-center">
                        <div className="text-5xl mb-4">🔕</div>
                        <h3 className="mb-2 text-lg font-semibold text-white">No notifications</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            When someone interacts with your dares, you'll see it here.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
