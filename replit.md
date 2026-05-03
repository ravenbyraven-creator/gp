# Gorilla Position — Replit Workspace

## Project Overview

**Gorilla Position** is a mobile-first WWE 2K26 Universe Mode companion app — a writers' room for booking storylines, tracking rivalries, managing your roster, and chatting with an AI creative team.

## Structure

pnpm monorepo rooted at `gp/`. All commands must be run from `gp/`.

```
gp/
├── artifacts/
│   ├── universe-mode/     # React + Vite frontend (port 5000 in dev)
│   ├── api-server/        # Express 5 API (port 8080 in dev)
│   └── mockup-sandbox/    # Design canvas iframe
├── lib/
│   ├── api-spec/          # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/  # Generated React Query hooks
│   ├── api-zod/           # Generated Zod schemas
│   ├── db/                # Drizzle ORM + PostgreSQL schema
│   └── integrations-openai-ai-server/  # Replit OpenAI integration wrapper
├── attached_assets/       # Brand images, logos
└── scripts/
```

## Workflows

- **Start application** — `cd gp && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/universe-mode run dev` → port 5000 (webview)
- **API Server** — `cd gp && PORT=8080 pnpm --filter @workspace/api-server run dev` → port 8080 (console)

## Key Commands

```sh
cd gp
pnpm install                                        # Install deps
pnpm run typecheck                                  # Typecheck all packages
pnpm run build                                      # Full build
pnpm --filter @workspace/api-spec run codegen       # Regenerate API hooks + Zod schemas from OpenAPI spec
pnpm --filter @workspace/db run push                # Push DB schema (dev only)
```

## AI Integration

OpenAI via Replit AI Integrations — env vars auto-provided:
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `AI_INTEGRATIONS_OPENAI_API_KEY`

Model: `gpt-5.4`

## Tech Stack

- **Frontend**: React 19, Vite 7, TypeScript 5.9, Tailwind CSS 4, Framer Motion, TanStack Query, Shadcn/Radix UI, Wouter
- **Backend**: Express 5, Zod, Pino logger, esbuild
- **DB**: PostgreSQL + Drizzle ORM (used for some lib packages; frontend state is localStorage)
- **Codegen**: Orval (OpenAPI → React Query hooks + Zod)
- **Package manager**: pnpm 10 workspaces, Node.js 24

## Deployment

- **Target**: autoscale
- **Build**: `cd gp && pnpm run build`
- **Run**: `cd gp && PORT=5000 pnpm --filter @workspace/api-server run start` (API serves built frontend static files)

## Important Conventions

- No emojis, anywhere, ever
- Monochrome visual system (no color except the NEWS tab)
- All new API endpoints go in `lib/api-spec/openapi.yaml` first, then run codegen
- localStorage is the persistence layer for all user data
- See `gp/UNIVERSE_MODE_ASSISTANT.md` for full product spec and build conventions
