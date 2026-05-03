# Universe Mode Assistant

## Overview

A mobile-first web app that helps a WWE 2K Universe Mode player run their show like a real WWE creative team. See `UNIVERSE_MODE_ASSISTANT.md` for the full product spec, design philosophy, and feature roadmap.

## Stack

- **Monorepo tool**: pnpm workspaces (root: `Universe-Mode/`)
- **Frontend**: React 19, Vite 7, TailwindCSS 4, shadcn/ui, Framer Motion, TanStack Query
- **Backend**: Express 5 + Pino, esbuild bundle
- **AI**: OpenAI via Replit AI Integrations (model `gpt-5.4`)
- **Validation/Codegen**: OpenAPI 3.1 + Orval → React Query hooks + Zod schemas
- **Persistence**: browser localStorage only

## Project Layout

```
Universe-Mode/
├── artifacts/
│   ├── universe-mode/   # React + Vite frontend (the app)
│   ├── api-server/      # Express backend + serves built FE in production
│   └── mockup-sandbox/  # Component preview workspace
└── lib/
    ├── api-spec/                       # OpenAPI 3.1 spec (source of truth)
    ├── api-client-react/               # Generated React Query hooks
    ├── api-zod/                        # Generated Zod schemas
    ├── db/                             # Drizzle ORM (unused by current FE)
    └── integrations-openai-ai-server/  # OpenAI client wrapper
```

## Replit Setup

Two workflows run side-by-side in development:

- **API Server** (port 8000, console): `cd Universe-Mode && PORT=8000 pnpm --filter @workspace/api-server run dev`
- **Start application** (port 5000, webview): `cd Universe-Mode && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/universe-mode run dev`

The Vite dev server proxies `/api` to `http://localhost:8000` (override with `API_PROXY_TARGET`). Vite is configured with `host: 0.0.0.0` and `allowedHosts: true` so the Replit preview iframe can reach it.

### AI Integration

The OpenAI client (`lib/integrations-openai-ai-server`) reads `AI_INTEGRATIONS_OPENAI_BASE_URL` and `AI_INTEGRATIONS_OPENAI_API_KEY`, both managed by Replit AI Integrations.

## Production Deployment

Configured as **autoscale**. The Express server serves the built frontend (`artifacts/universe-mode/dist/public`) from the same port as the API.

- **Build**: `pnpm install --frozen-lockfile && pnpm --filter @workspace/universe-mode run build && pnpm --filter @workspace/api-server run build`
- **Run**: `node --enable-source-maps Universe-Mode/artifacts/api-server/dist/index.mjs`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate hooks/schemas from OpenAPI
- `pnpm --filter @workspace/api-server run dev` — local API with rebuild
- `pnpm --filter @workspace/universe-mode run dev` — local Vite dev server

## Recent Changes

- 2026-04-29: GitHub import re-setup. Installed pnpm 10 (via npm), ran `pnpm install --frozen-lockfile` inside `Universe-Mode/`, re-provisioned the OpenAI AI integration (`AI_INTEGRATIONS_OPENAI_BASE_URL` + `AI_INTEGRATIONS_OPENAI_API_KEY`), reconfigured the two workflows (API Server on port 8000, Start application on port 5000) so they `cd gorillapostion/Universe-Mode` first, and reconfigured the autoscale deployment to build/run from `gorillapostion/Universe-Mode/`.
- 2026-04-29: Initial Replit setup. Added Vite `/api` proxy, configured both workflows, made Express serve the built frontend in production, configured autoscale deployment.
- 2026-04-29: Roster cards redesigned (square photo, polaroid frame, brand-themed full-bleed backdrops with WWE logo). Optional `imageUrl` per wrestler with file-upload widget.
- 2026-04-29: Added **Shows** feature — new tab + `Show` schema (id, name, vibe, night, imageUrl). Wrestlers can be assigned a `showId`; card backdrop uses the show's image when set, otherwise falls back to brand theme. `useShows()` hook seeds Raw + SmackDown on first load. `buildBookerContext` now embeds the shows list and the server prompt includes a `SHOWS` section so the AI keeps storylines on-brand.
- 2026-04-29: Added **LOG / Night Notes** feature — 04 WHAT HAPPENED card in Quick Book opens a free-text textarea. Saves as `kind: "log"` in `umc.history`; last 5 logs sent as `recentEvents` to all AI endpoints so the AI treats them as canon. Rivalries tab gains LOGS filter pill.
- 2026-04-29: Added **Promo Generator** — new `POST /api/booker/promo` endpoint plus a 04 GIVE ME A PROMO Quick Book card that opens a wrestler-picker + 4-up tone selector (HEEL / BABYFACE / COCKY / WOUNDED). Returns a `PromoScript` with an ALL-CAPS chyron headline and 4-6 labeled beats whose `text` is the actual first-person line the wrestler says into the mic. Saved to history as `kind: "promo"`, surfaced via a new PROMOS filter in Rivalries and a `PromoContent` variant on the cinematic result screen. Per-tone server guidance keeps each tone distinct. No new deps.
- 2026-04-29: Added **Universe Clock + Premium Events** — abstract universe-time bar above Creative Desk showing current date (`MAY · WEEK 2 · MONDAY`), next-PPV chip with WEEKS OUT, ADVANCE button (jumps to the nearest show night or premium event), and an UNDO affordance that auto-clears after 8s. New `lib/calendar.ts` for date math, `UniverseClock.tsx` + `EventsDialog.tsx` components, three new localStorage keys (`umc.universeDate`, `umc.events`, `umc.lastUniverseDate`). OpenAPI gained `currentDate` + `upcomingEvents` on `BookerRequest` and `BookerChatRequest`; server's `buildContext` adds CURRENT DATE and UPCOMING PREMIUM EVENTS sections. No new deps, monochrome only, no calendar widget. AI verified to cite the universe date and next PPV correctly.
