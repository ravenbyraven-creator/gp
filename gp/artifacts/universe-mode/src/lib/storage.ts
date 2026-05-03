import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { StorylineScene, ShowCard, SurpriseScene, PromoScript, Wrestler, ChairmanProfile, BookerChatMessage, Show } from "@workspace/api-client-react";
import { SEED_SHOWS } from "./seedShows";
import { SEED_ROSTER } from "./seedRoster";
import {
  DEFAULT_UNIVERSE_DATE,
  upcomingEvents as sortUpcoming,
  weeksUntil,
  type UniverseDate,
  type PremiumEvent,
} from "./calendar";
import type { Rivalry, Chapter, Memory } from "./rivalry";
import { rivalryDisplayTitle } from "./rivalry";
import { compareDate } from "./rivalry";
import type { Issue } from "./news";

export type MagazineRivalryEntryData = {
  issueId: string;
  issueNumber: number;
  coverHeadline: string;
  coverFeaturedWrestlerId?: string;
};

export type ChapterType =
  | "BEGINNING"
  | "ESCALATION"
  | "TURNING POINT"
  | "FALLOUT"
  | "BLOWOFF";

export const CHAPTER_TYPES: ChapterType[] = [
  "BEGINNING",
  "ESCALATION",
  "TURNING POINT",
  "FALLOUT",
  "BLOWOFF",
];

export type ShowResultsEntryData = {
  showId?: string;
  showName?: string;
  showImageUrl?: string;
  matches: import("./matches").MatchResult[];
  matchStars?: number;
  crowdStars?: number;
  notes?: string;
};

export type ShowDraftMatch = {
  id: string;
  slot: string;
  match: string;
  plannedResult: string;
  plannedTwist: string;
  logged: boolean;
  actualWinnerSideId?: "a" | "b";
  actualOutcome?: import("./matches").MatchOutcome;
  actualFinish?: string;
  actualNotes?: string;
  stars?: number;
  titleChanged?: boolean;
};

export type ShowDraft = {
  id: string;
  showName: string;
  showId?: string;
  showImageUrl?: string;
  universeDate: UniverseDate;
  createdAt: number;
  status: "pending" | "complete";
  matches: ShowDraftMatch[];
  resultEntryId?: string;
};

export type RivalryEntry =
  | { kind: "storyline"; id: string; createdAt: number; universeDate?: UniverseDate; data: StorylineScene; chapter?: ChapterType; pinned?: boolean }
  | { kind: "show"; id: string; createdAt: number; universeDate?: UniverseDate; data: ShowCard; chapter?: ChapterType; pinned?: boolean }
  | { kind: "surprise"; id: string; createdAt: number; universeDate?: UniverseDate; data: SurpriseScene; chapter?: ChapterType; pinned?: boolean }
  | { kind: "promo"; id: string; createdAt: number; universeDate?: UniverseDate; data: PromoScript; chapter?: ChapterType; pinned?: boolean }
  | { kind: "log"; id: string; createdAt: number; universeDate?: UniverseDate; text: string; chapter?: ChapterType; pinned?: boolean }
  | { kind: "magazine"; id: string; createdAt: number; universeDate?: UniverseDate; data: MagazineRivalryEntryData; chapter?: ChapterType; pinned?: boolean }
  | { kind: "results"; id: string; createdAt: number; universeDate?: UniverseDate; data: ShowResultsEntryData; chapter?: ChapterType; pinned?: boolean };

const LOCAL_STORAGE_EVENT = "umc.localstorage";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  useEffect(() => {
    const sync = (e: Event) => {
      const detailKey =
        e instanceof CustomEvent
          ? (e.detail as string | undefined)
          : (e as StorageEvent).key;
      if (detailKey && detailKey !== key) return;
      try {
        const item = window.localStorage.getItem(key);
        setStoredValue(item ? JSON.parse(item) : initialValue);
      } catch (error) {
        console.error(error);
      }
    };
    window.addEventListener("storage", sync);
    window.addEventListener(LOCAL_STORAGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(LOCAL_STORAGE_EVENT, sync);
    };
  }, [key]);

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = (() => {
        if (value instanceof Function) {
          // B-01 fix: read fresh from storage instead of using the stale
          // render-closure value. This prevents data loss when two components
          // write to the same key in rapid succession (e.g. inbox generation
          // and date advance firing at the same time).
          try {
            const raw = window.localStorage.getItem(key);
            const fresh: T = raw ? JSON.parse(raw) : initialValue;
            return value(fresh);
          } catch {
            return value(storedValue);
          }
        }
        return value;
      })();
      setStoredValue(valueToStore);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
        window.dispatchEvent(
          new CustomEvent(LOCAL_STORAGE_EVENT, { detail: key }),
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
}

