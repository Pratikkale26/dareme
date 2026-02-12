<p align="center">
  <h1 align="center">🔥 DareMe</h1>
  <p align="center"><strong>Put your money where your mouth is.</strong></p>
  <p align="center">A peer-to-peer social challenge platform powered by Solana.</p>
</p>

<p align="center">
  <a href="#how-it-works">How It Works</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## 💡 What is DareMe?

DareMe turns **"I bet you can't..."** into a trustless, on-chain smart contract. It's the intersection of **SocialFi** and **Prediction Markets** — but instead of betting on external events, you're betting on **human action**.

Dare your friend to do 50 pushups for 0.1 SOL. Challenge a dev to build a feature in 48 hours. The funds are locked in escrow until the dare is proven — no trust required.

## How It Works

```
CREATE  ──▶  ACCEPT  ──▶  PROVE  ──▶  SETTLE
Stake SOL    Take dare    Film proof   SOL released
in escrow    Clock starts  Upload it    Instantly
```

1. **Create** — Challenger creates a dare, describes the task, sets a deadline, and deposits SOL into an on-chain escrow (PDA).
2. **Accept** — A Daree accepts the challenge. The countdown begins.
3. **Prove** — The Daree records proof and uploads it. The file hash is stored on-chain.
4. **Settle** — The Challenger reviews and approves. The smart contract releases escrowed SOL to the Daree.

> If the Challenger ghosts, funds are auto-released after the dispute window expires.

## Architecture

| Layer | Tech | Responsibility |
|-------|------|---------------|
| **On-Chain** | Anchor (Rust) | Escrow, fund locking/release, dare state machine, proof hash storage |
| **Backend** | Bun + Express + Prisma | User profiles, dare metadata, media uploads, on-chain indexing, notifications |
| **Frontend** | Next.js 16, React 19, Tailwind 4 | UI/UX, wallet signing, proof upload, social features |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract | Solana, Anchor (Rust) — 8 instructions, 2 state accounts, PDA escrow |
| Backend API | Bun, Express, Prisma, PostgreSQL |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Authentication | Privy (X/Twitter + embedded wallets) |
| Media Storage | AWS S3 (presigned uploads) |
| On-Chain Indexing | Helius Webhooks |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) + [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation) >= 0.30
- [Bun](https://bun.sh/) >= 1.0
- PostgreSQL database

### Quick Start

```bash
git clone https://github.com/Pratikkale26/dareme.git
cd dareme

# Smart Contract
cd contract && anchor build && anchor test

# Backend API
cd ../api && bun install
cp .env.example .env   # configure DB + S3 + Privy keys
bun run db:migrate && bun run db:generate && bun run dev

# Web Frontend
cd ../web && bun install
cp .env.example .env   # configure API URL + Privy + Program ID
bun run dev
```

### Environment Variables

**Backend** (`api/.env`) — `DATABASE_URL`, `AWS_S3_BUCKET`, `AWS_*`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `SOLANA_RPC_URL`, `HELIUS_API_KEY`

**Frontend** (`web/.env`) — `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_SOLANA_RPC_URL`, `NEXT_PUBLIC_PROGRAM_ID`

## Current Status — MVP ✅

- [x] Anchor smart contract (8 instructions, PDA escrow, 24+ tests)
- [x] Backend API (auth, users, dares, proofs, notifications, webhooks)
- [x] Frontend (dashboard, browse, create, detail, profile, notifications)
- [x] Real Anchor transactions wired (create, accept, approve, reject, cancel, refuse, submit proof)
- [x] Deploy to Devnet (contract deployed, backend/frontend deployment pending)
- [ ] Mobile app (post-MVP)

## Why Solana?

- ⚡ **Sub-second finality** — Dares settle instantly
- 💸 **Near-zero fees** — A $2 dare is viable
- 🌍 **Borderless micropayments** — Dare anyone, anywhere
- 🔒 **Programmable escrow** — Trustless by design

## License

MIT © [Pratik Kale](https://github.com/Pratikkale26)
