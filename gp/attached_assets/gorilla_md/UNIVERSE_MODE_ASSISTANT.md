# Universe Mode Assistant — Build Document

A complete record of what has been built, the design mindset behind it, and the
technical foundations so that you (or any future builder) can pick up exactly
where we left off.

---

## The Vision

A mobile-first web app that helps a WWE 2K Universe Mode player run their show
the way a real WWE creative team would — but in a calm, focused, immersive
"writers' room" feel. NOT a loud arcade game menu, NOT a SaaS dashboard, NOT a
ChatGPT clone. A purpose-built creative tool for booking your wrestling
universe.

**The mindset throughout this build:**

1. **Treat the user like a creative partner, not a user of a tool.** Every
   surface should feel like the room a real WWE writer would actually want to
   spend hours in.
2. **The result screen is the moment.** When a storyline drops, it should
   feel cinematic — high contrast, big typography, a stamp that springs in.
   The day-to-day chrome is calm so that the cinematic moment can hit.
3. **Persistence is invisible.** No login, no database, no tracking. Everything
   is saved locally in the browser. The app remembers the universe so the user
   never has to re-paste anything.
4. **The AI knows the universe.** Roster, chairman persona, ongoing rivalries
   are auto-loaded as context on every request — both for structured generators
   and the chat. The AI behaves like it's been in the writers' room with you.
5. **No emojis. Ever.** This is a serious creative tool, not a kid's toy.
6. **Monochrome is the default.** Color is a tool of last resort — contrast,
   weight, scale, and motion do the heavy lifting.

---

## What's Built

### Architecture
- **Monorepo** (pnpm workspace) with three artifacts:
  - `artifacts/universe-mode` — React + Vite frontend (the app)
  - `artifacts/api-server` — Express backend
  - `artifacts/mockup-sandbox` — design preview workspace
- **Shared libraries**:
  - `lib/api-spec` — OpenAPI 3.1 spec, source of truth for API contracts
  - `lib/api-client-react` — auto-generated React Query hooks
  - `lib/api-zod` — auto-generated Zod schemas for validation
  - `lib/integrations-openai-ai-server` — wraps the Replit-managed OpenAI
    integration
- **Codegen**: `pnpm --filter @workspace/api-spec run codegen` regenerates
  hooks + schemas from the OpenAPI spec
- **AI provider**: OpenAI via Replit AI Integrations (model `gpt-5.4`).
  Credentials live in `AI_INTEGRATIONS_OPENAI_BASE_URL` and
  `AI_INTEGRATIONS_OPENAI_API_KEY` environment variables — managed by Replit.

### API Endpoints (all under `/api/booker/`)
1. `POST /booker/storyline` — generates a structured storyline scene (feud,
   participants, beats, headline)
2. `POST /booker/show` — books a full TV show card (4 matches: OPENER /
   MID-CARD / GRUDGE MATCH / MAIN EVENT, each with result + twist + headline)
3. `POST /booker/surprise` — generates a backstage incident / debut /
   betrayal (WHO / WHERE / WHAT HAPPENED / FALLOUT + headline)
4. `POST /booker/promo` — writes a full cut-promo script for a chosen wrestler
   in a chosen tone (HEEL / BABYFACE / COCKY / WOUNDED). Returns labeled beats
   (OPENING / SETUP / ESCALATION / GUT PUNCH / CLOSER) where each beat's text
   is the actual first-person line the wrestler says into the mic, plus an
   ALL-CAPS headline and stamp.
5. `POST /booker/chat` — conversational chat with the AI booker

**Every request body accepts:**
- `roster` — structured wrestler list
- `shows` — user-defined brands (Raw / SmackDown / NXT etc.) with night + vibe
- `chairman` — selected head-writer persona (name + booking style)
- `ongoingRivalries` — recent storylines for continuity (capped to 5)
- `recentEvents` — free-text logs of what actually aired in-game, capped to 5, treated as canon by the AI
- `currentDate` — `{ month, week, day }` position in the user's universe timeline
- `upcomingEvents` — premium events the user is building toward (name + date + `weeksOut`), capped to 5

The backend builds a context preamble from these and prepends it to the system
prompt so the AI always knows the universe.

### Frontend — Three Tabs + Settings