export function useRoster() {
  const tuple = useLocalStorage<Wrestler[]>("umc.roster", []);
  const [roster, setRoster] = tuple;
  const migrated = useRef(false);

  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    if (roster.length === 0) return;
    const needsIdMigration = roster.some((w) => !w.id);

    // Photo back-fill is gated by a version number so we can re-run it when
    // new wrestlers gain bundled photos in the seed. Bump CURRENT_PHOTO_VERSION
    // whenever new imageUrl entries are added to seedRoster.
    const CURRENT_PHOTO_VERSION = 2;
    let storedPhotoVersion = 0;
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem("umc.rosterPhotosMigratedVersion");
      if (raw) {
        const n = Number(raw);
        if (!Number.isNaN(n)) storedPhotoVersion = n;
      } else if (window.localStorage.getItem("umc.rosterPhotosMigrated") === "true") {
        // Legacy v1 flag from the initial back-fill.
        storedPhotoVersion = 1;
      }
    }
    const needsPhotoMigration = storedPhotoVersion < CURRENT_PHOTO_VERSION;
    if (!needsIdMigration && !needsPhotoMigration) return;

    if (needsPhotoMigration) {
      const seedByName = new Map<string, Wrestler>();
      for (const s of SEED_ROSTER) {
        seedByName.set(s.name.toLowerCase(), s);
      }
      setRoster((prev) =>
        prev.map((w) => {
          const next: Wrestler = w.id ? w : { ...w, id: crypto.randomUUID() };
          // Photo migration: only fill in if the user hasn't set one
          if (!next.imageUrl) {
            const seed = seedByName.get(next.name.toLowerCase());
            if (seed?.imageUrl) {
              return { ...next, imageUrl: seed.imageUrl };
            }
          }
          return next;
        }),
      );
      try {
        window.localStorage.setItem(
          "umc.rosterPhotosMigratedVersion",
          String(CURRENT_PHOTO_VERSION),
        );
        window.localStorage.setItem("umc.rosterPhotosMigrated", "true");
      } catch (error) {
        console.error(error);
      }
    } else if (needsIdMigration) {
      setRoster((prev) =>
        prev.map((w) => (w.id ? w : { ...w, id: crypto.randomUUID() })),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return tuple;
}

export function useShows() {
  return useLocalStorage<Show[]>("umc.shows", SEED_SHOWS);
}

export function useChairman() {
  return useLocalStorage<ChairmanProfile | null>("umc.chairman", null);
}

// P-01 fix: cap history at this many entries so localStorage never grows
// unbounded. Enforced in the setter so every write site gets it for free.
const MAX_HISTORY_ENTRIES = 500;

export function useHistory() {
  const [history, setHistoryRaw] = useLocalStorage<RivalryEntry[]>("umc.history", []);
  const setHistory = useCallback(
    (value: RivalryEntry[] | ((prev: RivalryEntry[]) => RivalryEntry[])) => {
      setHistoryRaw(prev => {
        const next = value instanceof Function ? value(prev) : value;
        return next.length > MAX_HISTORY_ENTRIES ? next.slice(0, MAX_HISTORY_ENTRIES) : next;
      });
    },
    [setHistoryRaw],
  );
  return [history, setHistory] as const;
}

export function useChat() {
  return useLocalStorage<BookerChatMessage[]>("umc.chat", []);
}

// ── Chat sessions (multi-thread) ──────────────────────────────────────────
export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: BookerChatMessage[];
  /** Compressed memory of all archived messages. Passed to the AI as context. */
  summary?: string;
  /** How many messages from the start of `messages` are already covered by `summary`. */
  archivedCount?: number;
};

