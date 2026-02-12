# DareMe — Backend API

Bun + Express + Prisma backend for DareMe.

## Setup

```bash
bun install
cp .env.example .env    # configure DB, S3, Privy, Helius
bun run db:migrate
bun run db:generate
bun run dev             # starts on :8080
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_S3_BUCKET` | S3 bucket for proof media |
| `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | AWS/DO Spaces credentials |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | Privy server-side auth |
| `SOLANA_RPC_URL` | Solana RPC (Helius devnet) |
| `HELIUS_API_KEY` | For webhook indexing |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/login` | Authenticate via Privy JWT |
| `GET` | `/api/users/me` | Get current user |
| `PATCH` | `/api/users/me` | Update profile |
| `POST` | `/api/dares` | Create dare (with on-chain PDA) |
| `GET` | `/api/dares` | List dares (filters, pagination) |
| `GET` | `/api/dares/trending` | Trending dares |
| `GET` | `/api/dares/:id` | Dare detail |
| `POST` | `/api/dares/:id/proof` | Submit proof |
| `GET` | `/api/upload/presigned-url` | S3 presigned upload URL |
| `GET` | `/api/notifications` | User notifications |
| `PATCH` | `/api/notifications/read-all` | Mark all read |
| `POST` | `/api/webhooks/helius` | Helius on-chain indexer |