#### Tab 1: CREATIVE DESK
**Universe Clock + Premium Events bar** sits above the desk on this tab. Left
side shows the current universe date as `MAY · WEEK 2 · MONDAY`. Middle shows
the next premium event line — name plus a `WEEKS OUT` chip — and tapping it
opens the Premium Events dialog (add / edit / delete events; capped at 8). Right
side has an `ADVANCE` button that jumps the universe to the next show night or
premium event, whichever comes first; once advanced, an `UNDO` affordance
appears for 8 seconds and is then dismissed automatically. The clock and event
slate are persisted to localStorage and shipped to the AI on every request as
`currentDate` and `upcomingEvents` — the AI uses them to pace storylines toward
the right PPV. Past events auto-archive when time moves past them (they do not
land in Rivalries history).

Two sub-modes flipped via a pill toggle:
- **CHAT** — a real conversation with the AI. Single rolling thread,
  persisted locally. Empty state offers four suggested prompt chips. Auto-scrolls
  on new messages, has a typing indicator, has a CLEAR CHAT affordance.
  Context (booking-as / roster size / active rivalries) shown above the thread.
- **QUICK BOOK** — four large cards:
  - 01 GIVE ME A STORYLINE — structured angle generator → cinematic Result Screen
  - 02 BOOK MY SHOW — full show card generator → cinematic Result Screen
  - 03 SURPRISE ME — backstage incident/debut/betrayal generator → cinematic Result Screen
  - 04 WHAT HAPPENED — free-text log of in-game events. Opens a focused textarea entry view (calm chrome, no result screen). Saves as a `kind: "log"` entry that feeds the AI's `recentEvents` context as canon on every future request.

**Result Screen**: dark left panel with a stamp that springs in (ANGLE SET,
CARD LOCKED, BIG SUCCESS, BACKSTAGE CHAOS), right panel with structured
content rendered in big bold type, BACK affordance. Every result auto-saves to
the Rivalries history.

#### Tab 2: ROSTER
Full CRUD for wrestlers stored in localStorage.
- Each wrestler: name (required), brand (RAW / SmackDown / NXT / Free Agent),
  alignment (Face / Heel / Tweener), notes
- Search bar + brand filter pills
- Empty-state "QUICK START: ADD THE 2025 WWE ROSTER" button that pre-loads
  ~20 current superstars
- Add / edit slide-in dialog form
- Delete with confirm

#### Tab 3: RIVALRIES
Auto-tracked feed of every generated storyline, show, surprise, and night log.
- Grouped by feud where possible
- Filter pills: ALL / STORYLINES / SHOWS / SURPRISES / LOGS
- Click to expand and see the full timeline (logs display as plain prose blocks, no expand needed)
- Each entry deletable

#### Settings (full-screen view, gear icon)
Sections in order:
- **APPEARANCE**
  - Theme: Dark / Light segmented toggle
  - Font picker with live previews:
    - System Sans (Inter, default)
    - Display (Oswald, condensed bold)
    - Serif (Lora, writerly)
    - Mono (JetBrains Mono, terminal feel)
- **CHAIRMAN** — 8 curated head-writer personas as selectable cards:
  - Vince McMahon — wild swerves, dominant champions, spectacle
  - Triple H — long-term storytelling, in-ring excellence, stables (default)
  - Paul Heyman — mic-driven character work
  - Vince Russo — crash TV, shock swerves, no-DQ chaos
  - Bruce Pritchard — old-school territory feel, slow burns
  - Michael Hayes — Southern wrestling, tag team focus
  - Eric Bischoff — surprise debuts, faction warfare
  - Jim Cornette — traditional in-ring storytelling, real grudges
- **ROSTER** — Export (downloads JSON) / Import (file picker)
- **DANGER ZONE** — Clear Chat / Clear Rivalries / Factory Reset (requires
  typing "RESET")

#### News Ticker (always visible at bottom)
- Continuously scrolling marquee
- Pulls headlines from every saved storyline / show / surprise (newest first)
- Empty state shows a placeholder until the user generates content