export function useChatSessions() {
  return useLocalStorage<ChatSession[]>("umc.chatSessions", []);
}

export function useActiveChatSessionId() {
  return useLocalStorage<string | null>("umc.activeChatSessionId", null);
}

export function useTheme() {
  return useLocalStorage<"dark" | "light">("umc.theme", "dark");
}

export function useFont() {
  return useLocalStorage<string>("umc.font", "default");
}

export function useGettingStartedDismissed() {
  return useLocalStorage<boolean>("umc.gettingStartedDismissed", false);
}

export function useUniverseDate() {
  return useLocalStorage<UniverseDate>("umc.universeDate", DEFAULT_UNIVERSE_DATE);
}

export function useEvents() {
  return useLocalStorage<PremiumEvent[]>("umc.events", []);
}

/**
 * Last universe date (pre-advance) used to power the UNDO affordance.
 * Cleared automatically by the consumer after 8 seconds.
 */
export function useLastUniverseDate() {
  return useLocalStorage<UniverseDate | null>("umc.lastUniverseDate", null);
}

export function useRivalries() {
  return useLocalStorage<Rivalry[]>("umc.rivalries", []);
}

export function useChapters() {
  return useLocalStorage<Chapter[]>("umc.chapters", []);
}

export function useMemories() {
  return useLocalStorage<Memory[]>("umc.memories", []);
}

export interface Championship {
  id: string;
  name: string;
  brand?: "RAW" | "SMACKDOWN" | "NXT" | "FREE_AGENT";
  division?: "MENS" | "WOMENS" | "TAG";
  currentChampionIds?: string[];
  active?: boolean;
  imageUrl?: string;
  notes?: string;
}

export interface Stable {
  id: string;
  name: string;
  memberIds?: string[];
  leaderId?: string;
  managerId?: string;
  brand?: "RAW" | "SMACKDOWN" | "NXT" | "FREE_AGENT";
  alignment?: "FACE" | "HEEL" | "TWEENER";
  status?: "ACTIVE" | "INACTIVE" | "DISBANDED";
  logoUrl?: string;
  notes?: string;
}

export function useChampionships() {
  return useLocalStorage<Championship[]>("umc.championships", []);
}

export function useStables() {
  return useLocalStorage<Stable[]>("umc.stables", []);
}

export interface TitleReign {
  id: string;
  championshipId: string;
  wrestlerId?: string;
  wrestlerName: string;
  wonDate: UniverseDate;
  lostDate?: UniverseDate;
  wonFrom?: string;
  lostTo?: string;
  howWon?: string;
  howLost?: string;
  eventName?: string;
  linkedRivalryId?: string;
  linkedHistoryEntryId?: string;
  notes?: string;
}

export function useTitleReigns() {
  return useLocalStorage<TitleReign[]>("umc.titleReigns", []);
}

export function useMatchResults() {
  return useLocalStorage<import("./matches").MatchResult[]>("umc.matchResults", []);
}

export function useShowDrafts() {
  return useLocalStorage<ShowDraft[]>("umc.showDrafts", []);
}


export function useContenderQueues() {
  return useLocalStorage<Record<string, string[]>>("umc.contenderQueues", {});
}

export function useFeuArcMilestones() {
  return useLocalStorage<Record<string, string[]>>("umc.feudArcMilestones", {});
}

export function useAutoMagazine() {
  return useLocalStorage<boolean>("umc.autoMagazine", true);
}

/**
 * Which month the season starts on (1=Jan … 12=Dec). Default 1.
 * Drives the CalendarView season-lock and the Advance season gate.
 */
export function useSeasonStart() {
  return useLocalStorage<number>("umc.seasonStart", 1);
}

/**
 * Freeform text the user writes as permanent canon constraints.
 * Injected into every AI call as a hard-rule block.
 */
export function useUniverseBible() {
  return useLocalStorage<string>("umc.universeBible", "");
}

export type SeasonChronicle = {
  /** Universe year the season covered (0-indexed, same as UniverseDate.year). */
  seasonYear: number;
  /** AI-generated prose summary of the season. */
  summary: string;
  /** Real-world timestamp of generation. */
  generatedAt: number;
};

/**
 * One entry per completed season, auto-generated when "Start New Season" fires.
 * Injected into AI calls as a PREVIOUS SEASONS block.
 */
