"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const { ready, authenticated, logout, user } = usePrivy();
    const pathname = usePathname();

    const displayName = user?.twitter?.username
        ? `@${user.twitter.username}`
        : user?.google?.email
            ? user.google.email
            : user?.wallet?.address
                ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}`
                : "Anon";

    const navLinks = [
        { href: "/dashboard", label: "Dashboard", emoji: "🏠" },
        { href: "/dares", label: "Browse", emoji: "🔥" },
        { href: "/dares/create", label: "Create", emoji: "📝" },
    ];

    return (
        <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
                {/* Logo */}
                <Link href={authenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
                    <span className="text-2xl">🔥</span>
                    <span className="text-xl font-bold text-white">
                        Dare<span className="text-[#FF6B35]">Me</span>
                    </span>
                </Link>

                {/* Nav Links */}
                {authenticated && (
                    <nav className="hidden items-center gap-1 sm:flex">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`rounded-lg px-3 py-2 text-sm transition-colors ${pathname === link.href || pathname?.startsWith(link.href + "/")
                                        ? "bg-[#FF6B35]/10 text-[#FF6B35]"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-white"
                                    }`}
                            >
                                <span className="mr-1.5">{link.emoji}</span>
                                {link.label}
                            </Link>
                        ))}
                    </nav>
                )}

                {/* Right side */}
                <div className="flex items-center gap-3">
                    {authenticated && (
                        <>
                            {/* Notifications */}
                            <Link
                                href="/notifications"
                                className={`relative rounded-lg p-2 transition-colors ${pathname === "/notifications"
                                        ? "bg-[#FF6B35]/10 text-[#FF6B35]"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-card)] hover:text-white"
                                    }`}
                            >
                                🔔
                            </Link>

                            {/* User */}
                            <Link
                                href="/profile"
                                className="text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
                            >
                                {displayName}
                            </Link>

                            <button
                                onClick={logout}
                                className="cursor-pointer rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-secondary)] transition-colors hover:border-[#FF6B35] hover:text-white"
                            >
                                Logout
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile nav */}
            {authenticated && (
                <nav className="flex items-center justify-around border-t border-[var(--color-border)] px-2 py-1 sm:hidden">
                    {navLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`flex flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors ${pathname === link.href
                                    ? "text-[#FF6B35]"
                                    : "text-[var(--color-text-secondary)]"
                                }`}
                        >
                            <span className="text-lg">{link.emoji}</span>
                            {link.label}
                        </Link>
                    ))}
                    <Link
                        href="/notifications"
                        className={`flex flex-col items-center rounded-lg px-3 py-1.5 text-xs transition-colors ${pathname === "/notifications" ? "text-[#FF6B35]" : "text-[var(--color-text-secondary)]"
                            }`}
                    >
                        <span className="text-lg">🔔</span>
                        Alerts
                    </Link>
                </nav>
            )}
        </header>
    );
}
