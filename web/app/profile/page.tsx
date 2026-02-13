'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import Navbar from '../../components/Navbar';
import DareCard from '../../components/DareCard';
import { useUser } from '../../hooks/useApi';
import { api, type Dare } from '../../lib/api';
import { truncateAddress } from '../../lib/utils';

export default function Profile() {
    const { ready, authenticated, user: privyUser } = usePrivy();
    const { ready: walletsReady, wallets } = useWallets();
    const router = useRouter();
    const { user: dbUser, loading: userLoading, refetch: refetchUser } = useUser();
    const [balance, setBalance] = useState<number | null>(null);
    const [tab, setTab] = useState<'created' | 'accepted'>('created');
    const [dares, setDares] = useState<Dare[]>([]);
    const [daresLoading, setDaresLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ displayName: '', bio: '' });

    useEffect(() => {
        if (ready && !authenticated) router.push('/');
    }, [ready, authenticated, router]);

    const walletAddress = useMemo(() => {
        if (privyUser?.linkedAccounts) {
            const solanaWallet = privyUser.linkedAccounts.find(
                (a) => a.type === 'wallet' && (a as any).chainType === 'solana'
            );
            if (solanaWallet && 'address' in solanaWallet) return (solanaWallet as any).address as string;
        }
        if (privyUser?.wallet?.address) return privyUser.wallet.address;
        if (walletsReady && wallets.length > 0) return wallets[0].address;
        return null;
    }, [privyUser, walletsReady, wallets]);

    // Fetch balance
    useEffect(() => {
        if (!walletAddress) return;
        new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com')
            .getBalance(new PublicKey(walletAddress))
            .then((l) => setBalance(l / LAMPORTS_PER_SOL))
            .catch(() => setBalance(0));
    }, [walletAddress]);

    // Fetch dares
    useEffect(() => {
        if (!dbUser?.id) return;
        setDaresLoading(true);
        api.getUserDares(dbUser.id, tab)
            .then(({ dares }) => setDares(dares))
            .catch(console.error)
            .finally(() => setDaresLoading(false));
    }, [dbUser?.id, tab]);

    // Edit mode
    useEffect(() => {
        if (dbUser) {
            setEditForm({
                displayName: dbUser.displayName || '',
                bio: dbUser.bio || '',
            });
        }
    }, [dbUser]);

    const handleSave = async () => {
        try {
            await api.updateProfile({
                displayName: editForm.displayName.trim() || undefined,
                bio: editForm.bio.trim() || undefined,
            });
            refetchUser();
            setEditing(false);
        } catch (err: any) {
            console.error('Failed to update profile:', err);
        }
    };

    if (!ready || !authenticated || userLoading) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)]">
                <Navbar />
                <div className="flex items-center justify-center py-20">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
                </div>
            </div>
        );
    }

    const twitterHandle = privyUser?.twitter?.username;

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                {/* Profile Card */}
                <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            {/* Avatar */}
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#FF6B35] to-[#FF8A5C] text-2xl font-bold text-white">
                                {dbUser?.displayName?.[0]?.toUpperCase() || twitterHandle?.[0]?.toUpperCase() || '🔥'}
                            </div>
                            <div>
                                {editing ? (
                                    <input
                                        type="text"
                                        value={editForm.displayName}
                                        onChange={(e) => setEditForm((p) => ({ ...p, displayName: e.target.value }))}
                                        placeholder="Display name"
                                        className="mb-1 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 text-lg font-bold text-white outline-none focus:border-[#FF6B35]"
                                    />
                                ) : (
                                    <h1 className="text-xl font-bold text-white">
                                        {dbUser?.displayName || twitterHandle || 'Anonymous'}
                                    </h1>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                                    {twitterHandle && <span>@{twitterHandle}</span>}
                                    {walletAddress && (
                                        <span className="font-mono">{truncateAddress(walletAddress)}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div>
                            {editing ? (
                                <div className="flex gap-2">
                                    <button onClick={handleSave} className="cursor-pointer rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#FF8A5C]">Save</button>
                                    <button onClick={() => setEditing(false)} className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-white">Cancel</button>
                                </div>
                            ) : (
                                <button onClick={() => setEditing(true)} className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:border-[#FF6B35] hover:text-white">
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Bio */}
                    {editing ? (
                        <textarea
                            value={editForm.bio}
                            onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                            placeholder="Write something about yourself..."
                            rows={2}
                            className="mt-4 w-full rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[#FF6B35] resize-none"
                        />
                    ) : dbUser?.bio ? (
                        <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{dbUser.bio}</p>
                    ) : null}

                    {/* Stats */}
                    <div className="mt-6 grid grid-cols-3 gap-4 rounded-lg bg-[var(--color-bg)]/50 p-4">
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{balance?.toFixed(2) ?? '—'}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">SOL Balance</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-white">{dares.length}</div>
                            <div className="text-xs text-[var(--color-text-secondary)]">Dares {tab}</div>
                        </div>
                        <div className="text-center">
                            <div className="text-2xl font-bold text-[#22C55E]">
                                {dares.filter((d) => d.status === 'COMPLETED').length}
                            </div>
                            <div className="text-xs text-[var(--color-text-secondary)]">Completed</div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="mb-6 flex gap-2 border-b border-[var(--color-border)]">
                    {(['created', 'accepted'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`cursor-pointer border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === t
                                    ? 'border-[#FF6B35] text-[#FF6B35]'
                                    : 'border-transparent text-[var(--color-text-secondary)] hover:text-white'
                                }`}
                        >
                            {t === 'created' ? '📝 Created' : '🤝 Accepted'}
                        </button>
                    ))}
                </div>

                {/* Dare History */}
                {daresLoading ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {[1, 2].map((i) => (
                            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
                        ))}
                    </div>
                ) : dares.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {dares.map((dare) => (
                            <DareCard key={dare.id} dare={dare} />
                        ))}
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
                        <div className="text-4xl mb-3">🏜️</div>
                        <p className="text-[var(--color-text-secondary)]">
                            {tab === 'created' ? "You haven't created any dares yet" : "You haven't accepted any dares yet"}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