export function useSeasonChronicles() {
  return useLocalStorage<SeasonChronicle[]>("umc.seasonChronicles", []);
}

export const APP_STORAGE_KEYS: string[] = [
  "umc.roster",
  "umc.shows",
  "umc.chairman",
  "umc.history",
  "umc.chat",
  "umc.chatSessions",
  "umc.activeChatSessionId",
  "umc.theme",
  "umc.font",
  "umc.gettingStartedDismissed",
  "umc.universeDate",
  "umc.events",
  "umc.lastUniverseDate",
  "umc.rivalries",
  "umc.chapters",
  "umc.contenderQueues",
  "umc.feudArcMilestones",
  "umc.memories",
  "umc.championships",
  "umc.stables",
  "umc.titleReigns",
  "umc.issues",
  "umc.rumors",
  "umc.newsPhotoOverrides",
  "umc.inboxReadIds",
  "umc.rosterPhotosMigratedVersion",
  "umc.rosterPhotosMigrated",
  "umc.matchResults",
  "umc.showDrafts",
  "umc.tokenLog",
  "umc.autoMagazine",
  "umc.inboxGenerated",
  "umc.inboxArchivedIds",
  "umc.inboxDeletedIds",
  "umc.inboxStarredIds",
  "umc.inboxLastFire",
  "umc.inboxReplies",
  "umc.seasonStart",
  "umc.universeBible",
  "umc.seasonChronicles",
];

export function useChampionLookup(): Map<string, Championship[]> {
  const [championships] = useChampionships();
  return useMemo(() => {
    const map = new Map<string, Championship[]>();
    for (const c of championships) {
      if (c.active === false) continue;
      for (const id of c.currentChampionIds ?? []) {
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(c);
      }
    }
    return map;
  }, [championships]);
}

const NOTES_MAX = 200;

function truncateNotes(text: string | undefined): string | undefined {
  if (!text) return text;
  return text.length > NOTES_MAX ? text.slice(0, NOTES_MAX) + "..." : text;
}

