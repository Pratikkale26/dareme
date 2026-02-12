# DareMe — Web Frontend

Next.js 16 + React 19 + Tailwind CSS 4 web application for DareMe.

## Setup

```bash
bun install
cp .env.example .env
bun run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8080`) |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Privy application ID |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana RPC endpoint (Helius devnet) |
| `NEXT_PUBLIC_PROGRAM_ID` | Deployed Anchor program address |

## Key Features

- **Privy auth** — Login with X, Google, or wallet (Phantom, Backpack, etc.)
- **Real Anchor transactions** — All dare actions (create, accept, approve, reject, cancel, refuse, submit proof) send real on-chain instructions
- **PDA escrow** — SOL locked in program-derived accounts, released on approval
- **Proof uploads** — S3 presigned upload + SHA-256 hash stored on-chain
- **Live Solscan links** — Transaction and account links for transparency

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | User's dashboard with wallet info and recent dares |
| `/dares` | Browse all dares with filters and search |
| `/dares/create` | Create a dare (on-chain transaction) |
| `/dares/[id]` | Dare detail with action buttons |
| `/profile` | Edit profile, view stats and dare history |
| `/notifications` | Notification center |
