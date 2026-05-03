import { Router, type IRouter, type Request, type Response } from "express";
import {
  GenerateStorylineBody,
  GenerateStorylineResponse,
  BookShowBody,
  BookShowResponse,
  SurpriseMeBody,
  SurpriseMeResponse,
  GeneratePromoBody,
  GeneratePromoResponse,
  BookerChatBody,
  BookerChatResponse,
  SummarizeChatBody,
  SummarizeChatResponse,
  SuggestChapterBody,
  SuggestChapterResponse,
  DistillMemoriesBody,
  DistillMemoriesResponse,
  GenerateIssueBody,
  GenerateIssueResponse,
  GenerateRumorBody,
  GenerateRumorResponse,
  LabelEntryBody,
  LabelEntryResponse,
  BlowoffScoreBody,
  BlowoffScoreResponse,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { parseModelJson } from "../lib/model-json";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are a senior WWE creative team head writer helping a player run their WWE 2K Universe Mode. You write short, structured, kayfabe booking notes that read like internal creative-team memos.

Hard rules:
- Output ONLY valid JSON matching the schema requested. No prose, no markdown, no preamble.
- Every text field MUST be SHORT and PUNCHY. No long paragraphs. No more than ~14 words per field.
- Use real WWE-style names. If the user provided a roster, prefer those names; otherwise pull from well-known current WWE talent.
- Keep stamps to 1-3 words in ALL CAPS (e.g. "ANGLE SET", "CARD LOCKED", "BIG SUCCESS", "BACKSTAGE CHAOS", "GOLD ON THE LINE").
- Headlines MUST read like a real news ticker chyron in ALL CAPS, max 12 words, present tense, no period at the end.
- No emojis. No hashtags. No URLs.
- Keep titles in ALL CAPS.`;

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

async function callOpenAIJson(
  messages: OpenAIMessage[],
  maxCompletionTokens: number,
): Promise<{ data: unknown; usage: TokenUsage | null }> {
  const response = await openai.chat.completions.create({
    model: "gpt-5.4",
    max_completion_tokens: maxCompletionTokens,
    messages,
    response_format: { type: "json_object" },
  });
  const content = response.choices[0]?.message?.content ?? "{}";
  const usage = response.usage
    ? {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      }
    : null;
  return { data: parseModelJson(content), usage };
}

function sendBookerError(
  req: Request,
  res: Response,
  err: unknown,
  logMessage: string,
  userMessage: string,
) {
  req.log.error({ err }, logMessage);
  const payload: { error: string; detail?: string } = { error: userMessage };
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    payload.detail = err.message;
  }
  res.status(500).json(payload);
}

type Wrestler = {
  id?: string;
  name: string;
  brand?: "RAW" | "SMACKDOWN" | "NXT" | "FREE_AGENT";
  alignment?: "FACE" | "HEEL" | "TWEENER";
  notes?: string;
  showId?: string;
  status?: "ACTIVE" | "INJURED" | "INACTIVE" | "RETURNING";
  role?: "MAIN_EVENTER" | "UPPER_MIDCARD" | "MIDCARD" | "LOWER_MIDCARD" | "ENHANCEMENT";
  creativeNotes?: string;
};

type Championship = {
  id: string;
  name: string;
  brand?: string;
  division?: "MENS" | "WOMENS" | "TAG";
  currentChampionIds?: string[];
  active?: boolean;
  notes?: string;
};

type Stable = {
  id: string;
  name: string;
  memberIds?: string[];
  leaderId?: string;
  managerId?: string;
  brand?: string;
  alignment?: string;
  status?: string;
  notes?: string;
};

type Chairman = { name: string; style?: string };

type Rivalry = {
  title: string;
  participants: string[];
  recentBeats?: string[];
};

type Show = {
  id: string;
  name: string;
  vibe?: string;
  night?: string;
};

type RecentEvent = string;

type CurrentDate = { month: number; week: number; day: number };

type UpcomingEvent = {
  name: string;
  month: number;
  week: number;
  day: number;
  weeksOut: number;
  notes?: string;
};

type ActiveRivalryMemory = {
  rivalryTitle: string;
  sides?: string[];
  beats: string[];
};

type MagazineHeadline = {
  issueNumber: number;
  coverHeadline: string;
  universeDate?: CurrentDate;
};

type RecentResultsShow = {
  show: string;
  matches: Array<{ match: string; winner: string; outcome: string }>;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatUniverseDate(d: CurrentDate): string {
  const month = MONTH_NAMES[d.month - 1] ?? `Month ${d.month}`;
  const day = DAY_NAMES[d.day] ?? `Day ${d.day}`;
  return `${month}, Week ${d.week}, ${day}`;
}

function rosterContext(roster: Wrestler[] | undefined, shows: Show[] | undefined): string {
  if (!roster || roster.length === 0) {
    return "ROSTER: The user has not added wrestlers yet. Use well-known current WWE talent.";
  }
  const showNameById = new Map<string, string>((shows ?? []).map((s) => [s.id, s.name]));
  const lines = roster.map((w) => {
    const showLabel = w.showId ? showNameById.get(w.showId) : undefined;
    const tags = [showLabel ?? w.brand, w.alignment, w.role, w.status !== "ACTIVE" ? w.status : undefined].filter(Boolean).join(" / ");
    const notes = w.notes ? ` — ${w.notes}` : "";
    const creative = w.creativeNotes ? ` [CREATIVE: ${w.creativeNotes}]` : "";
    return `- ${w.name}${tags ? ` (${tags})` : ""}${notes}${creative}`;
  });
  return `ROSTER (use these names where possible, respect their show assignments and alignments):\n${lines.join("\n")}`;
}

function championshipsContext(championships: Championship[] | undefined, roster: Wrestler[] | undefined): string {
  if (!championships || championships.length === 0) return "";
  const rosterById = new Map<string, string>((roster ?? []).map((w) => [w.id ?? "", w.name]));
  const active = championships.filter((c) => c.active !== false);
  if (active.length === 0) return "";
  const lines = active.map((c) => {
    const div = c.division ? ` [${c.division}]` : "";
    const brand = c.brand ? ` (${c.brand})` : "";
    const champs = (c.currentChampionIds ?? [])
      .map((id) => rosterById.get(id))
      .filter(Boolean)
      .join(" & ");
    const holder = champs ? ` — Champion: ${champs}` : " — VACANT";
    const notes = c.notes ? ` | ${c.notes}` : "";
    return `- ${c.name}${div}${brand}${holder}${notes}`;
  });
  return `CHAMPIONSHIPS (factor title pictures into your booking and storylines):\n${lines.join("\n")}`;
}

function stablesContext(stables: Stable[] | undefined, roster: Wrestler[] | undefined): string {
  if (!stables || stables.length === 0) return "";
  const rosterById = new Map<string, string>((roster ?? []).map((w) => [w.id ?? "", w.name]));
  const active = stables.filter((s) => s.status !== "DISBANDED");
  if (active.length === 0) return "";
  const lines = active.map((s) => {
    const brand = s.brand ? ` (${s.brand})` : "";
    const align = s.alignment ? ` [${s.alignment}]` : "";
    const members = (s.memberIds ?? [])
      .map((id) => rosterById.get(id))
      .filter(Boolean)
      .join(", ");
    const leader = s.leaderId ? rosterById.get(s.leaderId) : undefined;
    const leaderStr = leader ? ` — Leader: ${leader}` : "";
    const memberStr = members ? ` | Members: ${members}` : "";
    const notes = s.notes ? ` | ${s.notes}` : "";
    return `- ${s.name}${brand}${align}${leaderStr}${memberStr}${notes}`;
  });
  return `STABLES & TAG TEAMS (respect faction dynamics and alliances when booking):\n${lines.join("\n")}`;
}

function showsContext(shows: Show[] | undefined): string {
  if (!shows || shows.length === 0) {
    return "SHOWS: No specific brands defined.";
  }
  const lines = shows.map((s) => {
    const night = s.night ? ` [${s.night}]` : "";
    const vibe = s.vibe ? ` — ${s.vibe}` : "";
    return `- ${s.name}${night}${vibe}`;
  });
  return `SHOWS (the user's brands — keep storylines and cards on-brand for the right show):\n${lines.join("\n")}`;
}

function chairmanContext(chairman: Chairman | undefined): string {
  if (!chairman || !chairman.name) {
    return "HEAD WRITER: Default modern WWE creative voice.";
  }
  const style = chairman.style ? ` Booking style: ${chairman.style}.` : "";
  return `HEAD WRITER: You are channeling ${chairman.name}.${style} Let this voice flavor the creative choices, tone, and pacing.`;
}

function rivalriesContext(rivalries: Rivalry[] | undefined): string {
  if (!rivalries || rivalries.length === 0) {
    return "ONGOING RIVALRIES: None tracked yet.";
  }
  const lines = rivalries.slice(0, 5).map((r) => {
    const beats =
      r.recentBeats && r.recentBeats.length > 0
        ? ` — recent: ${r.recentBeats.slice(-2).join(" | ")}`
        : "";
    return `- ${r.title} [${r.participants.join(", ")}]${beats}`;
  });
  return `ONGOING RIVALRIES (advance these where it makes sense, respect continuity):\n${lines.join("\n")}`;
}

function recentEventsContext(events: RecentEvent[] | undefined): string {
  if (!events || events.length === 0) return "";
  const lines = events.slice(0, 5).map(e => `- ${e}`);
  return `RECENT EVENTS — these things actually happened on TV. Treat them as canon.\n${lines.join("\n")}`;
}

function currentDateContext(date: CurrentDate | undefined): string {
  if (!date) return "";
  return `CURRENT DATE: It is currently ${formatUniverseDate(date)} in the user's universe. Pace storylines accordingly.`;
}

function upcomingEventsContext(events: UpcomingEvent[] | undefined): string {
  if (!events || events.length === 0) return "";
  const lines = events.slice(0, 5).map((e) => {
    const when = formatUniverseDate({ month: e.month, week: e.week, day: e.day });
    const out =
      e.weeksOut === 0
        ? "this week"
        : e.weeksOut === 1
        ? "1 week away"
        : `${e.weeksOut} weeks away`;
    const notes = e.notes ? ` — ${e.notes}` : "";
    return `- ${e.name}: ${when} (${out})${notes}`;
  });
  return `UPCOMING PREMIUM EVENTS — build storylines toward these dates. The closer the event, the more urgent the build:\n${lines.join("\n")}`;
}

function activeRivalryMemoriesContext(memories: ActiveRivalryMemory[] | undefined): string {
  if (!memories || memories.length === 0) return "";
  const blocks = memories.slice(0, 6).map((m) => {
    const sidesLine = m.sides && m.sides.length > 0
      ? `\n  Sides: ${m.sides.join(" vs ")}`
      : "";
    const beats = m.beats.length > 0
      ? "\n" + m.beats.slice(0, 6).map((b) => `  - ${b}`).join("\n")
      : "\n  (No canon beats filed yet — rivalry is active)";
    return `${m.rivalryTitle}${sidesLine}${beats}`;
  });
  return `ACTIVE RIVALRY MEMORIES — defining beats from the player's most active feuds. Honor this continuity when you write:\n${blocks.join("\n\n")}`;
}

function recentMagazineHeadlinesContext(headlines: MagazineHeadline[] | undefined): string {
  if (!headlines || headlines.length === 0) return "";
  const lines = headlines.slice(0, 3).map((h) => {
    const when = h.universeDate ? ` (${formatUniverseDate(h.universeDate)})` : "";
    return `- Issue #${h.issueNumber}${when}: ${h.coverHeadline}`;
  });
  return `RECENT MAGAZINE COVERS — these are the headlines the in-universe press already ran. Don't repeat them. Build on them or react to them where it makes sense:\n${lines.join("\n")}`;
}

function recentResultsContext(results: RecentResultsShow[] | undefined): string {
  if (!results || results.length === 0) return "";
  const lines = results.slice(0, 5).flatMap((r) =>
    r.matches.slice(0, 8).map((m) =>
      `  ${m.match} → ${m.winner} (${m.outcome})`
    ).map((line, i) => i === 0 ? `${r.show}:\n${line}` : line)
  );
  return `RECENT MATCH RESULTS — honor this continuity. Winners should feel strong; losers may seek rematches:\n${lines.join("\n")}`;
}

function buildContext(body: {
  roster?: Wrestler[];
  shows?: Show[];
  chairman?: Chairman;
  ongoingRivalries?: Rivalry[];
  recentEvents?: RecentEvent[];
  currentDate?: CurrentDate;
  upcomingEvents?: UpcomingEvent[];
  activeRivalryMemories?: ActiveRivalryMemory[];
  recentMagazineHeadlines?: MagazineHeadline[];
  championships?: Championship[];
  stables?: Stable[];
  recentResults?: RecentResultsShow[];
}): string {
  const parts = [
    chairmanContext(body.chairman),
    showsContext(body.shows),
    rosterContext(body.roster, body.shows),
  ];
  const champsSection = championshipsContext(body.championships, body.roster);
  if (champsSection) parts.push(champsSection);
  const stablesSection = stablesContext(body.stables, body.roster);
  if (stablesSection) parts.push(stablesSection);
  const dateSection = currentDateContext(body.currentDate);
  if (dateSection) parts.push(dateSection);
  parts.push(rivalriesContext(body.ongoingRivalries));
  const eventsSection = recentEventsContext(body.recentEvents);
  if (eventsSection) parts.push(eventsSection);
  const upcomingSection = upcomingEventsContext(body.upcomingEvents);
  if (upcomingSection) parts.push(upcomingSection);
  const memoriesSection = activeRivalryMemoriesContext(body.activeRivalryMemories);
  if (memoriesSection) parts.push(memoriesSection);
  const magazineSection = recentMagazineHeadlinesContext(body.recentMagazineHeadlines);
  if (magazineSection) parts.push(magazineSection);
  const resultsSection = recentResultsContext(body.recentResults);
  if (resultsSection) parts.push(resultsSection);
  return parts.join("\n\n");
}

const HINT_RULES = `Also include "suggestedRivalryHint": { "matchupGuess": "<NAME A vs NAME B in ALL CAPS, or empty string if no clear two-side feud>", "confidence": "high" | "medium" | "low" }. Set confidence "high" only when one feud is unambiguously central. Use "low" if it's a multi-way angle, debut, or general angle with no clear matchup; in that case matchupGuess can be empty.`;

function extractRecentResults(rawBody: unknown): RecentResultsShow[] | undefined {
  if (!rawBody || typeof rawBody !== "object") return undefined;
  const r = (rawBody as Record<string, unknown>).recentResults;
  if (!Array.isArray(r)) return undefined;
  return r as RecentResultsShow[];
}

router.post("/booker/storyline", async (req: Request, res: Response) => {
  try {
    const body = GenerateStorylineBody.parse(req.body ?? {});
    const ctx = { ...body, recentResults: extractRecentResults(req.body) };
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext(ctx)}

Generate ONE storyline / angle for the next week of programming. Return JSON with this exact shape:

{
  "kind": "storyline",
  "title": "STORYLINE",
  "stamp": "<1-3 word ALL CAPS stamp like ANGLE SET>",
  "feud": "<one-line feud title in ALL CAPS, e.g. THE BLOODLINE CIVIL WAR>",
  "participants": ["Name 1", "Name 2", "Name 3"],
  "beats": [
    { "label": "OPENING", "text": "<short punchy beat>" },
    { "label": "TWIST", "text": "<short punchy beat>" },
    { "label": "PAYOFF", "text": "<short punchy beat>" }
  ],
  "headline": "<one-line ALL CAPS news ticker headline summarizing this storyline, max 12 words>"
}

Use 3-4 beats. Each beat text MUST be a single short sentence (max 14 words). 2-4 participants.

${HINT_RULES}`,
      },
    ], 1024);
    const validated = GenerateStorylineResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "storyline generation failed", "CREATIVE OVERRULED");
  }
});

router.post("/booker/show", async (req: Request, res: Response) => {
  try {
    const body = BookShowBody.parse(req.body ?? {});
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

Book a full TV show card. Return JSON with this exact shape:

{
  "kind": "show",
  "title": "MAIN EVENT",
  "stamp": "<1-3 word ALL CAPS stamp like CARD LOCKED>",
  "showName": "<show name in ALL CAPS, e.g. MONDAY NIGHT RAW>",
  "matches": [
    {
      "slot": "OPENER",
      "match": "<wrestler> vs <wrestler>",
      "result": "<short result, max 12 words>",
      "twist": "<short twist, max 12 words>"
    }
  ],
  "headline": "<one-line ALL CAPS news ticker headline summarizing the show's biggest moment, max 12 words>"
}

Provide exactly 4 matches with slots in this order: OPENER, MID-CARD, GRUDGE MATCH, MAIN EVENT.
Every match must have a result and a twist. Keep all text short and punchy.`,
      },
    ], 2048);
    const validated = BookShowResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "show booking failed", "CREATIVE OVERRULED");
  }
});