export function buildBookerContext(
  roster: Wrestler[],
  chairman: ChairmanProfile | null,
  history: RivalryEntry[],
  shows: Show[] = [],
  currentDate?: UniverseDate,
  events: PremiumEvent[] = [],
  rivalries: Rivalry[] = [],
  memories: Memory[] = [],
  issues: Issue[] = [],
  championships: Championship[] = [],
  stables: Stable[] = [],
  maxRoster?: number,
  universeBible?: string,
  seasonChronicles: SeasonChronicle[] = [],
) {
  const lightShows: Show[] = shows.map(s => ({
    id: s.id,
    name: s.name,
    vibe: s.vibe,
    night: s.night,
  }));

  const rivalryHistory = history.filter(
    h => h.kind === "storyline" || h.kind === "show" || h.kind === "surprise"
  );

  // Phase 4: Build active participant name set for relevance-based history scoring
  const activeParticipantNames = new Set<string>();
  for (const r of rivalries) {
    if (r.status !== "ACTIVE") continue;
    for (const side of r.sides) {
      for (const wId of side.wrestlerIds) {
        const name = roster.find(w => w.id === wId)?.name;
        if (name) activeParticipantNames.add(name.toLowerCase());
      }
    }
  }

  const scoreHistoryEntry = (h: RivalryEntry): number => {
    let score = 0;
    if (h.kind === "storyline") {
      for (const p of h.data.participants) {
        if (activeParticipantNames.has(p.toLowerCase())) score += 3;
      }
    } else if (h.kind === "show") {
      for (const m of h.data.matches) {
        for (const part of m.match.split(/\s+vs\s+/i)) {
          if (activeParticipantNames.has(part.trim().toLowerCase())) score += 1;
        }
      }
    } else if (h.kind === "surprise") {
      score += 1;
    }
    return score;
  };

  const deriveFromHistory = () => {
    const scored = rivalryHistory.map((h, idx) => ({ h, score: scoreHistoryEntry(h), idx }));
    scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return scored.slice(0, 8).map(({ h }) => {
      if (h.kind === "storyline") {
        const lastBeat = h.data.beats[h.data.beats.length - 1];
        return {
          title: h.data.feud,
          participants: h.data.participants,
          recentBeats: lastBeat ? [lastBeat.text] : [],
        };
      }
      if (h.kind === "show") {
        const firstMatch = h.data.matches[0];
        return {
          title: h.data.showName,
          participants: [],
          recentBeats: firstMatch ? [`${firstMatch.match} - ${firstMatch.result}`] : [],
        };
      }
      // surprise
      const lastBeat = h.data.beats[h.data.beats.length - 1];
      return {
        title: h.data.headline,
        participants: [],
        recentBeats: lastBeat ? [lastBeat.text] : [],
      };
    });
  };

  // Phase 3: Pinned canon entries — always surfaced to AI regardless of age
  const pinnedCanon = history
    .filter(h => h.pinned)
    .map(h => {
      if (h.kind === "log") return h.text.slice(0, 150);
      if (h.kind === "storyline") return `${h.data.feud}: ${h.data.headline}`;
      if (h.kind === "show") return `${h.data.showName}: ${h.data.headline}`;
      if (h.kind === "surprise") return h.data.headline;
      if (h.kind === "promo") return `${h.data.wrestlerName}: ${h.data.headline}`;
      if (h.kind === "magazine") return h.data.coverHeadline;
      return "";
    })
    .filter(Boolean);

  const recentEvents = history
    .filter((h): h is Extract<RivalryEntry, { kind: "log" }> => h.kind === "log")
    .slice(0, 5)
    .map(h => h.text);

  const upcoming = currentDate
    ? sortUpcoming(events, currentDate)
        .slice(0, 5)
        .map((e) => ({
          name: e.name,
          month: e.month,
          week: e.week,
          day: e.day,
          weeksOut: weeksUntil(e, currentDate),
          notes: e.notes,
        }))
    : [];

  const activeRivalryMemories = (() => {
    if (rivalries.length === 0) return [];
    const historyById = new Map(history.map((h) => [h.id, h]));
    const active = rivalries
      .filter((r) => r.status === "ACTIVE")
      .slice()
      .sort((a, b) => compareDate(b.lastActivityDate, a.lastActivityDate))
      .slice(0, 6);
    if (active.length === 0) return [];
    return active
      .map((r) => {
        const distilled = memories
          .filter((m) => m.rivalryId === r.id)
          .slice()
          .sort((a, b) => compareDate(b.date, a.date))
          .slice(0, 2)
          .map((m) => m.text);

        const linked = (r.historyEntryIds ?? [])
          .map((id) => historyById.get(id))
          .filter((h): h is RivalryEntry => Boolean(h))
          .slice(-5)
          .flatMap((h) => {
            if (h.kind === "log") return [h.text];
            if (h.kind === "storyline") {
              const b = h.data.beats[h.data.beats.length - 1];
              return b ? [b.text] : [];
            }
            if (h.kind === "show") {
              const m = h.data.matches[0];
              return m ? [`${m.match}: ${m.result}`] : [];
            }
            if (h.kind === "surprise") {
              const b = h.data.beats[h.data.beats.length - 1];
              return b ? [b.text] : [];
            }
            return [];
          });

        const beats = [...distilled, ...linked].slice(0, 6);

        // Derive side labels from roster so the AI sees who is on each side
        const sides = r.sides.map((s) => {
          const names = s.wrestlerIds
            .map((id) => roster.find((w) => w.id === id)?.name)
            .filter((n): n is string => Boolean(n));
          return names.length > 0 ? names.join(" & ") : (s.label || "TBD");
        });

        // Include the rivalry even when no beats are filed — AI should know it exists
        return {
          rivalryTitle: rivalryDisplayTitle(r, roster),
          sides,
          beats,
        };
      });
  })();

  const recentMagazineHeadlines = [...issues]
    .sort((a, b) => b.issueNumber - a.issueNumber)
    .slice(0, 3)
    .map((i) => ({
      issueNumber: i.issueNumber,
      coverHeadline: i.cover.primaryHeadline,
      universeDate: i.universeDate
        ? { month: i.universeDate.month, week: i.universeDate.week, day: i.universeDate.day }
        : undefined,
    }));

  // Build a set of names appearing in recent history for activity-based sorting
  const recentNames = new Set<string>();
  for (const h of history.slice(0, 20)) {
    if (h.kind === "storyline") h.data.participants.forEach(n => recentNames.add(n));
    else if (h.kind === "show") h.data.matches.forEach(m => {
      m.match.split(/\s+vs\s+/i).forEach(n => recentNames.add(n.trim()));
    });
    else if (h.kind === "promo") recentNames.add(h.data.wrestlerName);
  }

  const rosterCap = maxRoster ?? 60;

  const sortedRoster = [...roster].sort((a, b) => {
    const aRecent = recentNames.has(a.name) ? 0 : 1;
    const bRecent = recentNames.has(b.name) ? 0 : 1;
    if (aRecent !== bRecent) return aRecent - bRecent;
    const aActive = a.status === "ACTIVE" || !a.status ? 0 : 1;
    const bActive = b.status === "ACTIVE" || !b.status ? 0 : 1;
    return aActive - bActive;
  });

  const cappedRoster = sortedRoster.slice(0, rosterCap);

  const lightRoster = cappedRoster.map(({ imageUrl: _img, ...w }) => ({
    ...w,
    notes: truncateNotes(w.notes),
    creativeNotes: truncateNotes(w.creativeNotes),
  }));

  const lightChampionships = championships.length > 0
    ? championships
        .filter(c => c.active !== false)
        .map(({ imageUrl: _img, ...c }) => ({
          ...c,
          notes: truncateNotes(c.notes),
        }))
    : undefined;

  const lightStables = stables.length > 0
    ? stables
        .filter(s => s.status !== "DISBANDED")
        .map(({ logoUrl: _logo, ...s }) => ({
          ...s,
          notes: truncateNotes(s.notes),
        }))
    : undefined;

  const recentResults = buildRecentResultsContext(history, roster);

  return {
    roster: lightRoster,
    shows: lightShows,
    chairman: chairman || undefined,
    ongoingRivalries: deriveFromHistory(),
    recentEvents,
    currentDate: currentDate
      ? { month: currentDate.month, week: currentDate.week, day: currentDate.day }
      : undefined,
    upcomingEvents: upcoming,
    activeRivalryMemories,
    recentMagazineHeadlines,
    championships: lightChampionships,
    stables: lightStables,
    recentResults: recentResults.length > 0 ? recentResults : undefined,
    universeBible: universeBible && universeBible.trim() ? universeBible.trim() : undefined,
    seasonChronicles: seasonChronicles.length > 0
      ? [...seasonChronicles]
          .sort((a, b) => b.seasonYear - a.seasonYear)
          .slice(0, 3)
          .map(s => ({ seasonYear: s.seasonYear, summary: s.summary }))
      : undefined,
    pinnedCanon: pinnedCanon.length > 0 ? pinnedCanon : undefined,
  };
}

