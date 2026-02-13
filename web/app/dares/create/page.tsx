'use client';

import { useState, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { useRouter } from 'next/navigation';
import { PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import Navbar from '../../../components/Navbar';
import { api } from '../../../lib/api';
import {
    buildCreateDareInstruction,
    generateDareId,
    sha256Hash,
    getConnection,
    buildTransaction,
} from '../../../lib/anchor';
import { getXHandle, hasXLinked, buildShareUrl, buildDareShareText, getDareUrl } from '../../../lib/twitter';

const CATEGORIES = ['Fitness', 'Food', 'Social', 'Creative', 'Extreme', 'Gaming', 'Academic', 'Other'];

// Zero public key (all zeros) — used as default target for open dares
const PUBKEY_ZERO = new PublicKey(new Uint8Array(32));

export default function CreateDare() {
    const { ready, authenticated, user: privyUser, linkTwitter } = usePrivy();
    const { ready: walletsReady, wallets } = useWallets();
    const { signAndSendTransaction } = useSignAndSendTransaction();
    const router = useRouter();

    const [form, setForm] = useState({
        title: '',
        description: '',
        amount: '',
        dareType: 'DIRECT_DARE' as 'DIRECT_DARE' | 'PUBLIC_BOUNTY',
        winnerSelection: 'CHALLENGER_SELECT' as 'CHALLENGER_SELECT' | 'COMMUNITY_VOTE',
        category: '',
        tags: '',
        targetXHandle: '',
        deadlineDays: '7',
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<'form' | 'signing' | 'confirming' | 'saving' | 'done'>('form');
    const [txHash, setTxHash] = useState<string | null>(null);
    const [createdDareId, setCreatedDareId] = useState<string | null>(null);

    const xHandle = getXHandle(privyUser);
    const xLinked = hasXLinked(privyUser);

    // Robust wallet address detection to ensure we use the ACTIVE wallet (e.g. Phantom) not just the first one (e.g. Backpack)
    const solanaWallet = useMemo(() => {
        if (!walletsReady || wallets.length === 0) return null;

        // 1. Try to match the user's currently active wallet (from usePrivy)
        const activeWalletAddress = privyUser?.wallet?.address;
        if (activeWalletAddress) {
            const match = wallets.find(w => w.address === activeWalletAddress);
            if (match) return match;
        }

        // 2. Try to match any linked solana wallet
        if (privyUser?.linkedAccounts) {
            const linkedSolana = privyUser.linkedAccounts.find(
                (a): a is any => a.type === 'wallet' && (a as any).chainType === 'solana'
            );
            if (linkedSolana) {
                const match = wallets.find(w => w.address === (linkedSolana as any).address);
                if (match) return match;
            }
        }

        // 3. Fallback to first available
        return wallets[0];
    }, [wallets, walletsReady, privyUser]);

    const walletAddress = solanaWallet?.address ?? null;

    const update = (key: string, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }));
        setError(null);
    };

    const solAmount = parseFloat(form.amount) || 0;
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

    const validate = (): string | null => {
        if (!xLinked) return 'Please connect your X account first (required for social dares)';
        if (!form.title.trim()) return 'Title is required';
        if (form.title.length > 100) return 'Title must be under 100 characters';
        if (!form.description.trim()) return 'Description is required';
        if (form.description.length > 1000) return 'Description must be under 1000 characters';
        if (solAmount <= 0) return 'Amount must be greater than 0';
        if (solAmount > 100) return 'Max amount is 100 SOL';
        if (form.dareType === 'DIRECT_DARE' && !form.targetXHandle.trim()) {
            return 'Direct dares require a target X handle';
        }
        if (!walletAddress) return 'No wallet connected. Please connect a wallet first.';
        return null;
    };

    const handleSubmit = async () => {
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        try {
            setSubmitting(true);
            setError(null);
            setStep('signing');

            // Get wallet
            const walletPubkey = new PublicKey(walletAddress!);
            const connection = getConnection();

            // Generate unique dare ID and description hash
            const dareId = generateDareId();
            const descriptionHash = await sha256Hash(form.description.trim());

            // Compute deadline as unix timestamp in seconds
            const deadline = BigInt(
                Math.floor(Date.now() / 1000) + parseInt(form.deadlineDays) * 86400
            );

            // Map form types to Anchor enum values
            const anchorDareType = form.dareType === 'DIRECT_DARE' ? 'DirectDare' : 'PublicBounty';
            const anchorWinnerSelection = form.winnerSelection === 'CHALLENGER_SELECT' ? 'ChallengerSelect' : 'CommunityVote';

            // For target daree: use zero pubkey for open dares (matched by X handle off-chain)
            const targetDaree = PUBKEY_ZERO;

            // Build the createDare instruction
            const { instruction, darePDA, vaultPDA } = buildCreateDareInstruction({
                challenger: walletPubkey,
                dareId,
                descriptionHash,
                amount: BigInt(lamports),
                deadline,
                dareType: anchorDareType,
                winnerSelection: anchorWinnerSelection,
                targetDaree,
            });

            // Build and serialize the transaction
            const tx = await buildTransaction(connection, walletPubkey, instruction);
            const serializedTx = tx.serialize({ requireAllSignatures: false });

            // Sign and send via Privy wallet
            setStep('confirming');

            const { signature: sigBytes } = await signAndSendTransaction({
                transaction: serializedTx,
                wallet: solanaWallet!,
            });
            const signature = bs58.encode(sigBytes);
            setTxHash(signature);

            // Wait for confirmation
            await connection.confirmTransaction(signature, 'confirmed');

            // Step 2: Save metadata to backend
            setStep('saving');
            const deadlineISO = new Date(Number(deadline) * 1000).toISOString();

            const result = await api.createDare({
                onChainId: Number(dareId),
                darePDA: darePDA.toBase58(),
                vaultPDA: vaultPDA.toBase58(),
                title: form.title.trim(),
                description: form.description.trim(),
                amount: lamports,
                dareType: form.dareType,
                winnerSelection: form.winnerSelection,
                deadline: deadlineISO,
                category: form.category || undefined,
                tags: form.tags ? form.tags.split(',').map((t) => t.trim()).filter(Boolean) : undefined,
                targetXHandle: form.targetXHandle.replace('@', '').trim() || undefined,
            });

            setCreatedDareId(result.dare.id);
            setStep('done');
        } catch (err: any) {
            console.error('Create dare error:', err);
            const message = err.message || 'Failed to create dare';
            if (message.includes('User rejected')) {
                setError('Transaction was rejected by wallet');
            } else if (message.includes('insufficient') || message.includes('0x1')) {
                setError('Insufficient SOL balance for this dare + transaction fees');
            } else {
                setError(message);
            }
            setStep('form');
        } finally {
            setSubmitting(false);
        }
    };

    const handleShareOnX = () => {
        const text = buildDareShareText(form.title.trim(), solAmount);
        const url = createdDareId ? getDareUrl(createdDareId) : undefined;
        const shareUrl = buildShareUrl(text, url);
        window.open(shareUrl, '_blank', 'width=550,height=420');
    };

    if (!ready || !authenticated) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
                <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">📝 Create a Dare</h1>
                <p className="mb-8 text-[var(--color-text-secondary)]">
                    Challenge someone and stake SOL as a bounty. Funds are locked in an on-chain escrow.
                </p>

                {/* X Account Gate */}
                {!xLinked && (
                    <div className="mb-6 rounded-xl border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-white">Connect your X account</p>
                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    Required to create dares — lets us tag and notify people.
                                </p>
                            </div>
                            <button
                                onClick={linkTwitter}
                                className="cursor-pointer rounded-lg bg-[#1DA1F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A91DA]"
                            >
                                Connect X
                            </button>
                        </div>
                    </div>
                )}

                {/* X Connected indicator */}
                {xLinked && (
                    <div className="mb-6 flex items-center gap-2 rounded-lg border border-[#22C55E]/20 bg-[#22C55E]/5 px-4 py-2">
                        <span className="text-sm text-[#22C55E]">✓</span>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                            Connected as <span className="font-medium text-white">@{xHandle}</span>
                        </span>
                    </div>
                )}

                {/* Progress indicator */}
                {step !== 'form' && (
                    <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                        <div className="flex items-center gap-3">
                            {step === 'signing' && (
                                <>
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
                                    <span className="text-sm text-white">Please sign the transaction in your wallet...</span>
                                </>
                            )}
                            {step === 'confirming' && (
                                <>
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#FF6B35] border-t-transparent" />
                                    <div>
                                        <span className="text-sm text-white">Confirming on Solana...</span>
                                        {txHash && (
                                            <a
                                                href={`https://solscan.io/tx/${txHash}?cluster=devnet`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="ml-2 text-xs text-[#FF6B35] hover:underline"
                                            >
                                                View tx ↗
                                            </a>
                                        )}
                                    </div>
                                </>
                            )}
                            {step === 'saving' && (
                                <>
                                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" />
                                    <span className="text-sm text-white">Saving dare metadata...</span>
                                </>
                            )}
                            {step === 'done' && (
                                <div className="w-full space-y-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">✅</span>
                                        <span className="text-sm text-[#22C55E]">Dare created on-chain!</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleShareOnX}
                                            className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A91DA]"
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                            Share on X
                                        </button>
                                        <button
                                            onClick={() => router.push(`/dares/${createdDareId}`)}
                                            className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-white hover:border-[var(--color-text-secondary)]"
                                        >
                                            View Dare →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-6 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                        {error}
                    </div>
                )}

                {/* Form */}
                <div className="space-y-6">
                    {/* Dare Type */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Dare Type</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'DIRECT_DARE', label: '🎯 Direct Dare', desc: 'Target a specific person' },
                                { value: 'PUBLIC_BOUNTY', label: '🏆 Public Bounty', desc: 'Open to anyone' },
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => update('dareType', type.value)}
                                    className={`cursor-pointer rounded-xl border p-4 text-left transition-all ${form.dareType === type.value
                                        ? 'border-[#FF6B35] bg-[#FF6B35]/10'
                                        : 'border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    <div className="text-sm font-medium text-white">{type.label}</div>
                                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{type.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target X Handle (direct dare only) */}
                    {form.dareType === 'DIRECT_DARE' && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">Target X Handle *</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">@</span>
                                <input
                                    type="text"
                                    value={form.targetXHandle}
                                    onChange={(e) => update('targetXHandle', e.target.value)}
                                    placeholder="username"
                                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 pl-8 text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35]"
                                />
                            </div>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                They'll be notified once they log in with this X account.
                            </p>
                        </div>
                    )}

                    {/* Title */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Title *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => update('title', e.target.value)}
                            placeholder="e.g., Eat a ghost pepper on camera"
                            maxLength={100}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35]"
                        />
                        <p className="mt-1 text-right text-xs text-[var(--color-text-secondary)]">{form.title.length}/100</p>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Description *</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => update('description', e.target.value)}
                            placeholder="Describe the dare in detail. What needs to be done? How will proof be verified?"
                            maxLength={1000}
                            rows={4}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35] resize-none"
                        />
                        <p className="mt-1 text-right text-xs text-[var(--color-text-secondary)]">{form.description.length}/1000</p>
                    </div>

                    {/* Amount */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Amount (SOL) *</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={form.amount}
                                onChange={(e) => update('amount', e.target.value)}
                                placeholder="0.1"
                                min="0.001"
                                max="100"
                                step="0.001"
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35]"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--color-text-secondary)]">SOL</span>
                        </div>
                        {solAmount > 0 && (
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                ≈ {lamports.toLocaleString()} lamports
                            </p>
                        )}
                    </div>

                    {/* Deadline */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Deadline</label>
                        <select
                            value={form.deadlineDays}
                            onChange={(e) => update('deadlineDays', e.target.value)}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-white outline-none transition-colors focus:border-[#FF6B35]"
                        >
                            <option value="1">1 day</option>
                            <option value="3">3 days</option>
                            <option value="7">7 days</option>
                            <option value="14">14 days</option>
                            <option value="30">30 days</option>
                        </select>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Category</label>
                        <div className="flex flex-wrap gap-2">
                            {CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => update('category', form.category === cat ? '' : cat)}
                                    className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm transition-all ${form.category === cat
                                        ? 'bg-[#FF6B35] text-white'
                                        : 'border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-text-secondary)]'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">Tags <span className="text-[var(--color-text-secondary)] font-normal">(comma separated)</span></label>
                        <input
                            type="text"
                            value={form.tags}
                            onChange={(e) => update('tags', e.target.value)}
                            placeholder="fun, extreme, food"
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-3 text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35]"
                        />
                    </div>

                    {/* Preview Card */}
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                        <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Preview</h3>
                        <div className="flex items-center justify-between">
                            <div>
                                <div className="text-sm font-semibold text-white">{form.title || 'Your dare title'}</div>
                                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                                    {form.dareType === 'DIRECT_DARE' ? '🎯 Direct' : '🏆 Bounty'}
                                    {form.category && ` • ${form.category}`}
                                    {form.targetXHandle && ` • @${form.targetXHandle.replace('@', '')}`}
                                    {xHandle && ` • by @${xHandle}`}
                                </div>
                            </div>
                            <div className="text-lg font-bold text-[#FF6B35]">
                                {solAmount > 0 ? `${solAmount} SOL` : '–– SOL'}
                            </div>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || step !== 'form'}
                        className="w-full cursor-pointer rounded-xl bg-[#FF6B35] py-4 text-lg font-semibold text-white transition-all hover:bg-[#FF8A5C] hover:shadow-lg hover:shadow-[#FF6B35]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Creating Dare...' : `🔥 Create Dare — ${solAmount > 0 ? solAmount : '0'} SOL`}
                    </button>

                    <p className="text-center text-xs text-[var(--color-text-secondary)]">
                        SOL will be deposited into a trustless escrow smart contract on Solana Devnet.
                    </p>
                </div>
            </main>
        </div>
    );
}