router.post("/booker/surprise", async (req: Request, res: Response) => {
  try {
    const body = SurpriseMeBody.parse(req.body ?? {});
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

Generate ONE wild backstage incident, run-in, debut, betrayal, or surprise moment that would shake up the Universe. Return JSON with this exact shape:

{
  "kind": "surprise",
  "title": "BACKSTAGE INCIDENT",
  "stamp": "<1-3 word ALL CAPS stamp like BACKSTAGE CHAOS or BIG SUCCESS>",
  "headline": "<one-line ALL CAPS news ticker headline of the incident, max 12 words>",
  "beats": [
    { "label": "WHO", "text": "<short>" },
    { "label": "WHERE", "text": "<short>" },
    { "label": "WHAT HAPPENED", "text": "<short>" },
    { "label": "FALLOUT", "text": "<short>" }
  ]
}

Always use exactly those 4 beat labels in that order. Each beat text MUST be max 14 words.

${HINT_RULES}`,
      },
    ], 1024);
    const validated = SurpriseMeResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "surprise generation failed", "CREATIVE OVERRULED");
  }
});

const PROMO_TONE_GUIDANCE: Record<string, string> = {
  HEEL: "Smug, condescending, vicious. Belittle the audience and the opponent. Cocky reasoning, twisted logic, ice-cold confidence. Lean into being hated.",
  BABYFACE: "Earnest, fired-up, hungry. Speak to the people, fight for something bigger than yourself. Fire and conviction, never whiny.",
  COCKY: "Dripping in self-belief, swagger, charisma. Fun, quotable, brash. Talk down to the opponent without sounding angry — just amused.",
  WOUNDED: "Quiet, raw, dangerous. Speak from a place of recent loss or betrayal. Restrained intensity that builds. The character is hurt and that makes them lethal.",
};

router.post("/booker/promo", async (req: Request, res: Response) => {
  try {
    const body = GeneratePromoBody.parse(req.body ?? {});
    const tone = body.tone;
    const wrestlerName = body.wrestlerName;
    const guidance = PROMO_TONE_GUIDANCE[tone] ?? "";
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

Write a cut-promo script for ${wrestlerName} in a ${tone} tone.

Tone guidance: ${guidance}

Return JSON with this exact shape:

{
  "kind": "promo",
  "title": "PROMO",
  "stamp": "<1-3 word ALL CAPS stamp like MIC DROPPED, GO HOME, LINE IN THE SAND>",
  "wrestlerName": "${wrestlerName}",
  "tone": "${tone}",
  "headline": "<one-line ALL CAPS news ticker headline summarizing the promo's biggest line, max 12 words>",
  "beats": [
    { "label": "OPENING", "text": "<the wrestler's opening lines, sentence case, in their voice>" },
    { "label": "SETUP", "text": "<next section of the promo>" },
    { "label": "GUT PUNCH", "text": "<the line that lands hardest>" },
    { "label": "CLOSER", "text": "<the closing line(s)>" }
  ]
}

Rules:
- The "text" of each beat is the actual words the wrestler is SAYING into the mic. First person. Sentence case. NOT a description.
- Each beat text is 1-3 short sentences. Punchy, quotable, conversational.
- 4-6 beats total. Reasonable section labels (OPENING, SETUP, ESCALATION, CALLOUT, GUT PUNCH, CLOSER, etc).
- Reference the opponent / champion / situation if it makes sense from the rivalries and recent events.
- No stage directions, no parentheticals. Just the lines.
- Headline stays ALL CAPS like a chyron.

${HINT_RULES}`,
      },
    ], 1024);
    const validated = GeneratePromoResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "promo generation failed", "CREATIVE OVERRULED");
  }
});

