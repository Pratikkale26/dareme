/** Format lamports to SOL with fixed decimals */
export function lamportsToSol(lamports: string | number | bigint): number {
    return Number(lamports) / 1_000_000_000;
}

/** Format SOL display (e.g., "0.5 SOL") */
export function formatSol(lamports: string | number | bigint, decimals = 2): string {
    return `${lamportsToSol(lamports).toFixed(decimals)} SOL`;
}

/** Format date as relative time (e.g., "2h ago", "in 3d") */
export function formatRelativeTime(date: string | Date): string {
    const now = Date.now();
    const target = new Date(date).getTime();
    const diff = target - now;
    const absDiff = Math.abs(diff);

    const minutes = Math.floor(absDiff / 60000);
    const hours = Math.floor(absDiff / 3600000);
    const days = Math.floor(absDiff / 86400000);

    let timeStr: string;
    if (minutes < 1) timeStr = "just now";
    else if (minutes < 60) timeStr = `${minutes}m`;
    else if (hours < 24) timeStr = `${hours}h`;
    else if (days < 30) timeStr = `${days}d`;
    else timeStr = new Date(date).toLocaleDateString();

    if (diff > 0 && minutes >= 1) return `in ${timeStr}`;
    if (diff < 0 && minutes >= 1) return `${timeStr} ago`;
    return timeStr;
}

/** Format deadline as countdown */
export function formatDeadline(deadline: string | Date): { text: string; isExpired: boolean; isUrgent: boolean } {
    const target = new Date(deadline).getTime();
    const now = Date.now();
    const diff = target - now;

    if (diff <= 0) return { text: "Expired", isExpired: true, isUrgent: false };

    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);

    const isUrgent = diff < 86400000; // less than 24h

    if (days > 0) return { text: `${days}d ${hours}h left`, isExpired: false, isUrgent };
    if (hours > 0) return { text: `${hours}h left`, isExpired: false, isUrgent };
    return { text: `${Math.floor(diff / 60000)}m left`, isExpired: false, isUrgent: true };
}

/** Truncate wallet address */
export function truncateAddress(address: string, chars = 4): string {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

/** Get status color class */
export function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
        CREATED: "bg-blue-500/20 text-blue-400",
        ACTIVE: "bg-green-500/20 text-green-400",
        PROOF_SUBMITTED: "bg-yellow-500/20 text-yellow-400",
        COMPLETED: "bg-emerald-500/20 text-emerald-400",
        EXPIRED: "bg-gray-500/20 text-gray-400",
        CANCELLED: "bg-gray-500/20 text-gray-400",
        REJECTED: "bg-red-500/20 text-red-400",
        REFUSED: "bg-orange-500/20 text-orange-400",
    };
    return colors[status] || "bg-gray-500/20 text-gray-400";
}

/** Get status display label */
export function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        CREATED: "Open",
        ACTIVE: "Active",
        PROOF_SUBMITTED: "Proof Submitted",
        COMPLETED: "Completed",
        EXPIRED: "Expired",
        CANCELLED: "Cancelled",
        REJECTED: "Rejected",
        REFUSED: "Refused",
    };
    return labels[status] || status;
}
