'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import Link from 'next/link';
import Navbar from '../../components/Navbar';
import DareCard from '../../components/DareCard';
import { useDareFeed, useUser } from '../../hooks/useApi';
import { truncateAddress } from '../../lib/utils';

export default function Dashboard() {
    const { ready, authenticated, user: privyUser, logout } = usePrivy();
    const { ready: walletsReady, wallets } = useWallets();
    const router = useRouter();
    const [balance, setBalance] = useState<number | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const { user: dbUser } = useUser();
    const { data: myDares, loading: daresLoading } = useDareFeed({ limit: 6, sort: 'newest' });

    useEffect(() => {
        if (ready && !authenticated) {
            router.push('/');
        }
    }, [ready, authenticated, router]);

    const walletAddress = useMemo(() => {
        if (privyUser?.linkedAccounts) {
            const solanaWallet = privyUser.linkedAccounts.find(
                (account) => account.type === 'wallet' && (account as any).chainType === 'solana'
            );
            if (solanaWallet && 'address' in solanaWallet) {
                return (solanaWallet as any).address as string;
            }
        }
        if (privyUser?.wallet?.address) return privyUser.wallet.address;
        if (walletsReady && wallets.length > 0) return wallets[0].address;
        return null;
    }, [privyUser, walletsReady, wallets]);

    useEffect(() => {
        async function fetchBalance() {
            if (!walletAddress) return;
            setLoadingBalance(true);
            try {
                const connection = new Connection(
                    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
                );
                const lamports = await connection.getBalance(new PublicKey(walletAddress));
                setBalance(lamports / LAMPORTS_PER_SOL);
            } catch {
                setBalance(0);
            } finally {
                setLoadingBalance(false);
            }
        }
        fetchBalance();
    }, [walletAddress]);

    if (!ready || !authenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
            </div>
        );
    }

    const twitterHandle = privyUser?.twitter?.username;
    const googleEmail = privyUser?.google?.email;
    const displayName = dbUser?.displayName || twitterHandle
        ? `@${twitterHandle}`
        : googleEmail || (walletAddress ? truncateAddress(walletAddress) : 'Anon');

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Welcome + Quick Actions */}
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white sm:text-3xl">
                            Welcome back{twitterHandle ? `, @${twitterHandle}` : ''} 👋
                        </h1>
                        <p className="mt-1 text-[var(--color-text-secondary)]">
                            Ready to create or accept some dares?
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Link
                            href="/dares/create"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#FF8A5C] hover:shadow-lg hover:shadow-[#FF6B35]/20"
                        >
                            📝 Create Dare
                        </Link>
                        <Link
                            href="/dares"
                            className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-5 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-text-secondary)] hover:text-white"
                        >
                            🔥 Browse Feed
                        </Link>
                    </div>
                </div>

                {/* Wallet Card */}
                <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                    <div className="grid gap-6 sm:grid-cols-3">
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Wallet
                            </p>
                            <p className="font-mono text-sm text-white">
                                {walletAddress ? truncateAddress(walletAddress, 6) : 'Loading...'}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Balance (Devnet)
                            </p>
                            <p className="text-2xl font-bold text-white">
                                {!walletAddress ? '—' : loadingBalance ? (
                                    <span className="text-sm text-[var(--color-text-secondary)]">Loading...</span>
                                ) : (
                                    <>{balance?.toFixed(4) ?? '—'} <span className="text-sm font-normal text-[var(--color-text-secondary)]">SOL</span></>
                                )}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Connected Account
                            </p>
                            <div className="flex items-center gap-2">
                                {twitterHandle && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-bg)]/50 px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                                        𝕏 @{twitterHandle}
                                    </span>
                                )}
                                {googleEmail && (
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-bg)]/50 px-2.5 py-1 text-xs text-[var(--color-text-secondary)]">
                                        ✉️ {googleEmail}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Recent Dares */}
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Recent Dares</h2>
                        <Link href="/dares" className="text-sm text-[#FF6B35] hover:underline">
                            View all →
                        </Link>
                    </div>

                    {daresLoading ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
                            ))}
                        </div>
                    ) : myDares && myDares.dares.length > 0 ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {myDares.dares.map((dare) => (
                                <DareCard key={dare.id} dare={dare} />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
                            <div className="mb-4 text-5xl">🏜️</div>
                            <h3 className="mb-2 text-lg font-semibold text-white">No dares yet</h3>
                            <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                                Be the first to create a dare!
                            </p>
                            <Link
                                href="/dares/create"
                                className="inline-flex items-center gap-2 rounded-xl bg-[#FF6B35] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#FF8A5C]"
                            >
                                📝 Create Your First Dare
                            </Link>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