const CHAT_SYSTEM_PROMPT = `You are a senior WWE creative team head writer in conversation with a player who runs their own WWE 2K Universe Mode.

EFFICIENCY RULES — follow these every reply:
- Only use context data that is directly relevant to the player's question. Scan it, extract what matters, ignore the rest.
- Do NOT summarize the roster or rivalries unless explicitly asked.
- If the answer is simple, reply in 1-3 sentences. No need to fill space.
- Never wall-of-text. Tight is better. Concrete beats vague.
- Prefer a partial, useful answer over an exhaustive one.

Voice and style:
- Sharp, confident, kayfabe-aware. Sound like a writer in the room, not a chatbot.
- Give CONCRETE suggestions: real names, specific match types, specific PPV slots, specific story beats.
- When asked "what should X do" — propose 2-3 options and pick a favorite.
- When asked for a card or storyline — outline they can act on immediately.
- Use ALL CAPS sparingly for show names, PPV names, and championship titles only.
- Plain text only. No markdown, no asterisks, no emojis, no hashtags.
- Reference the player's roster and rivalries only when they are relevant to what was asked.`;

function rivalryContextBlock(ctx: {
  title: string;
  sides: string[];
  recentEntries: { kind: string; summary: string; universeDate?: string }[];
}): string {
  const sides = ctx.sides.join(" vs ");
  const lines = ctx.recentEntries.slice(0, 10).map((e) => {
    const when = e.universeDate ? ` (${e.universeDate})` : "";
    return `- [${e.kind}]${when} ${e.summary}`;
  });
  return `RIVALRY IN FOCUS: ${ctx.title}\nSides: ${sides}\nRecent history (newest first):\n${lines.join("\n")}`;
}

