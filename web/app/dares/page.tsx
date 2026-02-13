'use client';

import { useState } from 'react';
import Navbar from '../../components/Navbar';
import DareCard from '../../components/DareCard';
import { useDareFeed, useTrending } from '../../hooks/useApi';
import type { DareFilters, DareStatus, DareType } from '../../lib/api';

const CATEGORIES = ['Fitness', 'Food', 'Social', 'Creative', 'Extreme', 'Gaming', 'Academic', 'Other'];
const STATUSES: { value: DareStatus | ''; label: string }[] = [
    { value: '', label: 'All Status' },
    { value: 'CREATED', label: 'Open' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'PROOF_SUBMITTED', label: 'Proof Submitted' },
    { value: 'COMPLETED', label: 'Completed' },
];
const TYPES: { value: DareType | ''; label: string }[] = [
    { value: '', label: 'All Types' },
    { value: 'DIRECT_DARE', label: '🎯 Direct Dare' },
    { value: 'PUBLIC_BOUNTY', label: '🏆 Public Bounty' },
];
const SORT_OPTIONS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'amount', label: 'Highest Stake' },
    { value: 'deadline', label: 'Ending Soon' },
];

export default function BrowseDares() {
    const [filters, setFilters] = useState<DareFilters>({
        page: 1,
        limit: 12,
        sort: 'newest',
    });
    const [search, setSearch] = useState('');
    const { data, loading, error, refetch } = useDareFeed(filters);
    const { dares: trending, loading: trendingLoading } = useTrending();

    const updateFilter = (key: keyof DareFilters, value: any) => {
        setFilters((prev) => ({ ...prev, [key]: value || undefined, page: 1 }));
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setFilters((prev) => ({ ...prev, search: search || undefined, page: 1 }));
    };

    return (
        <div className="min-h-screen bg-[var(--color-bg)]">
            <Navbar />

            <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-white sm:text-3xl">🔥 Browse Dares</h1>
                    <p className="mt-1 text-[var(--color-text-secondary)]">
                        Find active dares to accept, or get inspired to create your own.
                    </p>
                </div>

                {/* Trending Section */}
                {!trendingLoading && trending.length > 0 && (
                    <div className="mb-8">
                        <h2 className="mb-4 text-lg font-semibold text-white">🔥 Trending</h2>
                        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                            {trending.slice(0, 5).map((dare) => (
                                <div key={dare.id} className="min-w-[300px] flex-shrink-0">
                                    <DareCard dare={dare} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                    {/* Search */}
                    <form onSubmit={handleSearch} className="relative flex-1 sm:max-w-xs">
                        <input
                            type="text"
                            placeholder="Search dares..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-2.5 text-sm text-white placeholder-[var(--color-text-secondary)] outline-none transition-colors focus:border-[#FF6B35]"
                        />
                    </form>

                    {/* Status */}
                    <select
                        value={filters.status || ''}
                        onChange={(e) => updateFilter('status', e.target.value as DareStatus)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#FF6B35]"
                    >
                        {STATUSES.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>

                    {/* Type */}
                    <select
                        value={filters.dareType || ''}
                        onChange={(e) => updateFilter('dareType', e.target.value as DareType)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#FF6B35]"
                    >
                        {TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>

                    {/* Category */}
                    <select
                        value={filters.category || ''}
                        onChange={(e) => updateFilter('category', e.target.value)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#FF6B35]"
                    >
                        <option value="">All Categories</option>
                        {CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>

                    {/* Sort */}
                    <select
                        value={filters.sort || 'newest'}
                        onChange={(e) => updateFilter('sort', e.target.value)}
                        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#FF6B35]"
                    >
                        {SORT_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                </div>

                {/* Results */}
                {loading ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="h-48 animate-pulse rounded-xl bg-[var(--color-bg-card)]" />
                        ))}
                    </div>
                ) : error ? (
                    <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 p-8 text-center">
                        <p className="text-[var(--color-error)]">Failed to load dares</p>
                        <button onClick={refetch} className="mt-3 text-sm text-[#FF6B35] hover:underline cursor-pointer">
                            Try again
                        </button>
                    </div>
                ) : data && data.dares.length > 0 ? (
                    <>
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {data.dares.map((dare) => (
                                <DareCard key={dare.id} dare={dare} />
                            ))}
                        </div>

                        {/* Pagination */}
                        {data.totalPages > 1 && (
                            <div className="mt-8 flex items-center justify-center gap-2">
                                <button
                                    disabled={data.page <= 1}
                                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) - 1 }))}
                                    className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#FF6B35] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    ← Prev
                                </button>
                                <span className="text-sm text-[var(--color-text-secondary)]">
                                    Page {data.page} of {data.totalPages}
                                </span>
                                <button
                                    disabled={data.page >= data.totalPages}
                                    onClick={() => setFilters((p) => ({ ...p, page: (p.page || 1) + 1 }))}
                                    className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:border-[#FF6B35] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="rounded-xl border border-dashed border-[var(--color-border)] p-16 text-center">
                        <div className="mb-4 text-5xl">🏜️</div>
                        <h3 className="mb-2 text-lg font-semibold text-white">No dares found</h3>
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            {filters.search ? 'Try a different search term' : 'Be the first to create a dare!'}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
