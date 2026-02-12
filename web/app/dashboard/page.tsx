'use client';

import { usePrivy, useWallets } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

export default function Dashboard() {
    const { ready, authenticated, user, logout } = usePrivy();
    const { ready: walletsReady, wallets } = useWallets();
    const router = useRouter();
    const [balance, setBalance] = useState<number | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (ready && !authenticated) {
            router.push('/');
        }
    }, [ready, authenticated, router]);

    // Get the wallet address from the Privy user object (more reliable than useWallets)
    const walletAddress = useMemo(() => {
        // First try: get from user's linked accounts
        if (user?.linkedAccounts) {
            const solanaWallet = user.linkedAccounts.find(
                (account) => account.type === 'wallet' && (account as any).chainType === 'solana'
            );
            if (solanaWallet && 'address' in solanaWallet) {
                return (solanaWallet as any).address as string;
            }
        }

        // Second try: get from user.wallet
        if (user?.wallet?.address) {
            return user.wallet.address;
        }

        // Third try: get from useWallets hook
        if (walletsReady && wallets.length > 0) {
            return wallets[0].address;
        }

        return null;
    }, [user, walletsReady, wallets]);

    // Fetch balance
    useEffect(() => {
        async function fetchBalance() {
            if (!walletAddress) return;
            setLoadingBalance(true);
            try {
                const connection = new Connection(
                    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.devnet.solana.com'
                );
                const pubkey = new PublicKey(walletAddress);
                const lamports = await connection.getBalance(pubkey);
                setBalance(lamports / LAMPORTS_PER_SOL);
            } catch (err) {
                console.error('Failed to fetch balance:', err);
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

    // Extract user info
    const twitterHandle = user?.twitter?.username;
    const googleEmail = user?.google?.email;
    const displayName = twitterHandle
        ? `@${twitterHandle}`
        : googleEmail
            ? googleEmail
            : walletAddress
                ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
                : 'Anon';

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            {/* Header */}
            <header className="border-b border-[var(--color-border)] px-6 py-4">
                <div className="mx-auto flex max-w-6xl items-center justify-between">
                    <h1 className="text-2xl font-bold text-white">
                        🔥 Dare<span className="text-[#FF6B35]">Me</span>
                    </h1>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-[var(--color-text-secondary)]">
                            {displayName}
                        </span>
                        <button
                            onClick={logout}
                            className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#FF6B35] hover:text-white"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="mx-auto max-w-6xl px-6 py-8">
                {/* Wallet Card */}
                <div className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                    <h2 className="mb-4 text-lg font-semibold text-white">Your Wallet</h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Address
                            </p>
                            <p className="font-mono text-sm text-white break-all">
                                {walletAddress || (walletsReady ? 'No wallet found' : 'Loading wallet...')}
                            </p>
                        </div>
                        <div>
                            <p className="mb-1 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Balance (Devnet)
                            </p>
                            <p className="text-2xl font-bold text-white">
                                {!walletAddress ? (
                                    <span className="text-sm text-[var(--color-text-secondary)]">—</span>
                                ) : loadingBalance ? (
                                    <span className="text-sm text-[var(--color-text-secondary)]">
                                        Loading...
                                    </span>
                                ) : (
                                    <>
                                        {balance !== null ? balance.toFixed(4) : '—'}{' '}
                                        <span className="text-sm font-normal text-[var(--color-text-secondary)]">
                                            SOL
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                    </div>
                    {user?.twitter && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg bg-[var(--color-bg)]/50 px-3 py-2">
                            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-[#1DA1F2]">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                            </svg>
                            <span className="text-sm text-[var(--color-text-secondary)]">
                                Connected as <span className="text-white">@{user.twitter.username}</span>
                            </span>
                        </div>
                    )}
                </div>

                {/* Action Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {/* Create Dare */}
                    <div className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-all hover:border-[#FF6B35]/50 hover:bg-[var(--color-bg-card-hover)]">
                        <div className="mb-3 text-3xl">📝</div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Create a Dare</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Challenge someone and stake SOL as a bounty.
                        </p>
                        <div className="mt-4 text-sm font-medium text-[#FF6B35] opacity-0 transition-opacity group-hover:opacity-100">
                            Coming soon →
                        </div>
                    </div>

                    {/* Browse Dares */}
                    <div className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-all hover:border-[#FF6B35]/50 hover:bg-[var(--color-bg-card-hover)]">
                        <div className="mb-3 text-3xl">🔥</div>
                        <h3 className="mb-1 text-lg font-semibold text-white">Browse Dares</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Find active dares and earn SOL by completing them.
                        </p>
                        <div className="mt-4 text-sm font-medium text-[#FF6B35] opacity-0 transition-opacity group-hover:opacity-100">
                            Coming soon →
                        </div>
                    </div>

                    {/* My Profile */}
                    <div className="group cursor-pointer rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-all hover:border-[#FF6B35]/50 hover:bg-[var(--color-bg-card-hover)]">
                        <div className="mb-3 text-3xl">👤</div>
                        <h3 className="mb-1 text-lg font-semibold text-white">My Profile</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            View your dare history and reputation score.
                        </p>
                        <div className="mt-4 text-sm font-medium text-[#FF6B35] opacity-0 transition-opacity group-hover:opacity-100">
                            Coming soon →
                        </div>
                    </div>
                </div>

                {/* Empty state - Active Dares */}
                <div className="mt-8 rounded-xl border border-dashed border-[var(--color-border)] p-12 text-center">
                    <div className="mb-4 text-5xl">🏜️</div>
                    <h3 className="mb-2 text-lg font-semibold text-white">No active dares yet</h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        Once the smart contract is deployed, you&apos;ll see live dares here.
                    </p>
                </div>
            </main>
        </div>
    );
}