router.post("/booker/chapter-suggest", async (req: Request, res: Response) => {
  try {
    const body = SuggestChapterBody.parse(req.body ?? {});
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

${rivalryContextBlock(body.rivalryContext)}

Propose ONE new CHAPTER for this rivalry. A chapter is a named arc inside the feud — a phase of the story that has its own focus and ending. Look at the recent history and the active memories to decide what should come next.

Return JSON with this exact shape:

{
  "title": "<short ALL CAPS chapter title, max 6 words, e.g. THE BETRAYAL or RECKONING IN ATLANTA>",
  "description": "<2-3 short sentences describing what this chapter is about and how it advances the rivalry. Sentence case. No stage directions.>",
  "suggestedStartDate": { "month": <1-12>, "week": <1-4>, "day": <0-6> },
  "suggestedEndDate": { "month": <1-12>, "week": <1-4>, "day": <0-6> }
}

Rules:
- If a CURRENT DATE is provided, suggestedStartDate MUST be on or after it. If absent, default to month 1 week 1 day 0.
- suggestedEndDate is optional but if included must be after suggestedStartDate. Aim for 2-6 weeks of story.
- Pick the next logical phase. Do not repeat what's already in the recent history.`,
      },
    ], 256);
    const validated = SuggestChapterResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "chapter suggest failed", "CREATIVE OVERRULED");
  }
});

