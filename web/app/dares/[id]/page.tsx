'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignAndSendTransaction } from '@privy-io/react-auth/solana';
import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import Navbar from '../../../components/Navbar';
import { useDare } from '../../../hooks/useApi';
import { formatSol, formatDeadline, formatRelativeTime, getStatusColor, getStatusLabel, truncateAddress } from '../../../lib/utils';
import { api, type Proof, type DareStatus } from '../../../lib/api';
import {
    buildAcceptDareInstruction,
    buildApproveDareInstruction,
    buildRejectDareInstruction,
    buildCancelDareInstruction,
    buildSubmitProofInstruction,
    buildRefuseDareInstruction,
    getConnection,
    buildTransaction,
    sha256Hash,
    deriveVaultPDA,
} from '../../../lib/anchor';
import { hasXLinked, getXHandle, buildShareUrl, buildProofShareText, getDareUrl } from '../../../lib/twitter';

export default function DareDetail() {
    const { id } = useParams();
    const router = useRouter();
    const { user: privyUser, authenticated, linkTwitter } = usePrivy();
    const { ready: walletsReady, wallets } = useWallets();
    const { signAndSendTransaction } = useSignAndSendTransaction();
    const { dare, loading, error, refetch } = useDare(id as string);
    const [proofs, setProofs] = useState<Proof[]>([]);
    const [proofsLoading, setProofsLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [showProofUpload, setShowProofUpload] = useState(false);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofCaption, setProofCaption] = useState('');
    const [proofSubmitted, setProofSubmitted] = useState(false);
    const [optimisticStatus, setOptimisticStatus] = useState<DareStatus | null>(null);

    const xLinked = hasXLinked(privyUser);
    const xHandle = getXHandle(privyUser);

    // Use optimistic status if available, fallback to dare status
    const displayStatus = optimisticStatus || (dare ? dare.status : null);

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
    const walletPubkey = walletAddress ? new PublicKey(walletAddress) : null;

    // Fetch proofs
    useEffect(() => {
        if (!id) return;
        setProofsLoading(true);
        api.getProofs(id as string)
            .then(({ proofs }) => setProofs(proofs))
            .catch(console.error)
            .finally(() => setProofsLoading(false));
    }, [id]);

    const isChallenger = dare?.challenger?.walletAddress && walletAddress
        ? dare.challenger.walletAddress === walletAddress
        : false;

    const isDaree = dare?.daree?.walletAddress && walletAddress
        ? dare.daree.walletAddress === walletAddress
        : false;

    // Helper: sign and send transaction
    const sendTx = useCallback(async (actionName: string, buildFn: () => any, onSuccess?: () => void) => {
        if (!walletPubkey || !solanaWallet) {
            setActionError('No wallet connected');
            return;
        }
        try {
            setActionLoading(actionName);
            setActionError(null);
            setTxHash(null);

            const connection = getConnection();
            const instruction = buildFn();
            const tx = await buildTransaction(connection, walletPubkey, instruction);
            const serializedTx = tx.serialize({ requireAllSignatures: false });

            const { signature: sigBytes } = await signAndSendTransaction({
                transaction: serializedTx,
                wallet: solanaWallet,
            });
            const signature = bs58.encode(sigBytes);

            setTxHash(signature);
            await connection.confirmTransaction(signature, 'confirmed');

            // Optimistic update
            if (onSuccess) onSuccess();

            // Refetch dare data after action
            setTimeout(() => refetch(), 2000);
            setActionLoading(null);
        } catch (err: any) {
            console.error(`${actionName} error:`, err);
            if (err.message?.includes('User rejected')) {
                setActionError('Transaction rejected by wallet');
            } else {
                setActionError(err.message || `Failed to ${actionName}`);
            }
            setActionLoading(null);
        }
    }, [walletPubkey, solanaWallet, refetch, signAndSendTransaction]);

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleAccept = () => {
        if (!dare || !walletPubkey) return;
        if (!xLinked) {
            setActionError('Please connect your X account first (required to accept dares)');
            return;
        }
        const darePDA = new PublicKey(dare.darePDA);
        sendTx('accept',
            () => buildAcceptDareInstruction({ daree: walletPubkey, darePDA }),
            () => setOptimisticStatus('ACTIVE')
        );
    };

    const handleApprove = () => {
        if (!dare || !walletPubkey || !dare.daree?.walletAddress) return;
        const darePDA = new PublicKey(dare.darePDA);
        const [vaultPDA] = deriveVaultPDA(darePDA);
        sendTx('approve',
            () => buildApproveDareInstruction({
                challenger: walletPubkey,
                darePDA,
                vaultPDA,
                daree: new PublicKey(dare.daree!.walletAddress!),
            }),
            () => setOptimisticStatus('COMPLETED')
        );
    };

    const handleReject = () => {
        if (!dare || !walletPubkey) return;
        const darePDA = new PublicKey(dare.darePDA);
        sendTx('reject',
            () => buildRejectDareInstruction({ challenger: walletPubkey, darePDA }),
            () => setOptimisticStatus('ACTIVE')
        );
    };

    const handleCancel = () => {
        if (!dare || !walletPubkey) return;
        const darePDA = new PublicKey(dare.darePDA);
        const [vaultPDA] = deriveVaultPDA(darePDA);
        sendTx('cancel',
            () => buildCancelDareInstruction({ challenger: walletPubkey, darePDA, vaultPDA }),
            () => setOptimisticStatus('CANCELLED')
        );
    };

    const handleRefuse = () => {
        if (!dare || !walletPubkey || !dare.challenger?.walletAddress) return;
        const darePDA = new PublicKey(dare.darePDA);
        const [vaultPDA] = deriveVaultPDA(darePDA);
        sendTx('refuse',
            () => buildRefuseDareInstruction({
                daree: walletPubkey,
                darePDA,
                vaultPDA,
                challenger: new PublicKey(dare.challenger.walletAddress!),
            }),
            () => setOptimisticStatus('CANCELLED')
        );
    };

    const handleSubmitProof = async () => {
        if (!dare || !walletPubkey || !proofFile) return;

        try {
            setActionLoading('proof');
            setActionError(null);

            // 1. Get presigned upload URL
            const { uploadUrl, publicUrl } = await api.getPresignedUrl(
                proofFile.type,
                proofFile.size
            );

            // 2. Upload file directly to S3
            await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': proofFile.type },
                body: proofFile,
            });

            // 3. Compute proof hash
            const fileBuffer = await proofFile.arrayBuffer();
            const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
            const proofHashArray = new Uint8Array(hashBuffer);
            // proofHashArray is already Uint8Array — use directly

            // 4. Send on-chain submit_proof instruction
            const darePDA = new PublicKey(dare.darePDA);
            const connection = getConnection();
            const instruction = buildSubmitProofInstruction({
                submitter: walletPubkey,
                darePDA,
                proofHash: proofHashArray,
            });

            const tx = await buildTransaction(connection, walletPubkey!, instruction);
            const serializedTx = tx.serialize({ requireAllSignatures: false });

            const { signature: sigBytes } = await signAndSendTransaction({
                transaction: serializedTx,
                wallet: solanaWallet!,
            });
            const signature = bs58.encode(sigBytes);

            setTxHash(signature);
            await connection.confirmTransaction(signature, 'confirmed');

            // 5. Save proof metadata to backend
            const mediaType = proofFile.type.startsWith('video/') ? 'VIDEO' : 'IMAGE';
            await api.submitProof(dare.id, {
                mediaUrl: publicUrl,
                mediaType: mediaType as 'VIDEO' | 'IMAGE',
                proofHash: Array.from(proofHashArray).map(b => b.toString(16).padStart(2, '0')).join(''),
                caption: proofCaption || undefined,
            });

            // Reset and show share option
            setShowProofUpload(false);
            setProofFile(null);
            setProofCaption('');
            setProofSubmitted(true);
            setOptimisticStatus('PROOF_SUBMITTED');
            setTimeout(() => refetch(), 2000);
        } catch (err: any) {
            console.error('Submit proof error:', err);
            setActionError(err.message || 'Failed to submit proof');
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)]">
                <Navbar />
                <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 w-2/3 rounded bg-[var(--color-bg-card)]" />
                        <div className="h-4 w-1/2 rounded bg-[var(--color-bg-card)]" />
                        <div className="h-64 rounded-xl bg-[var(--color-bg-card)]" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !dare) {
        return (
            <div className="min-h-screen bg-[var(--color-bg)]">
                <Navbar />
                <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
                    <div className="text-5xl mb-4">😔</div>
                    <h2 className="text-xl font-bold text-white mb-2">Dare not found</h2>
                    <p className="text-[var(--color-text-secondary)]">{error || 'This dare may have been removed.'}</p>
                </div>
            </div>
        );
    }

    const deadline = formatDeadline(dare.deadline);
    const solAmount = formatSol(dare.amount);

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
                {/* Header */}
                <div className="mb-6">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(displayStatus || 'CREATED')}`}>
                            {getStatusLabel(displayStatus || 'CREATED')}
                        </span>
                        <span className="rounded-md bg-[var(--color-bg-card)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                            {dare.dareType === 'DIRECT_DARE' ? '🎯 Direct Dare' : '🏆 Public Bounty'}
                        </span>
                        {dare.category && (
                            <span className="rounded-md bg-[var(--color-bg-card)] px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                                {dare.category}
                            </span>
                        )}
                    </div>

                    <h1 className="mb-2 text-2xl font-bold text-white sm:text-3xl">{dare.title}</h1>

                    <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text-secondary)]">
                        <span>Created {formatRelativeTime(dare.createdAt)}</span>
                        <span className={deadline.isExpired ? 'text-[var(--color-error)]' : deadline.isUrgent ? 'text-[var(--color-warning)]' : ''}>
                            ⏰ {deadline.text}
                        </span>
                    </div>
                </div>

                {/* Action errors / tx status */}
                {actionError && (
                    <div className="mb-4 rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-sm text-[var(--color-error)]">
                        {actionError}
                    </div>
                )}
                {txHash && (
                    <div className="mb-4 rounded-xl border border-[#22C55E]/30 bg-[#22C55E]/10 px-4 py-3 text-sm text-[#22C55E]">
                        <div className="flex items-center gap-2">
                            ✅ Transaction confirmed
                            <a
                                href={`https://solscan.io/tx/${txHash}?cluster=devnet`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#FF6B35] hover:underline"
                            >
                                View on Solscan ↗
                            </a>
                        </div>
                        {proofSubmitted && dare && (
                            <div className="mt-3 flex gap-2">
                                <button
                                    onClick={() => {
                                        const text = buildProofShareText(dare.title);
                                        const url = getDareUrl(dare.id);
                                        window.open(buildShareUrl(text, url), '_blank', 'width=550,height=420');
                                    }}
                                    className="cursor-pointer flex items-center gap-2 rounded-lg bg-[#1DA1F2] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A91DA]"
                                >
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
                                    Share proof on X
                                </button>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Main content */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Description */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                            <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Description</h2>
                            <p className="whitespace-pre-wrap leading-relaxed text-white">{dare.description}</p>
                            {dare.tags && dare.tags.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {dare.tags.map((tag) => (
                                        <span key={tag} className="rounded-md bg-[var(--color-bg)]/80 px-2 py-1 text-xs text-[var(--color-text-secondary)]">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Proof Upload Form */}
                        {showProofUpload && (
                            <div className="rounded-xl border border-[#FF6B35]/30 bg-[var(--color-bg-card)] p-6">
                                <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-white">Submit Proof</h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">Upload video or image</label>
                                        <input
                                            type="file"
                                            accept="video/*,image/*"
                                            onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                                            className="w-full text-sm text-[var(--color-text-secondary)] file:mr-4 file:rounded-lg file:border-0 file:bg-[#FF6B35] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white file:cursor-pointer"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-sm text-[var(--color-text-secondary)]">Caption (optional)</label>
                                        <input
                                            type="text"
                                            value={proofCaption}
                                            onChange={(e) => setProofCaption(e.target.value)}
                                            placeholder="Describe your proof..."
                                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm text-white outline-none focus:border-[#FF6B35]"
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleSubmitProof}
                                            disabled={!proofFile || actionLoading === 'proof'}
                                            className="cursor-pointer rounded-lg bg-[#FF6B35] px-6 py-2 text-sm font-semibold text-white hover:bg-[#FF8A5C] disabled:opacity-50"
                                        >
                                            {actionLoading === 'proof' ? 'Uploading & signing...' : '📹 Submit'}
                                        </button>
                                        <button
                                            onClick={() => { setShowProofUpload(false); setProofFile(null); }}
                                            className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)]"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Proofs */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6">
                            <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
                                Proof Submissions ({proofs.length})
                            </h2>

                            {proofsLoading ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="h-48 animate-pulse rounded-lg bg-[var(--color-bg)]" />
                                    ))}
                                </div>
                            ) : proofs.length > 0 ? (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {proofs.map((proof) => (
                                        <div key={proof.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden">
                                            {proof.mediaType === 'VIDEO' ? (
                                                <video src={proof.mediaUrl} controls className="h-48 w-full object-cover" />
                                            ) : (
                                                <img src={proof.mediaUrl} alt="Proof" className="h-48 w-full object-cover" />
                                            )}
                                            <div className="p-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[var(--color-text-secondary)]">
                                                        by {proof.submitter.xHandle ? `@${proof.submitter.xHandle}` : proof.submitter.displayName || 'Anon'}
                                                    </span>
                                                    <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(proof.status)}`}>
                                                        {proof.status}
                                                    </span>
                                                </div>
                                                {proof.caption && <p className="mt-2 text-sm text-white">{proof.caption}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center">
                                    <div className="text-3xl mb-2">📹</div>
                                    <p className="text-sm text-[var(--color-text-secondary)]">No proofs submitted yet</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-4">
                        {/* Amount Card */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 text-center">
                            <div className="text-3xl font-bold text-[#FF6B35]">{solAmount}</div>
                            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Staked in escrow</p>
                        </div>

                        {/* Challenger */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Challenger</p>
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF6B35]/20 text-lg">
                                    {dare.challenger.avatarUrl ? (
                                        <img src={dare.challenger.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                                    ) : '🔥'}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white">
                                        {dare.challenger.xHandle ? `@${dare.challenger.xHandle}` : dare.challenger.displayName || 'Anonymous'}
                                    </p>
                                    {dare.challenger.walletAddress && (
                                        <p className="text-xs text-[var(--color-text-secondary)] font-mono">
                                            {truncateAddress(dare.challenger.walletAddress)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Daree */}
                        {dare.daree && (
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Daree</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#22C55E]/20 text-lg">
                                        {dare.daree.avatarUrl ? (
                                            <img src={dare.daree.avatarUrl} alt="" className="h-10 w-10 rounded-full" />
                                        ) : '🎯'}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            {dare.daree.xHandle ? `@${dare.daree.xHandle}` : dare.daree.displayName || 'Anonymous'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Target */}
                        {dare.targetXHandle && !dare.daree && (
                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">Targeted At</p>
                                <p className="text-sm text-white">@{dare.targetXHandle}</p>
                                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Waiting for them to accept...</p>
                            </div>
                        )}

                        {/* Action Buttons — REAL ON-CHAIN */}
                        {authenticated && walletPubkey && (
                            <div className="space-y-2">
                                {/* X Account Warning */}
                                {!xLinked && (displayStatus === 'CREATED' || displayStatus === 'ACTIVE') && (
                                    <div className="rounded-xl border border-[#1DA1F2]/30 bg-[#1DA1F2]/10 p-3">
                                        <p className="text-xs text-[var(--color-text-secondary)] mb-2">Connect X to accept dares or submit proof</p>
                                        <button
                                            onClick={linkTwitter}
                                            className="cursor-pointer w-full rounded-lg bg-[#1DA1F2] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1A91DA]"
                                        >
                                            Connect X
                                        </button>
                                    </div>
                                )}

                                {/* Accept (for open dares or targeted user) */}
                                {displayStatus === 'CREATED' && !isChallenger && (
                                    <button
                                        onClick={handleAccept}
                                        disabled={!!actionLoading || !xLinked}
                                        className="w-full cursor-pointer rounded-xl bg-[#22C55E] py-3 text-sm font-semibold text-white transition-all hover:bg-[#16A34A] disabled:opacity-50"
                                    >
                                        {actionLoading === 'accept' ? 'Signing...' : '🤝 Accept Dare'}
                                    </button>
                                )}

                                {/* Submit Proof (for active dares if you're the daree) */}
                                {displayStatus === 'ACTIVE' && isDaree && !showProofUpload && (
                                    <button
                                        onClick={() => setShowProofUpload(true)}
                                        disabled={!xLinked}
                                        className="w-full cursor-pointer rounded-xl bg-[#FF6B35] py-3 text-sm font-semibold text-white transition-all hover:bg-[#FF8A5C] disabled:opacity-50"
                                    >
                                        📹 Submit Proof
                                    </button>
                                )}

                                {/* Approve/Reject (for challenger when proof submitted) */}
                                {displayStatus === 'PROOF_SUBMITTED' && isChallenger && (
                                    <>
                                        <button
                                            onClick={handleApprove}
                                            disabled={!!actionLoading}
                                            className="w-full cursor-pointer rounded-xl bg-[#22C55E] py-3 text-sm font-semibold text-white transition-all hover:bg-[#16A34A] disabled:opacity-50"
                                        >
                                            {actionLoading === 'approve' ? 'Signing...' : '✅ Approve Proof'}
                                        </button>
                                        <button
                                            onClick={handleReject}
                                            disabled={!!actionLoading}
                                            className="w-full cursor-pointer rounded-xl border border-[var(--color-error)] py-3 text-sm font-medium text-[var(--color-error)] transition-all hover:bg-[var(--color-error)]/10 disabled:opacity-50"
                                        >
                                            {actionLoading === 'reject' ? 'Signing...' : '❌ Reject Proof'}
                                        </button>
                                    </>
                                )}

                                {/* Refuse (for targeted daree on created dares) */}
                                {displayStatus === 'CREATED' && isDaree && (
                                    <button
                                        onClick={handleRefuse}
                                        disabled={!!actionLoading}
                                        className="w-full cursor-pointer rounded-xl border border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-error)] hover:text-[var(--color-error)] disabled:opacity-50"
                                    >
                                        {actionLoading === 'refuse' ? 'Signing...' : '🚫 Refuse Dare'}
                                    </button>
                                )}

                                {/* Cancel (for challenger on created dares) */}
                                {displayStatus === 'CREATED' && isChallenger && (
                                    <button
                                        onClick={handleCancel}
                                        disabled={!!actionLoading}
                                        className="w-full cursor-pointer rounded-xl border border-[var(--color-border)] py-3 text-sm font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-error)] hover:text-[var(--color-error)] disabled:opacity-50"
                                    >
                                        {actionLoading === 'cancel' ? 'Signing...' : 'Cancel Dare'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* On-chain info */}
                        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
                            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">On-Chain</p>
                            <div className="space-y-2 text-xs">
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-secondary)]">Dare PDA</span>
                                    <a
                                        href={`https://solscan.io/account/${dare.darePDA}?cluster=devnet`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-mono text-[#FF6B35] hover:underline"
                                    >
                                        {truncateAddress(dare.darePDA, 6)}
                                    </a>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-[var(--color-text-secondary)]">On-Chain ID</span>
                                    <span className="font-mono text-white">{dare.onChainId}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