### Persistence (localStorage keys)
- `umc.roster` — array of Wrestler objects
- `umc.shows` — array of Show objects (user's brands)
- `umc.chairman` — selected ChairmanProfile
- `umc.history` — array of RivalryEntry (storylines, shows, surprises, and `kind: "log"` night notes)
- `umc.chat` — chat thread message history
- `umc.theme` — `"dark"` or `"light"`
- `umc.font` — font key
- `umc.universeDate` — `{ year, month, week, day }` current position in the user's universe (default `{0,1,1,1}`)
- `umc.events` — array of PremiumEvent (max 8); auto-archived when universe date passes them
- `umc.lastUniverseDate` — pre-advance snapshot used to power the UNDO affordance; cleared after 8s

All hooks live in `artifacts/universe-mode/src/lib/storage.ts`. The
`buildBookerContext(roster, chairman, history, shows, currentDate, events)`
helper assembles the API request payload — reused by both the chat and the
structured generators. Date math (`formatDate`, `dateToInt`, `weeksUntil`,
`advanceToNextShow`, `archivePastEvents`) lives in
`artifacts/universe-mode/src/lib/calendar.ts`.

### Visual System
- **Monochrome accent.** No red. White on black in dark mode, black on white
  in light mode. All "highlight" effects use opacity, weight, border, or
  background tint — never color.
- **Typography.** Display heads use a strong condensed sans (Oswald). Body
  is clean sans (Inter). User-selectable font picker overrides body globally.
- **Subtle texture.** Faint vignette only — no scanlines, no arcade
  treatment.
- **Motion.** Subtle fade/slide on chat messages. The result screen still
  uses a confident spring animation on the stamp — that's the moment.

---

## Design Philosophy (the mindset)

- **Less > more.** Every screen has been pushed toward removing decoration
  rather than adding it. The user already sees their universe in their head
  while playing the game; the app should not compete with that.
- **Type does the work.** Hierarchy comes from scale, weight, and casing.
  ALL CAPS for show names, championship titles, stamps, and headlines.
  Everything else is sentence case.
- **Cinematic moments earned by calm chrome.** The result screen is allowed
  to be loud only because the rest of the app is quiet.
- **Context is automatic, not asked for.** The user never has to re-paste
  their roster or remind the AI who their champion is. The app remembers.
- **Errors are kayfabe.** "CREATIVE OVERRULED" instead of "Internal Server
  Error." Every surface keeps the world intact.
- **Mobile-first.** All layouts collapse gracefully. Touch targets are
  generous.

---

## Tech Stack Reference

- **Frontend**: React 18, Vite, TypeScript, TailwindCSS, shadcn/ui
  components, Framer Motion (springs/transitions), TanStack Query, Sonner
  (toasts)
- **Backend**: Express, TypeScript, Zod (request/response validation), Pino
  logger
- **AI**: OpenAI (`gpt-5.4`) via Replit AI Integrations proxy, JSON
  response_format for structured generators, plain chat completions for the
  conversational endpoint
- **Codegen**: Orval (OpenAPI → React Query hooks + Zod schemas)
- **Persistence**: browser localStorage only

---

## File Map (key files)

```
artifacts/universe-mode/src/
├── App.tsx                          # ThemeProvider + tab/settings shell
├── index.css                        # CSS variables, fonts, monochrome palette
├── components/
│   ├── AppHeader.tsx                # Top bar (logo, tabs, gear)
│   ├── CreativeDesk.tsx             # Universe Clock + CHAT/QUICK BOOK toggle
│   ├── UniverseClock.tsx            # Date display, next-event line, ADVANCE/UNDO
│   ├── EventsDialog.tsx             # Premium Events list + add/edit form
│   ├── Chat.tsx                     # Chat thread + input + suggestions
│   ├── ResultScreen.tsx             # Cinematic result reveal
│   ├── Stamp.tsx                    # Spring-in stamp on result screen
│   ├── Roster.tsx                   # Roster CRUD
│   ├── Shows.tsx                    # Brand / show CRUD
│   ├── Rivalries.tsx                # Auto-tracked feed
│   ├── SettingsView.tsx             # Full-screen settings
│   └── NewsTicker.tsx               # Bottom marquee
└── lib/
    ├── storage.ts                   # localStorage hooks + buildBookerContext
    ├── calendar.ts                  # Universe-date math (format, advance, weeksUntil)
    ├── chairmen.ts                  # Curated chairman personas
    ├── seedRoster.ts                # 2025 WWE quick-start data
    ├── seedShows.ts                 # Default brand seeds
    └── fonts.ts                     # FONT_OPTIONS for picker

artifacts/api-server/src/routes/
└── booker.ts                        # 4 endpoints + context-builder helpers

lib/api-spec/openapi.yaml            # Source of truth for API contracts
```

---

## Suggested Next Features (in priority order)

If you want to keep building, here is a roadmap that fits the current mindset:

1. **Storyline arcs.** Group related storyline beats into named multi-week
   arcs. Generate the full arc up front, then check off beats week by week.
2. **Roster rivalries graph.** Visualize who is feuding with whom (force-
   directed graph or simple connection lines on a roster grid).
3. **AI streaming.** Switch chat to streaming responses (SSE) so replies
   render token-by-token instead of all-at-once. More immersive.
4. **Image generation hook.** Use AI image gen to produce stylized poster
   art for each PLE / storyline title card. Caches in localStorage as
   data URIs.
5. **Brand split mode.** Let the user choose to focus a generation on a
   single brand (RAW only, SmackDown only, NXT only) so the booking
   respects roster splits.
6. **Multiple universes.** Save / switch between separate universe slots
   (e.g. "Main Roster Save", "AEW Crossover What-If", "Attitude Era
   Throwback") — each with its own roster, chairman, and rivalries.

---

## Important Build Conventions to Maintain

- **Keep the monochrome rule.** If you find yourself wanting to add a color
  highlight, ask if weight, scale, or opacity could do the same job.
- **No emojis.** Anywhere. Ever.
- **API-first.** Add new endpoints to `lib/api-spec/openapi.yaml` first,
  then run `pnpm --filter @workspace/api-spec run codegen` to regenerate
  hooks + schemas, then implement the route in
  `artifacts/api-server/src/routes/booker.ts`.
- **Always pass full context** (roster, chairman, ongoingRivalries) to every
  AI endpoint. The AI's job is to feel like it's been in the writers' room
  with you.
- **localStorage stays the persistence layer** unless you have a real reason
  to add a database. The "no login, no tracking" promise is part of the
  product.
- **Result screens stay cinematic.** Don't water them down to match the
  calm chrome — that contrast is the point.
- **Read the workspace skills before structural changes.** The pnpm
  workspace, codegen pipeline, and artifact registration have their own
  conventions documented under `.local/skills/`.

---

You are doing great work. Keep going.

---

## Recent Changes

- **2026-04-30 — RIVALRIES REDESIGN, PHASE 2 (AI LAYER).** Built the AI layer on top of the Phase 1 manual rivalries / chapters / memories storage. Two new endpoints: `POST /api/booker/chapter-suggest` returns one `ChapterSuggestion {title, description, suggestedStartDate, suggestedEndDate?}` and `POST /api/booker/memory-distill` returns `MemoryDistillation {memories[]}` (max 5, each `text` ≤ 200 chars + `date`). Both share a new `RivalryAnalyzeRequest` body that's the standard booker context plus a focused `rivalryContext: {title, sides[], recentEntries[{kind, summary, universeDate}]}`. Added `ActiveRivalryMemory {rivalryTitle, beats[]}` and wired it onto `BookerRequest`, `PromoRequest`, and `BookerChatRequest` so every AI call now sees the player's top-5 most-active rivalries with their three newest pinned memories — server prompt gains a new `ACTIVE RIVALRY MEMORIES` section after `RECENT EVENTS`. Added `SuggestedRivalryHint {matchupGuess, confidence}` and attached it to `StorylineScene`, `SurpriseScene`, and `PromoScript`; storyline/promo/surprise prompts now ask for it explicitly. Frontend: `RivalryDetail` `CHAPTERS` tab is now a full editor (manual add / edit / delete / up-down reorder + `SUGGEST CHAPTER` button); `MEMORIES` tab is a full editor (manual pin with 200-char counter + `DISTILL FROM HISTORY` button that splats up to 5 AI memories with the `AI` badge). `FileToRivalryDialog` now consumes the storyline/promo/surprise hint, scores it against ACTIVE rivalries (case-insensitive, ignores "vs"), and pre-selects the match (red-bordered "AI suggested this rivalry" row at the top); when no active rivalry matches it shows a subtle note and emphasizes the "Create new" button. Chat now hangs a ghost `SAVE TO RIVALRY` button under each AI reply that opens a new `ChatToRivalryDialog` — trim the reply to a memory (200-char counter), pick an active rivalry to file it to, or create a new rivalry first. Storage: `buildBookerContext` extended with `(rivalries, memories)` params and now computes the `activeRivalryMemories` payload. Both Quick Book and Chat callers updated. No new dependencies. Monochrome only — brand red `#dc1e1e` is reused for the AI hint affordances and the AI memory badge. OpenAPI updated, codegen rerun, full typecheck and production build pass clean.

- **2026-04-29 — PROMO GENERATOR.** New `POST /api/booker/promo` endpoint plus a fourth Quick Book card (04 GIVE ME A PROMO) and a dedicated picker view. The picker is a wrestler dropdown (sourced from the user's roster) and a 4-up tone selector (HEEL / BABYFACE / COCKY / WOUNDED). On submit it sends the standard booker context plus `wrestlerName` + `tone`, and the AI returns a `PromoScript` (`kind: "promo"`) with `headline` (ALL CAPS chyron), `stamp`, `wrestlerName`, `tone`, and 4-6 labeled `beats` whose `text` is the actual first-person line the wrestler speaks into the mic (sentence case, in-character, no stage directions). Server route includes a per-tone guidance block so HEEL feels smug, BABYFACE feels fired-up, COCKY feels swaggering, WOUNDED feels quiet and dangerous. Frontend: new `PromoContent` variant in `ResultScreen` (renders headline + tone/wrestler chips + each beat as an italicized quoted line), new `kind: "promo"` `RivalryEntry` saved to history, new PROMOS filter in Rivalries with a matching expanded display, and `deriveFromHistory` updated to ignore promos when building rivalry continuity (they're lines, not feuds). OpenAPI spec updated, codegen rerun, full typecheck passes, end-to-end verified via curl — wounded Cody Rhodes returned a coherent five-beat promo with a real gut-punch line.

- **2026-04-29 — UNIVERSE CLOCK + PREMIUM EVENTS.** Added an abstract universe-time system (no real years, just `month` 1-12 / `week` 1-4 / `day` 0-6) backed by three new localStorage keys (`umc.universeDate`, `umc.events`, `umc.lastUniverseDate`) and three hooks (`useUniverseDate`, `useEvents`, `useLastUniverseDate`). New `lib/calendar.ts` owns the date math: `formatDate` ("MAY · WEEK 2 · MONDAY"), `dateToInt`/`intToDate`, `weeksUntil`, `advanceToNextShow` (jumps to whichever comes first — next Show.night or next premium event), and `archivePastEvents` (auto-removes events the universe has moved past, without writing them to Rivalries). New `UniverseClock.tsx` renders a single bar above the Creative Desk: clock block (left), tappable next-PPV line with WEEKS OUT chip (middle), `ADVANCE` button + `UNDO` affordance that disappears after 8 seconds (right). New `EventsDialog.tsx` provides the picker-only event editor (month/week/day selects, optional notes), capped at 8 events. OpenAPI spec gained `UniverseDate` and `UpcomingEvent` schemas plus `currentDate` and `upcomingEvents` properties on both `BookerRequest` and `BookerChatRequest`; codegen rerun. Server `buildContext` adds `CURRENT DATE` and `UPCOMING PREMIUM EVENTS` sections (each omitted if empty). `buildBookerContext` now takes `(roster, chairman, history, shows, currentDate, events)` and ships the date plus the top-5 nearest events with `weeksOut` precomputed. Wired into both Quick Book mutations (CreativeDesk) and chat (Chat). No new dependencies, monochrome only, no calendar widget. Verified end-to-end: AI replies correctly cite the universe date and the next PPV.

- **2026-04-29 — LOG / NIGHT NOTES feature.** Added a fourth Quick Book card (04 WHAT HAPPENED) that opens a focused free-text textarea for logging what actually happened on TV during a play session. Saves as a `kind: "log"` RivalryEntry in `umc.history` (same key as storylines/shows/surprises). The last 5 logs are extracted as `recentEvents: string[]` by `buildBookerContext` and sent to all four AI endpoints. The server's `buildContext` helper appends a RECENT EVENTS section to the system-prompt preamble when logs exist. Rivalries tab gains a LOGS filter pill and renders log entries as plain prose blocks with a LOG label and date. News Ticker ignores logs (only cinematic moments produce headlines). OpenAPI spec updated, codegen rerun, full typecheck passes.