router.post("/booker/memory-distill", async (req: Request, res: Response) => {
  try {
    const body = DistillMemoriesBody.parse(req.body ?? {});
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

${rivalryContextBlock(body.rivalryContext)}

Read the recent history of this rivalry and distill the DEFINING MOMENTS into short, durable memories. A memory is a one-sentence beat the player will want to remember a year from now — a betrayal, a finish, a cost, a turning point. Skip filler.

Return JSON with this exact shape:

{
  "memories": [
    { "text": "<one sentence, max 200 characters, sentence case, no stage directions>", "date": { "month": <1-12>, "week": <1-4>, "day": <0-6> } }
  ]
}

Rules:
- Return between 1 and 5 memories. Quality over quantity.
- "date" must be the in-universe date the moment happened. Use the dates from the recent history when available; otherwise infer from CURRENT DATE.
- Do NOT restate generic context. Each memory must describe a specific event or turn.`,
      },
    ], 768);
    const validated = DistillMemoriesResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "memory distill failed", "CREATIVE OVERRULED");
  }
});

router.post("/booker/chat", async (req: Request, res: Response) => {
  try {
    const body = BookerChatBody.parse(req.body ?? {});

    const slimBody = {
      ...body,
      roster: body.roster && body.roster.length > 30
        ? [
            ...body.roster.filter(w => w.brand && w.brand !== "FREE_AGENT").slice(0, 24),
            ...body.roster.filter(w => !w.brand || w.brand === "FREE_AGENT").slice(0, 6),
          ].slice(0, 30)
        : body.roster,
    };

    const context = buildContext({ ...slimBody, recentResults: extractRecentResults(req.body) });

    const messages: OpenAIMessage[] = [
      { role: "system", content: CHAT_SYSTEM_PROMPT },
      { role: "system", content: context },
      ...(body.sessionSummary
        ? [
            {
              role: "system" as const,
              content: `CONVERSATION MEMORY (compressed earlier messages):\n${body.sessionSummary}`,
            },
          ]
        : []),
      ...body.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];
    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 1024,
      messages,
    });
    const message = response.choices[0]?.message?.content ?? "";
    const usage: TokenUsage | null = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;
    const validated = BookerChatResponse.parse({ message });
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "booker chat failed", "CREATIVE OVERRULED");
  }
});

const SUMMARIZE_SYSTEM_PROMPT = `You are a context-compression assistant for a WWE 2K Universe Mode booking app. Your only job is to compress older chat messages into a short memory block.

Rules:
- Output a single plain-text paragraph, no lists, no headers, no markdown.
- Maximum 150 tokens.
- Keep only: booking decisions made, feuds discussed, match outcomes agreed on, wrestlers mentioned by name, story directions chosen.
- Drop all small talk, greetings, affirmations, vague questions, or anything not specific to the universe.
- Write in past tense. Be dense and factual. No filler words.`;

router.post("/booker/summarize-chat", async (req: Request, res: Response) => {
  try {
    const body = SummarizeChatBody.parse(req.body ?? {});
    if (!body.messages || body.messages.length === 0) {
      return res.json(SummarizeChatResponse.parse({ summary: "" }));
    }

    const transcript = body.messages
      .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 200,
      messages: [
        { role: "system", content: SUMMARIZE_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Compress the following chat messages into a short memory block:\n\n${transcript}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content?.trim() ?? "";
    const usage: TokenUsage | null = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;
    const validated = SummarizeChatResponse.parse({ summary });
    return res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "chat summarize failed", "MEMORY LOST");
    return;
  }
});

const ISSUE_SYSTEM_PROMPT = `You are the editor-in-chief of a Russo-era wrestling magazine — think WWF Magazine 2000, RAW Magazine 2001. Your job is to write a complete weekly issue that reacts to the user's WWE 2K Universe Mode like real wrestling media would.

VOICE & TONE — strict:
- Russo-era WWF Magazine: edgy, irreverent, slightly tabloid, willing to imply backstage drama
- Use kayfabe — treat wrestlers as real people with real conflicts
- Use phrases like "sources close to" / "according to backstage chatter" / "what they don't want you to know"
- Headlines are PUNCHY and ALL CAPS, max 6 words on the cover
- Pull quotes are dramatic and quotable
- The dirt-sheet section reads like a backstage rumor mill
- Avoid corporate-WWE-website tone. Avoid generic recap voice.

DO NOT:
- Use emojis anywhere
- Reference real-life scandals, divorces, deaths, or out-of-character details about real wrestlers
- Repeat content across features — each feature should hit a different angle
- Use the word "fans" generically — instead use "the WWE Universe", "smart fans", "longtime viewers"

WHAT TO COVER (in order of priority):
1. Most recent night notes (recentEvents) — these aired on TV, treat as canon
2. Active rivalries' memories — long-term arcs to thread through
3. Upcoming PPVs (upcomingEvents) — build hype toward them
4. The chairman's booking style — let it color the editorial tone

STRUCTURE — return JSON matching the schema:
- 1 cover with primary headline, 2-3 teasers, optional burst sticker
- Features array of 4-6 items: 1 "lead" (the cover story, longest), 1-3 "feature" (mid-card pieces), 1 "dirtsheet" (backstage rumors column with bulleted items in the body), 1 "whatsnext" (closer teasing the next week)
- Each feature: headline, optional dek, optional byline, body (150-400 words), optional pullQuote, optional featuredWrestlerName
- Cover colors rotate — pick the one that fits the issue's mood: RED (rage/conflict), BLUE (mystery/cool), YELLOW (chaos/news), BLACK (heel-dominant, ominous)

Return valid JSON only. Do not wrap in markdown code blocks.`;

const RUMOR_SYSTEM_PROMPT = `You are a wrestling dirt-sheet writer in the Russo era. Generate ONE punchy rumor item that fits the user's universe context.

A rumor item is:
- One headline, ALL CAPS, 4-8 words
- 1-3 paragraphs of body text — speculative, attributed to anonymous sources
- A fake source attribution like "Anonymous Backstage Source", "Locker Room Insider", "A Frequent Visitor to Titan Towers"

The rumor should feel:
- Slightly scandalous but kayfabe-friendly
- Connected to real wrestlers in the user's roster
- Tied to ongoing rivalries when possible
- The kind of thing that gets fans buzzing online

Examples of good rumor types:
- Backstage tensions between two wrestlers in the same faction
- A surprise champion changeover being teased
- A wrestler considering a heel/face turn
- A returning star spotted at TV tapings
- A power play within a stable

DO NOT:
- Reference real-life out-of-character scandals
- Use emojis
- Reference wrestlers not in the roster
- Sound like a corporate press release

Return valid JSON. Do not wrap in markdown code blocks.`;

router.post("/booker/issue", async (req: Request, res: Response) => {
  try {
    const body = GenerateIssueBody.parse(req.body ?? {});
    const issueNumber = body.issueNumber;
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: ISSUE_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

You are writing ISSUE #${issueNumber} of the magazine. Return JSON with this exact shape:

{
  "cover": {
    "masthead": "<magazine name in ALL CAPS, vary across issues — e.g. GORILLA POSITION, RAW MAG, WRESTLE WEEKLY, RING REPORT>",
    "primaryHeadline": "<cover headline ALL CAPS, max 6 words, dramatic Russo-tone>",
    "primarySubhead": "<optional second line, ALL CAPS or sentence case>",
    "featuredWrestlerName": "<exact name from the roster — the wrestler whose photo carries the cover>",
    "teasers": [
      { "headline": "<short ALL CAPS teaser>", "dek": "<one-line elaboration>", "featureIndex": <0-based index into features that this teaser maps to> }
    ],
    "burstSticker": "<short punchy text for the yellow burst sticker, 2-5 words>",
    "coverColor": "RED" | "BLUE" | "YELLOW" | "BLACK",
    "suggestedRivalryHint": { "matchupGuess": "<NAME A vs NAME B in ALL CAPS, or empty string if no clear two-side feud carries this issue>", "confidence": "high" | "medium" | "low" }
  },
  "features": [
    {
      "kind": "lead" | "feature" | "dirtsheet" | "whatsnext",
      "headline": "<ALL CAPS headline>",
      "dek": "<optional sub-headline>",
      "byline": "<fake reporter name or 'Anonymous Sources'>",
      "body": "<150-400 words of magazine prose>",
      "pullQuote": "<one quotable line for the pull quote treatment>",
      "featuredWrestlerName": "<exact roster name for inset photo, optional>"
    }
  ]
}

Hard rules:
- 4-6 features total: exactly 1 "lead", 1-3 "feature", exactly 1 "dirtsheet", exactly 1 "whatsnext".
- The "dirtsheet" body should be 4-6 short bulleted items (use a leading dash "- " for each, NO emojis), each 1-3 sentences, snide insider tone.
- The "whatsnext" body should be 2-3 short paragraphs teasing the next week or upcoming PPV. Reference upcomingEvents by name when you can.
- Teasers: 2-3 entries. Each "featureIndex" must point to a non-lead feature in the features array.
- Pick a coverColor that fits the issue mood: RED rage/conflict, BLUE mystery/cool, YELLOW chaos/news, BLACK heel-dominant ominous.
- Every "featuredWrestlerName" MUST be an exact name from the provided roster. If the roster is empty, omit the field.
- "suggestedRivalryHint": Identify which active rivalry this issue is built around so the user can file the cover to it. Use "high" only when one feud unambiguously carries the cover. Use "low" with an empty matchupGuess if it's a multi-angle issue with no clear two-side feud.
- Never use emojis. Never use markdown code fences. Output JSON only.`,
      },
    ], 4096);
    const validated = GenerateIssueResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "issue generation failed", "PRINTING DELAYED");
  }
});

