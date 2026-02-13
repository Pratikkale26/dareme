import Link from "next/link";
import type { Dare } from "../lib/api";
import { formatSol, formatDeadline, getStatusColor, getStatusLabel, truncateAddress } from "../lib/utils";

export default function DareCard({ dare }: { dare: Dare }) {
    const deadline = formatDeadline(dare.deadline);
    const solAmount = formatSol(dare.amount);
    const challenger = dare.challenger;

    return (
        <Link
            href={`/dares/${dare.id}`}
            className="group block rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5 transition-all hover:border-[#FF6B35]/40 hover:bg-[var(--color-bg-card-hover)] hover:shadow-lg hover:shadow-[#FF6B35]/5"
        >
            {/* Top row: type badge + status */}
            <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-[var(--color-bg)]/80 px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                    {dare.dareType === "DIRECT_DARE" ? "🎯 Direct" : "🏆 Bounty"}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(dare.status)}`}>
                    {getStatusLabel(dare.status)}
                </span>
            </div>

            {/* Title */}
            <h3 className="mb-2 text-base font-semibold text-white line-clamp-2 group-hover:text-[#FF6B35] transition-colors">
                {dare.title}
            </h3>

            {/* Description preview */}
            <p className="mb-4 text-sm text-[var(--color-text-secondary)] line-clamp-2">
                {dare.description}
            </p>

            {/* Bottom row: amount + deadline + challenger */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    {/* SOL Amount */}
                    <span className="text-sm font-bold text-[#FF6B35]">
                        💰 {solAmount}
                    </span>

                    {/* Deadline */}
                    <span className={`text-xs ${deadline.isUrgent ? "text-[var(--color-warning)]" : deadline.isExpired ? "text-[var(--color-error)]" : "text-[var(--color-text-secondary)]"}`}>
                        ⏰ {deadline.text}
                    </span>
                </div>

                {/* Challenger */}
                <span className="text-xs text-[var(--color-text-secondary)]">
                    by {challenger.xHandle ? `@${challenger.xHandle}` : challenger.displayName || truncateAddress(challenger.walletAddress || challenger.id)}
                </span>
            </div>

            {/* Target indicator */}
            {dare.targetXHandle && (
                <div className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-secondary)]">
                    <span>🎯</span>
                    <span>Targeted at <span className="text-white">@{dare.targetXHandle}</span></span>
                </div>
            )}
        </Link>
    );
}
