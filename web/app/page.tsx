'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const { ready, authenticated, login } = usePrivy();
  const router = useRouter();

  useEffect(() => {
    if (ready && authenticated) {
      router.push('/dashboard');
    }
  }, [ready, authenticated, router]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-white overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#FF6B35]/8 blur-[150px]" />
        <div className="absolute top-1/2 -left-40 h-[400px] w-[400px] rounded-full bg-[#FF6B35]/5 blur-[120px]" />
        <div className="absolute -bottom-20 right-1/3 h-[300px] w-[300px] rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🔥</span>
          <span className="text-xl font-bold">Dare<span className="text-[#FF6B35]">Me</span></span>
        </div>
        <button
          onClick={login}
          disabled={!ready}
          className="cursor-pointer rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-white transition-all hover:border-[#FF6B35] hover:bg-[#FF6B35]/10 disabled:opacity-50"
        >
          Launch App →
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HERO */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
        {/* Pill badge */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-card)] px-4 py-1.5 text-sm text-[var(--color-text-secondary)]">
          <span className="h-2 w-2 rounded-full bg-[#22C55E] animate-pulse" />
          Live on Solana Devnet
        </div>

        <h1 className="mb-6 text-5xl font-extrabold tracking-tight sm:text-7xl">
          Put Your Money{' '}
          <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8A5C] bg-clip-text text-transparent">
            Where Your Mouth Is
          </span>
        </h1>

        <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[var(--color-text-secondary)] sm:text-xl">
          Dare your friends to do wild things. Stake real SOL. Prove it on video.
          Trustless escrow — no middleman, instant settlement.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={login}
            disabled={!ready}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-[#FF6B35] px-8 py-4 text-lg font-semibold text-white transition-all hover:bg-[#FF8A5C] hover:shadow-[0_0_40px_rgba(255,107,53,0.3)] disabled:opacity-50"
          >
            <span className="relative z-10">{!ready ? 'Loading...' : 'Start Daring →'}</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>
          <a
            href="#how-it-works"
            className="rounded-xl border border-[var(--color-border)] px-8 py-4 text-lg font-medium text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-text-secondary)] hover:text-white"
          >
            How It Works
          </a>
        </div>

        {/* Mini stats */}
        <div className="mt-16 flex justify-center gap-8 sm:gap-16">
          {[
            { value: '100%', label: 'Trustless' },
            { value: '<1s', label: 'Settlement' },
            { value: '$0.001', label: 'Avg Fee' },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl font-bold text-white sm:text-3xl">{stat.value}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)] sm:text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* HOW IT WORKS */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="relative z-10 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]/50 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
            How It Works
          </h2>
          <p className="mb-16 text-center text-[var(--color-text-secondary)]">
            Four simple steps. Zero trust required.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: '01',
                emoji: '📝',
                title: 'Create',
                desc: 'Describe your dare, set the stakes, and deposit SOL into a trustless escrow.',
              },
              {
                step: '02',
                emoji: '🤝',
                title: 'Accept',
                desc: 'The daree accepts the challenge. The countdown begins — no backing out.',
              },
              {
                step: '03',
                emoji: '📹',
                title: 'Prove',
                desc: 'Record yourself completing the dare. Upload video proof directly to the platform.',
              },
              {
                step: '04',
                emoji: '💰',
                title: 'Settle',
                desc: 'Challenger approves the proof. SOL is instantly released from escrow. Done.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-all hover:border-[#FF6B35]/40"
              >
                <div className="mb-3 text-xs font-bold text-[#FF6B35]">STEP {item.step}</div>
                <div className="mb-3 text-3xl">{item.emoji}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CHALLENGE TYPES */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-4 text-center text-3xl font-bold sm:text-4xl">
            Challenge Types
          </h2>
          <p className="mb-16 text-center text-[var(--color-text-secondary)]">
            Every dare is an on-chain smart contract
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: '🎯',
                title: 'Direct Dare',
                desc: 'One-on-one challenge. Dare a specific person by their X handle or wallet.',
                example: '"I dare @john to eat a ghost pepper for 0.5 SOL"',
                color: '#FF6B35',
              },
              {
                emoji: '🏆',
                title: 'Public Bounty',
                desc: 'Open challenge. First to complete the dare claims the bounty.',
                example: '"First to run 5K in under 25 min gets 0.2 SOL"',
                color: '#22C55E',
              },
              {
                emoji: '👥',
                title: 'Crowdfunded',
                desc: 'Community pools funds to dare someone. Coming soon.',
                example: '"We\'ll pool 5 SOL if @dev ships this in 48h"',
                color: '#A855F7',
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-6 transition-all hover:border-[var(--color-border)] hover:bg-[var(--color-bg-card-hover)]"
              >
                <div className="mb-3 text-4xl">{item.emoji}</div>
                <h3 className="mb-2 text-lg font-semibold text-white">{item.title}</h3>
                <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{item.desc}</p>
                <div
                  className="rounded-lg bg-[var(--color-bg)]/80 px-3 py-2 text-xs italic"
                  style={{ color: item.color }}
                >
                  {item.example}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TRUST & SECURITY */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 border-t border-[var(--color-border)] bg-[var(--color-bg-card)]/50 py-20 sm:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-16 text-center text-3xl font-bold sm:text-4xl">
            Why <span className="text-[#FF6B35]">Solana</span>?
          </h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[
              { icon: '🔒', title: 'Trustless Escrow', desc: 'Funds locked in a Solana PDA. No middleman. No counterparty risk.' },
              { icon: '⚡', title: 'Instant Settlement', desc: 'Sub-second finality. SOL released the moment dare is approved.' },
              { icon: '💸', title: 'Near-Zero Fees', desc: '$0.001 per transaction. A $2 dare is actually viable.' },
              { icon: '🌍', title: 'Borderless', desc: 'Dare anyone, anywhere. No banks, no borders, no friction.' },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-5">
                <div className="text-2xl">{item.icon}</div>
                <div>
                  <h3 className="mb-1 font-semibold text-white">{item.title}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* CTA */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section className="relative z-10 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <div className="mb-6 text-5xl">🔥</div>
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">Ready to Dare?</h2>
          <p className="mb-8 text-[var(--color-text-secondary)]">
            Sign in with X, Google, or connect your Phantom wallet. It takes 10 seconds.
          </p>
          <button
            onClick={login}
            disabled={!ready}
            className="group relative cursor-pointer overflow-hidden rounded-xl bg-[#FF6B35] px-10 py-4 text-lg font-semibold text-white transition-all hover:bg-[#FF8A5C] hover:shadow-[0_0_40px_rgba(255,107,53,0.3)] disabled:opacity-50"
          >
            <span className="relative z-10">{!ready ? 'Loading...' : 'Start Daring →'}</span>
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm text-[var(--color-text-secondary)]">
            <span>Twitter</span>
            <span className="text-[var(--color-border)]">•</span>
            <span>Google</span>
            <span className="text-[var(--color-border)]">•</span>
            <span>Phantom</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--color-border)] py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
          <span>🔥 DareMe — Powered by Solana</span>
          <div className="flex gap-4">
            <a href="https://github.com/Pratikkale26/dareme" target="_blank" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://twitter.com" target="_blank" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