router.post("/booker/rumor", async (req: Request, res: Response) => {
  try {
    const body = GenerateRumorBody.parse(req.body ?? {});
    const { data, usage } = await callOpenAIJson([
      { role: "system", content: RUMOR_SYSTEM_PROMPT },
      {
        role: "user",
        content: `${buildContext({ ...body, recentResults: extractRecentResults(req.body) })}

Generate ONE rumor item. Return JSON with this exact shape:
{
  "headline": "<ALL CAPS, 4-8 words, punchy>",
  "body": "<1-3 short paragraphs of dirt-sheet prose, sentence case, attributed to anonymous sources>",
  "fakeSource": "<source attribution like 'Anonymous Backstage Source', 'Locker Room Insider', 'A Frequent Visitor to Titan Towers'>"
}

Rules:
- Reference real wrestlers from the roster only.
- Tie into the most recent events or active rivalry memories when possible.
- No emojis. No markdown. Return only JSON.`,
      },
    ], 512);
    const validated = GenerateRumorResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "rumor generation failed", "SOURCES WENT QUIET");
  }
});

const CHAPTER_TYPES = ["BEGINNING", "ESCALATION", "TURNING POINT", "FALLOUT", "BLOWOFF"] as const;

const LABEL_ENTRY_SYSTEM_PROMPT = `You are a WWE creative team analyst. Your only job is to assign one chapter type label to a single rivalry entry based on where it fits in the feud's narrative arc.

Available chapter types (in natural narrative order):
- BEGINNING: First encounter, issue established, challenge issued. Feud just started.
- ESCALATION: Stakes raised, attacks, interference, promo battles, rematch clause used.
- TURNING POINT: A betrayal, major heel/face turn, stipulation added, unexpected result that redefines the feud.
- FALLOUT: Aftermath of a major moment. Fallout promos, injuries sold, crowd reactions, next steps negotiated.
- BLOWOFF: The final match or definitive resolution of this program.

Rules:
- Read the existing labels list provided. Do not repeat BLOWOFF or BEGINNING unless justified.
- If the feud already has a TURNING POINT, later entries should lean FALLOUT or BLOWOFF.
- Return ONLY valid JSON matching the schema. No prose, no markdown.

Output schema:
{
  "chapterType": "BEGINNING" | "ESCALATION" | "TURNING POINT" | "FALLOUT" | "BLOWOFF",
  "rationale": "<one sentence, plain English>"
}`;

