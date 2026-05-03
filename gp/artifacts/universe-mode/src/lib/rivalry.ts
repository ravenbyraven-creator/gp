import type { Wrestler } from "@workspace/api-client-react";
import type { UniverseDate } from "./calendar";
import type { RivalryEntry } from "./storage";

export type RivalrySide = {
  id: string;
  label?: string;
  wrestlerIds: string[];
};

export type Rivalry = {
  id: string;
  title?: string;
  sides: RivalrySide[];
  status: "ACTIVE" | "CONCLUDED";
  createdDate: UniverseDate;
  concludedDate?: UniverseDate;
  lastActivityDate: UniverseDate;
  historyEntryIds: string[];
};

export type Chapter = {
  id: string;
  rivalryId: string;
  title: string;
  startDate: UniverseDate;
  endDate?: UniverseDate;
  description?: string;
  order: number;
};

export type Memory = {
  id: string;
  rivalryId: string;
  text: string;
  date: UniverseDate;
  source: "ai" | "manual";
};

export function lookupWrestlers(
  ids: string[],
  roster: Wrestler[],
): Wrestler[] {
  const byId = new Map(roster.map((w) => [w.id, w]));
  return ids.map((id) => byId.get(id)).filter((w): w is Wrestler => Boolean(w));
}

export function sideLabel(
  side: RivalrySide,
  roster: Wrestler[],
): string {
  const trimmedLabel = side.label?.trim();
  if (trimmedLabel) return trimmedLabel.toUpperCase();
  const wrestlers = lookupWrestlers(side.wrestlerIds, roster);
  if (wrestlers.length === 0) return "—";
  return wrestlers.map((w) => w.name).join(" & ").toUpperCase();
}

export function rivalryDisplayTitle(
  rivalry: Rivalry,
  roster: Wrestler[],
): string {
  const t = rivalry.title?.trim();
  if (t) return t.toUpperCase();
  return rivalryMatchupPlain(rivalry, roster);
}

export function rivalryMatchupPlain(
  rivalry: Rivalry,
  roster: Wrestler[],
): string {
  const [a, b] = rivalry.sides;
  if (!a || !b) return "—";
  return `${sideLabel(a, roster)} VS ${sideLabel(b, roster)}`;
}

/**
 * All wrestler ids from all sides, in order, deduplicated.
 */
export function allWrestlerIds(rivalry: Rivalry): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const side of rivalry.sides) {
    for (const id of side.wrestlerIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Best-effort participant names extracted from a history entry, used to
 * pre-populate the create-rivalry dialog when filing from Quick Book.
 */
export function entryParticipantNames(entry: RivalryEntry): string[] {
  if (entry.kind === "storyline") return entry.data.participants ?? [];
  if (entry.kind === "promo") return [entry.data.wrestlerName];
  if (entry.kind === "magazine") return [];
  return [];
}

/**
 * Resolve free-text names into roster wrestler ids by case-insensitive
 * exact match. Names that don't match are dropped.
 */
export function resolveNamesToIds(
  names: string[],
  roster: Wrestler[],
): string[] {
  const byNorm = new Map(
    roster.map((w) => [w.name.trim().toLowerCase(), w.id]),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    const id = byNorm.get(n.trim().toLowerCase());
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Split N wrestler ids into two sides for the prefilled create dialog.
 * - 0 → both empty
 * - 1 → side A gets one, side B empty
 * - 2 → 1 vs 1
 * - >2 → first half vs second half
 */
export function splitIntoSides(ids: string[]): [string[], string[]] {
  if (ids.length === 0) return [[], []];
  if (ids.length === 1) return [[ids[0]], []];
  if (ids.length === 2) return [[ids[0]], [ids[1]]];
  const half = Math.ceil(ids.length / 2);
  return [ids.slice(0, half), ids.slice(half)];
}

/**
 * Compare two universe dates as integers (treating them as the same year
 * when year is missing). Returns positive if a > b.
 */
export function compareDate(a: UniverseDate, b: UniverseDate): number {
  const ay = a.year ?? 0;
  const by = b.year ?? 0;
  if (ay !== by) return ay - by;
  if (a.month !== b.month) return a.month - b.month;
  if (a.week !== b.week) return a.week - b.week;
  return a.day - b.day;
}
