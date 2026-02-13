/**
 * Twitter/X sharing helpers for DareMe.
 * Uses Twitter Intent URLs (no API keys needed).
 */

/** Extract X handle from Privy user's linkedAccounts */
export function getXHandle(privyUser: any): string | null {
    if (!privyUser?.linkedAccounts) return null;
    const twitter = privyUser.linkedAccounts.find(
        (a: any) => a.type === 'twitter_oauth'
    );
    return twitter?.username || null;
}

/** Check if user has X account linked */
export function hasXLinked(privyUser: any): boolean {
    return !!getXHandle(privyUser);
}

/** Build a Twitter intent URL */
export function buildShareUrl(text: string, url?: string): string {
    const params = new URLSearchParams({ text });
    if (url) params.set('url', url);
    return `https://twitter.com/intent/tweet?${params.toString()}`;
}

/** Compose share text for a newly created dare */
export function buildDareShareText(title: string, solAmount: number, targetHandle?: string): string {
    const mention = targetHandle ? `@${targetHandle} ` : '';
    return `. ${mention}🔥 I just created a dare on DareMe!\n\n"${title}" — ${solAmount} SOL staked in on-chain escrow.\n\nAccept it if you dare 👇\n#DareMe #Solana`;
}

/** Compose share text for a completed proof submission */
export function buildProofShareText(title: string): string {
    return `📹 I just completed a dare on DareMe!\n\n"${title}" — proof submitted on-chain. 💪\n\n#DareMe #Solana`;
}

/** Get the public URL for a dare */
export function getDareUrl(dareId: string): string {
    const base = typeof window !== 'undefined' ? window.location.origin : 'https://dareme.app';
    return `${base}/dares/${dareId}`;
}
