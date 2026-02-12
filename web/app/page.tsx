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
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4">
      {/* Background gradient effects */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-[#FF6B35]/10 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-[#FF6B35]/5 blur-[120px]" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex max-w-lg flex-col items-center text-center">
        {/* Logo / Brand */}
        <div className="mb-2 text-5xl">🔥</div>
        <h1 className="mb-3 text-5xl font-extrabold tracking-tight text-white">
          Dare<span className="text-[#FF6B35]">Me</span>
        </h1>
        <p className="mb-8 text-lg leading-relaxed text-[var(--color-text-secondary)]">
          Put your money where your mouth is.
          <br />
          <span className="text-[var(--color-text)]">
            Create dares. Stake SOL. Prove yourself.
          </span>
        </p>

        {/* Login Button */}
        <button
          onClick={login}
          disabled={!ready}
          className="group relative mb-6 cursor-pointer overflow-hidden rounded-xl bg-[#FF6B35] px-8 py-4 text-lg font-semibold text-white transition-all duration-300 hover:bg-[#FF8A5C] hover:shadow-[0_0_30px_rgba(255,107,53,0.3)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="relative z-10">
            {!ready ? 'Loading...' : 'Get Started →'}
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </button>

        {/* Supported login methods */}
        <div className="flex items-center gap-4 text-sm text-[var(--color-text-secondary)]">
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Twitter
          </span>
          <span className="text-[var(--color-border)]">•</span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </span>
          <span className="text-[var(--color-border)]">•</span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 40 40" className="h-4 w-4 fill-current">
              <path d="M34.36 10.58a17.79 17.79 0 0 0-5.72-4.42A18.3 18.3 0 0 0 20 4a18.3 18.3 0 0 0-8.64 2.16 17.79 17.79 0 0 0-5.72 4.42c-1.2 1.4-2.12 2.9-2.78 4.5a13.2 13.2 0 0 0-.86 4.42c0 2.75.7 5.42 2.07 8.02a21.67 21.67 0 0 0 5.56 6.98l.46.38h.02l8.35-8.52.54-.55a5.67 5.67 0 0 0 1.72-4.09c0-1.63-.61-3.05-1.84-4.28a5.75 5.75 0 0 0-4.22-1.85c-1.65 0-3.07.62-4.28 1.85l-.5.55 2.22 2.27.5-.52a2.71 2.71 0 0 1 2.06-.86c.81 0 1.5.29 2.08.87.57.58.86 1.27.86 2.07 0 .8-.29 1.49-.86 2.07l-6.38 6.52a14.68 14.68 0 0 1-2.7-4.12 12.4 12.4 0 0 1-1.02-4.97c0-2.3.78-4.5 2.34-6.6a14.08 14.08 0 0 1 5.85-4.5A14.81 14.81 0 0 1 20 7.29c2.35 0 4.58.54 6.7 1.62a14.08 14.08 0 0 1 5.86 4.5c1.55 2.1 2.33 4.3 2.33 6.6 0 1.74-.34 3.38-1.02 4.92a14.41 14.41 0 0 1-2.62 4.07l-7.8 7.96 2.24 2.28 7.75-7.91a17.8 17.8 0 0 0 3.4-5.3c.88-2 1.33-4.04 1.33-6.12 0-1.57-.29-3.08-.86-4.52a13.67 13.67 0 0 0-2.95-4.81z" />
            </svg>
            Phantom
          </span>
        </div>

        {/* How it works */}
        <div className="mt-16 grid grid-cols-4 gap-3 text-center text-xs">
          {[
            { emoji: '📝', label: 'Create' },
            { emoji: '🤝', label: 'Accept' },
            { emoji: '📹', label: 'Prove' },
            { emoji: '💰', label: 'Settle' },
          ].map((step, i) => (
            <div key={step.label} className="flex flex-col items-center gap-1">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--color-bg-card)] text-xl">
                {step.emoji}
              </div>
              <span className="text-[var(--color-text-secondary)]">
                {step.label}
              </span>
              {i < 3 && (
                <div className="absolute ml-16 mt-3 hidden text-[var(--color-border)] sm:block">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
