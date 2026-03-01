# Epsilon Trust Verification Center

Public-facing web application for verifying AWS Nitro Enclave attestations. Anyone can cryptographically verify that code executed inside a genuine enclave and that output was not tampered with. No login required.

## How It Works

When code runs inside an AWS Nitro Enclave, the hardware generates a cryptographically signed **attestation document**. This document:

- Is signed by AWS Nitro hardware (cannot be forged)
- Contains **PCR values** — hashes of the exact enclave binary
- Embeds the **SHA-256 hash** of execution output in the `user_data` field
- Includes a **certificate chain** traceable to the AWS root certificate

The Trust Center performs verification both **server-side** (pre-computed) and **client-side** (in your browser using WebCrypto), so you don't need to trust anyone.

## Features

- **Public job ledger** — browse all verified executions with pagination
- **Dual verification** — server-side + client-side cryptographic checks
- **Interactive trust chain graph** — React Flow visualization of the attestation trust chain
- **PCR registry comparison** — compare enclave measurements against published expected values
- **Manual verification** — paste any raw base64 attestation document for browser-only verification
- **CLI commands** — copy-paste commands to verify attestations independently
- **Zero authentication** — fully public, read-only access

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, TypeScript 5.9 |
| Styling | Tailwind CSS 3, shadcn/ui (Radix) |
| Routing | Wouter |
| Data Fetching | TanStack React Query |
| Trust Chain Graph | @xyflow/react (React Flow) |
| Client-side Crypto | @epsilon-data/nitro-verify |
| Backend | Express 5 |
| Database | PostgreSQL (read-only) |
| Security | Helmet, express-rate-limit |

## Prerequisites

- Node.js 20+
- PostgreSQL database with `job_requests` table (read-only access)
- [@epsilon-data/nitro-verify](https://github.com/Epsilon-Data/nitro-verify) package (client-side attestation verification)

## Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your database URL and settings

# Development (frontend + backend concurrently)
npm run dev:all

# Or run separately:
npm run dev          # Vite frontend on :5173
npm run dev:server   # Express API on :3001
```

The Vite dev server proxies `/api/*` requests to the Express backend.

## Production Build

```bash
# Build frontend
npm run build

# Build server
npm run build:server

# Start (serves both API and static frontend)
npm start
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `DATABASE_SSL` | No | auto-detected | Set `true` to enable SSL |
| `DATABASE_POOL_MAX` | No | `5` | Max database connections |
| `PORT` | No | `3001` | Server port |
| `CORS_ORIGIN` | No | disabled | Allowed CORS origin (e.g. `http://localhost:5173`) |
| `RATE_LIMIT_MAX` | No | `100` | Max API requests per minute |
| `GITHUB_OWNER` | No | `epsilon-data` | GitHub org for PCR registry |
| `GITHUB_REPO` | No | `epsilon-enclave` | GitHub repo for PCR registry |
| `GITHUB_TOKEN` | No | — | GitHub token (optional, for private repos) |
| `EXPECTED_PCR0` | No | — | Fallback PCR0 value if GitHub fetch fails |
| `EXPECTED_PCR1` | No | — | Fallback PCR1 value |
| `EXPECTED_PCR2` | No | — | Fallback PCR2 value |

## API Endpoints

All endpoints are read-only. No authentication required.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/stats` | Aggregate verification statistics |
| `GET` | `/api/jobs?page=1&limit=25` | Paginated public job ledger |
| `GET` | `/api/verify/:jobId` | Full attestation data for a job |
| `GET` | `/api/pcr-registry` | Published expected PCR values |

## Project Structure

```
├── server/
│   ├── index.ts          # Express routes, PCR registry, static serving
│   └── db.ts             # PostgreSQL connection pool
├── src/
│   ├── App.tsx           # Router setup
│   ├── pages/
│   │   ├── HomePage.tsx          # Stats + public job ledger
│   │   ├── VerifyPage.tsx        # Job verification (graph + details)
│   │   ├── ManualVerifyPage.tsx  # Paste-your-own attestation
│   │   └── AboutPage.tsx         # How attestation works
│   ├── components/
│   │   ├── verify/       # Verification UI (detail cards, graph, CLI)
│   │   ├── shared/       # StatusBadge, HashDisplay, FieldRow
│   │   ├── layout/       # Header
│   │   └── ui/           # shadcn/ui primitives
│   ├── hooks/
│   │   └── useVerification.ts  # Client-side crypto verification hook
│   └── lib/
│       ├── api.ts        # API client + types
│       ├── types.ts      # Shared type definitions
│       ├── verify-sections.ts  # Verification section config
│       └── utils.ts      # cn(), truncateHash(), formatTimeAgo()
```

## Verification Steps

The client-side verifier (`@epsilon-data/nitro-verify`) performs these checks in your browser:

1. **Parse** — Decode the CBOR/COSE_Sign1 attestation document
2. **Certificate Chain** — Verify the chain from AWS root to enclave certificate
3. **Signature** — Verify the ES384 (ECDSA P-384) COSE_Sign1 signature
4. **PCR Match** — Compare PCR0/1/2 against published expected values
5. **Output Hash** — Verify SHA-256 of execution output matches attested hash

## License

MIT