/**
 * Minimal recent match results for AI context — last 5 show-night result entries,
 * each summarised to winner/loser/show/outcome only to keep token cost low.
 */
export function buildRecentResultsContext(
  history: RivalryEntry[],
  roster: Wrestler[],
): Array<{ show: string; matches: Array<{ match: string; winner: string; outcome: string }> }> {
  const byId = new Map(roster.map((w) => [w.id, w.name]));
  const entries = history
    .filter((h): h is Extract<RivalryEntry, { kind: "results" }> => h.kind === "results")
    .slice(0, 5);

  return entries.map((e) => ({
    show: e.data.showName ?? "House Show",
    matches: e.data.matches.map((m) => {
      const sideA = m.sides[0];
      const sideB = m.sides[1];
      const winner = m.winnerSideId
        ? (m.sides.find((s) => s.id === m.winnerSideId)?.wrestlerIds
            .map((id) => byId.get(id) ?? id)
            .join(" & ") ?? "Unknown")
        : "Draw";
      const sideAStr = sideA?.wrestlerIds.map((id) => byId.get(id) ?? sideA.label).join(" & ") ?? "?";
      const sideBStr = sideB?.wrestlerIds.map((id) => byId.get(id) ?? sideB.label).join(" & ") ?? "?";
      return {
        match: `${sideAStr} vs ${sideBStr}`,
        winner,
        outcome: m.outcome,
      };
    }),
  }));
}
