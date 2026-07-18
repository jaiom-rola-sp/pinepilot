# PinePilot

AI Chrome extension for TradingView that turns plain-English trading ideas into
runnable Pine Script, and helps fix, explain, and refactor scripts without
leaving the charting workflow.

> Output is educational software assistance, not investment advice. No claim of
> profitability is made for any generated script.

## Status

Early foundation (Milestone **F1**). This repo currently contains the monorepo
scaffolding and shared type/validation contracts only. Application code
(extension, backend, AI generation, billing) is added in later milestones.

## Stack (locked decisions)

- **Language:** TypeScript everywhere
- **Monorepo:** pnpm workspaces
- **Backend:** Node.js + Fastify _(added in F2)_
- **Extension:** Plasmo + React + Tailwind _(added in F3)_
- **Validation/contracts:** Zod (shared across client + server)
- **Auth:** Google OAuth _(added in Auth milestone)_
- **LLM:** OpenAI first, behind a provider abstraction _(added in Generation milestone)_
- **Persistence:** Postgres (Prisma) + Redis, cloud-save by default _(added in F2)_
- **Billing:** Stripe behind a service boundary _(added in Billing milestone)_
- **Deployment target:** Railway first

## Repository layout

```
pinepilot/
├─ packages/
│  └─ shared/          # Zod schemas + inferred types shared by all apps
├─ apps/               # (added in later milestones: extension, api)
├─ ai-tradingview-prd.md   # Product source of truth
└─ ai-tradingview-tdd.md   # Technical source of truth
```

## Prerequisites

- Node.js >= 20
- pnpm >= 9 (via `corepack enable`)

## Getting started

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

## Scripts (root)

| Script           | Description                           |
| ---------------- | ------------------------------------- |
| `pnpm build`     | Build all workspace packages          |
| `pnpm test`      | Run all workspace tests               |
| `pnpm typecheck` | Type-check all workspace packages     |
| `pnpm lint`      | Lint the repo (zero warnings allowed) |
| `pnpm format`    | Format the repo with Prettier         |
