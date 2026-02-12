<p align="center">
  <h1 align="center">🔥 DareMe</h1>
  <p align="center"><strong>Put your money where your mouth is.</strong></p>
  <p align="center">A peer-to-peer social challenge platform powered by Solana.</p>
</p>

<p align="center">
  <a href="#how-it-works">How It Works</a> •
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#tech-stack">Tech Stack</a>
</p>

---

## 💡 What is DareMe?

DareMe turns **"I bet you can't..."** into a trustless, on-chain smart contract. It's the intersection of **SocialFi** and **Prediction Markets** — but instead of betting on external events, you're betting on **human action**.

Dare your friend to do 50 pushups for 0.1 SOL. Challenge a dev to build a feature in 48 hours. Let the community crowdfund a dare for their favorite creator. The funds are locked in escrow until the dare is proven — no trust required.

## How It Works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   CREATE     │────▶│   ACCEPT    │────▶│   PROVE     │────▶│   SETTLE    │
│              │     │              │     │              │     │              │
│ Challenger   │     │ Daree takes  │     │ Daree films  │     │ Challenger   │
│ posts dare + │     │ the dare.    │     │ the proof &  │     │ approves.    │
│ deposits SOL │     │ Clock starts.│     │ uploads it.  │     │ SOL released.│
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

1. **Create** — A Challenger creates a dare, describes the task, sets a deadline, and deposits SOL into an on-chain escrow.
2. **Accept** — A Daree accepts the challenge. The countdown begins.
3. **Prove** — The Daree records themselves completing the dare and uploads the proof.
4. **Settle** — The Challenger reviews the proof and approves. The smart contract instantly releases the escrowed SOL to the Daree's wallet.

> If the Challenger ghosts, funds are auto-released after the dispute window expires.

## Features

### 🎯 Challenge Types

| Type | Description | Example |
|------|-------------|---------|
| **Direct Dare (P2P)** | One person dares another | "I dare you to eat a ghost pepper for 0.5 SOL" |
| **Public Bounty (1-to-Many)** | Open challenge, first N to complete win | "First 10 to run 5K get 0.1 SOL each" |
| **Crowdfunded Dare (Many-to-1)** | Community pools funds to dare someone | "We'll pool 5 SOL if @dev ships this feature in 48h" |

### 🔐 Trust & Security
- **Trustless Escrow** — Funds locked in a Solana PDA; no intermediary.
- **Tamper-proof Proof** — Video/image hash stored on-chain to prevent post-upload edits.
- **Instant Settlement** — SOL released the moment the dare is approved.

### 🌐 Social Features
- **Login with X (Twitter)** via Privy — no wallet setup needed for newcomers
- **Reputation scores** based on dare completion history
- **Activity feed** with real-time notifications
- **Shareable dare links** for viral distribution

## Architecture

```
                    ┌──────────────────────────────┐
                    │        Web Frontend          │
                    │     (Next.js + Tailwind)      │
                    │     Privy Auth + Wallet       │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │        Backend API            │
                    │    (Bun + Express + Prisma)      │
                    │   Users, Feeds, Media, Index  │
                    └──────┬───────────┬───────────┘
                           │           │
              ┌────────────▼──┐   ┌────▼────────────┐
              │   PostgreSQL  │   │    AWS S3        │
              │   (Metadata)  │   │ (Video/Images)   │
              └───────────────┘   └─────────────────┘
                           │
                    ┌──────▼───────────────────────┐
                    │     Solana Blockchain         │
                    │  (Anchor Escrow Program)      │
                    │  Devnet → Mainnet             │
                    └──────────────────────────────┘
```

| Layer | Responsibility |
|-------|---------------|
| **On-Chain (Anchor/Rust)** | Escrow, fund locking/release, dare state machine, proof hash storage |
| **Backend (Bun + Prisma)** | User profiles, dare metadata, media uploads, on-chain indexing, notifications |
| **Frontend (Next.js)** | UI/UX, wallet transactions, proof upload, social features |

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Smart Contract | Solana, Anchor (Rust) |
| Backend API | Bun, Express, Prisma, PostgreSQL |
| Frontend | Next.js 16, React 19, Tailwind CSS 4 |
| Authentication | Privy (X/Twitter + embedded wallets) |
| Media Storage | AWS S3 (presigned uploads) |
| On-Chain Indexing | Helius Webhooks |
| Mobile (post-MVP) | React Native |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) + [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools)
- [Anchor](https://www.anchor-lang.com/docs/installation) >= 0.30
- [Bun](https://bun.sh/) >= 1.0
- [Node.js](https://nodejs.org/) >= 20
- PostgreSQL database

### Installation

```bash
# Clone the repo
git clone https://github.com/Pratikkale26/dareme.git
cd dareme

# Smart Contract
cd contract
anchor build
anchor test

# Backend API
cd ../api
bun install
cp .env.example .env   # configure your DB + S3 + Privy keys
bun run db:migrate
bun run db:generate
bun run dev

# Web Frontend
cd ../web
bun install
cp .env.example .env   # configure API URL + Privy App ID
bun run dev
```

### Environment Variables

#### Backend (`api/.env`)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/dareme
AWS_S3_BUCKET=dareme-proofs
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PRIVY_APP_ID=
PRIVY_APP_SECRET=
SOLANA_RPC_URL=https://api.devnet.solana.com
HELIUS_API_KEY=
```

#### Frontend (`web/.env`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_PRIVY_APP_ID=
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_PROGRAM_ID=...
```

## Project Structure

```
dareme/
├── contract/              # Solana Anchor program
│   ├── programs/          # Rust smart contract source
│   │   └── contract/src/
│   │       ├── instructions/   # create, accept, prove, settle
│   │       ├── state/          # Dare PDA account structure
│   │       ├── error.rs        # Custom error codes
│   │       └── lib.rs          # Program entrypoint
│   └── tests/             # Anchor integration tests
├── api/                   # Bun backend server
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── middleware/     # Auth, validation
│   │   └── services/      # Business logic
│   └── prisma/            # Database schema & migrations
├── web/                   # Next.js web application
│   ├── app/               # App router pages
│   ├── components/        # Reusable UI components
│   ├── hooks/             # Custom React hooks
│   └── lib/               # Utilities, Solana helpers
└── mobile/                # React Native app (post-MVP)
```

## Roadmap

- [x] Project scaffolding & monorepo setup
- [ ] **Phase 1**: Anchor escrow program (create, accept, prove, settle)
- [ ] **Phase 2**: Backend API (auth, users, dares, media, indexer)
- [ ] **Phase 3**: Web frontend (Privy login, dashboard, dare flow)
- [ ] **Phase 4**: Integration testing on Devnet
- [ ] **Phase 5**: Mobile app (React Native)
- [ ] **Future**: Community staked voting, USDC support, NFT proof badges

## Why Solana?

- ⚡ **Sub-second finality** — Dares settle instantly
- 💸 **Near-zero fees** — A $2 dare is viable; try that on Ethereum
- 🌍 **Borderless micropayments** — Dare anyone, anywhere, with no banking friction
- 🔒 **Programmable escrow** — Trustless by design

## Contributing

This project is in active development. Contributions welcome!

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT © [Pratik Kale](https://github.com/Pratikkale26)
