# PinePilot

AI Chrome extension for TradingView that turns plain-English trading ideas into
runnable Pine Script, and helps fix, explain, and refactor scripts without
leaving the charting workflow.

> Output is educational software assistance, not investment advice. No claim of
> profitability is made for any generated script.

## Status

Active development. The end-to-end path works locally: sign in, generate Pine v6
from natural language, and insert into the TradingView Pine Editor, with
account-level usage quotas enforced by the backend.

Delivered milestones:

- **F1/F2** — pnpm monorepo, shared Zod contracts, Fastify API bootstrap.
- **A1** — Google OAuth backend, JWT access + rotating refresh tokens, `GET /v1/me`.
- **A2** — extension auth wiring (Plasmo background worker owns tokens/API calls).
- **G1** — `POST /v1/generate`: LLM provider boundary (OpenAI structured outputs),
  prompt builder, validation + retry + guardrails, `Generation` persistence.
- **X1** — extension generate UI + wiring (idle/loading/success/error/quota states,
  copy-to-clipboard), styled with the UI/UX Pro Max design system.
- **T1** — in-page TradingView panel: page detection, editor adapter (context
  read + insert), graceful copy/paste fallback.
- **B1** — usage metering & quota enforcement (monthly per-plan limits, atomic
  consumption, structured `429` + `X-RateLimit-*` headers).

Next up: **B2** — billing & plan management (Stripe) and a usage surface on `/v1/me`.

## Stack

- **Language:** TypeScript everywhere
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js + Fastify
- **Extension:** Plasmo + React
- **Validation/contracts:** Zod (shared across client + server)
- **Auth:** Google OAuth (JWT access + rotating refresh tokens)
- **LLM:** OpenAI first, behind a provider abstraction
- **Persistence:** Postgres (Prisma) + Redis
- **Billing:** Stripe behind a service boundary _(B2)_
- **Deployment target:** Railway first

## Repository layout

```
pinepilot/
├─ packages/
│  └─ shared/              # Zod schemas + inferred types shared by all apps
├─ apps/
│  ├─ api/                 # Fastify backend (auth, generation, usage/quota)
│  │  └─ prisma/           # Prisma schema + migrations
│  └─ extension/           # Plasmo extension (popup + TradingView content script)
├─ docker-compose.yml      # Local Postgres + Redis
├─ ai-tradingview-prd.md   # Product source of truth
└─ ai-tradingview-tdd.md   # Technical source of truth
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (via `corepack enable`)
- Docker (for local Postgres + Redis)

## Getting started

```bash
pnpm install

# Start local Postgres + Redis
docker compose up -d

# Configure the API, then run migrations
cp apps/api/.env.example apps/api/.env   # fill in secrets (Google, OpenAI, JWT)
pnpm --filter @pinepilot/api prisma:migrate

# Configure the extension build-time public env
cp apps/extension/.env.example apps/extension/.env

# Repo-wide checks
pnpm lint
pnpm typecheck
pnpm test
```

### Run the API

```bash
pnpm --filter @pinepilot/api dev      # http://localhost:3000 (GET /health)
```

### Run / load the extension

```bash
pnpm --filter @pinepilot/extension dev     # dev build with HMR
pnpm --filter @pinepilot/extension build   # production build
```

Then load the unpacked extension from `apps/extension/build/chrome-mv3-prod`
via `chrome://extensions` (enable Developer mode → Load unpacked).

## API surface

| Method & path           | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| `GET /health`           | Liveness/readiness probe                             |
| `POST /v1/auth/google`  | Exchange a Google ID token for access/refresh tokens |
| `POST /v1/auth/refresh` | Rotate refresh token, issue a new access token       |
| `GET /v1/me`            | Current authenticated user                           |
| `POST /v1/generate`     | Generate Pine Script (authenticated, quota-enforced) |

`POST /v1/generate` returns `usage.requestsRemaining` and `X-RateLimit-*`
headers; it responds `429` with `{ "error": { "code": "quota_exceeded", ... } }`
when the account's monthly plan limit is reached.

## Scripts (root)

| Script           | Description                           |
| ---------------- | ------------------------------------- |
| `pnpm build`     | Build all workspace packages          |
| `pnpm test`      | Run all workspace tests               |
| `pnpm typecheck` | Type-check all workspace packages     |
| `pnpm lint`      | Lint the repo (zero warnings allowed) |
| `pnpm format`    | Format the repo with Prettier         |

Package-scoped scripts (e.g. Prisma tasks, extension build) live in
`apps/api/package.json` and `apps/extension/package.json`.
