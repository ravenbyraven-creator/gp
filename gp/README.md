# Gorilla Position Workspace

Gorilla Position is a WWE 2K Universe Mode companion app. The workspace is a pnpm monorepo with a React/Vite frontend, an Express API, generated OpenAPI clients, and shared TypeScript packages.

## Requirements

- Node.js 24
- pnpm
- Replit AI Integrations OpenAI credentials for AI booker routes

## Required Environment Variables

The Replit environment provides these automatically for deployed artifacts. For local development, set them before starting the matching service.

| Variable | Used by | Purpose |
| --- | --- | --- |
| `PORT` | frontend and API | Port for Vite preview/dev server or Express |
| `BASE_PATH` | frontend | Vite base path for the app |
| `API_PROXY_TARGET` | frontend dev server | Optional API target; defaults to `http://localhost:8000` |
| `STATIC_DIR` | API | Optional built frontend directory; defaults to `artifacts/universe-mode/dist/public` |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API | OpenAI-compatible Replit integration URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API | Replit integration API key |

## Common Commands

```sh
pnpm install
pnpm run typecheck
pnpm run test
pnpm run build
```

Run the frontend locally:

```sh
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/universe-mode run dev
```

Run the API locally:

```sh
PORT=8000 AI_INTEGRATIONS_OPENAI_BASE_URL=<url> AI_INTEGRATIONS_OPENAI_API_KEY=<key> pnpm --filter @workspace/api-server run dev
```

## Stability Checks

The test suite focuses on logic that future feature work is likely to touch:

- AI booker context creation in `artifacts/universe-mode/src/lib/storage.ts`
- Rivalry display and participant helpers in `artifacts/universe-mode/src/lib/rivalry.ts`
- News cover helper behavior in `artifacts/universe-mode/src/lib/news.ts`
- API model JSON parsing and schema validation behavior in `artifacts/api-server/src/lib/model-json.ts`

These checks are intentionally fast and do not call OpenAI.