router.post("/booker/label-entry", async (req: Request, res: Response) => {
  try {
    const body = LabelEntryBody.parse(req.body ?? {});
    const sidesStr = body.rivalryContext.sides?.join(" VS ") ?? "Unknown rivalry";
    const existingStr = body.existingLabels && body.existingLabels.length > 0
      ? `Existing chapter labels so far (chronological): ${body.existingLabels.join(", ")}`
      : "No entries have been labeled yet. This may be the first.";

    const userMsg = [
      `Rivalry: ${body.rivalryContext.title ?? sidesStr}`,
      existingStr,
      `Entry to label:`,
      `  Kind: ${body.entryKind}`,
      `  Summary: ${body.entrySummary}`,
      body.entryDate ? `  Universe Date: ${body.entryDate}` : "",
    ].filter(Boolean).join("\n");

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 64,
      messages: [
        { role: "system", content: LABEL_ENTRY_SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const usage: TokenUsage | null = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;
    const data = parseModelJson(raw) as Record<string, unknown>;
    if (!(CHAPTER_TYPES as readonly string[]).includes(data.chapterType as string)) {
      data.chapterType = "ESCALATION";
    }
    const validated = LabelEntryResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "label entry failed", "CREATIVE OVERRULED");
  }
});

const BLOWOFF_SCORE_SYSTEM_PROMPT = `You are a WWE creative veteran assessing whether a rivalry is ready for its blowoff match.

Scoring guide:
- 0-20: Just started. No escalation yet.
- 21-45: Building but missing a turning point or payoff.
- 46-65: Good heat, needs one more beat.
- 66-85: Ready. The feud has earned a blowoff.
- 86-100: Overdue. They should have blown off already.

Rules:
- Score based only on the rivalry context provided: entry count, kinds, and the arc they suggest.
- Be direct and kayfabe. No emojis. No markdown.
- Return ONLY valid JSON.

Output schema:
{
  "score": <integer 0-100>,
  "rationale": "<1-2 sentences, plain English, kayfabe voice>"
}`;

router.post("/booker/blowoff-score", async (req: Request, res: Response) => {
  try {
    const body = BlowoffScoreBody.parse(req.body ?? {});

    const context = buildContext({ ...body, recentResults: extractRecentResults(req.body) });
    const rivalryStr = body.rivalryContext
      ? [
          `Rivalry: ${body.rivalryContext.title ?? (body.rivalryContext.sides?.join(" VS ") ?? "Unknown")}`,
          `Sides: ${body.rivalryContext.sides?.join(", ") ?? "Unknown"}`,
          `Entries (${body.rivalryContext.recentEntries?.length ?? 0}):`,
          ...(body.rivalryContext.recentEntries ?? []).map(
            (e: { kind: string; summary: string; universeDate?: string }) =>
              `  [${e.kind.toUpperCase()}] ${e.summary}${e.universeDate ? ` (${e.universeDate})` : ""}`
          ),
        ].join("\n")
      : "No rivalry context provided.";

    const response = await openai.chat.completions.create({
      model: "gpt-5.4",
      max_completion_tokens: 120,
      messages: [
        { role: "system", content: BLOWOFF_SCORE_SYSTEM_PROMPT },
        { role: "system", content: context },
        { role: "user", content: `Score this rivalry's blowoff readiness:\n\n${rivalryStr}` },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const usage: TokenUsage | null = response.usage
      ? {
          promptTokens: response.usage.prompt_tokens,
          completionTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        }
      : null;
    const data = parseModelJson(raw) as Record<string, unknown>;
    data.score = Math.max(0, Math.min(100, Number(data.score) || 0));
    const validated = BlowoffScoreResponse.parse(data);
    res.json({ ...validated, _usage: usage });
  } catch (err) {
    sendBookerError(req, res, err, "blowoff score failed", "CREATIVE OVERRULED");
  }
});

export default router;
