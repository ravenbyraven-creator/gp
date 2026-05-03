import type { UniverseDate } from "./calendar";

export type MatchOutcome =
  | "PIN"
  | "SUBMISSION"
  | "DQ"
  | "COUNTOUT"
  | "NO_CONTEST"
  | "DRAW"
  | "KO"
  | "OTHER";

export interface MatchSide {
  id: string;
  label: string;
  wrestlerIds: string[];
}

export interface MatchResult {
  id: string;
  date: UniverseDate;
  showId?: string;
  showName?: string;
  eventName?: string;
  slot?: string;
  historyEntryId?: string;
  rivalryId?: string;
  sides: MatchSide[];
  winnerSideId?: string;
  outcome: MatchOutcome;
  finish?: string;
  stipulation?: string;
  titleId?: string;
  titleChanged?: boolean;
  stars?: number;
  notes?: string;
}

export interface WrestlerRecord {
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winPct: number;
  currentStreak: { kind: "W" | "L" | "N"; length: number };
  titleMatchWins: number;
  titleMatchLosses: number;
}

function cmpDate(a: UniverseDate, b: UniverseDate): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  if (a.week !== b.week) return a.week - b.week;
  return (a.day ?? 0) - (b.day ?? 0);
}

export function wrestlerMatches(wrestlerId: string, matches: MatchResult[]): MatchResult[] {
  return matches
    .filter((m) => m.sides.some((s) => s.wrestlerIds.includes(wrestlerId)))
    .sort((a, b) => cmpDate(b.date, a.date));
}

export function deriveWrestlerStats(wrestlerId: string, matches: MatchResult[]): WrestlerRecord {
  const relevant = wrestlerMatches(wrestlerId, matches);
  let wins = 0,
    losses = 0,
    draws = 0,
    titleMatchWins = 0,
    titleMatchLosses = 0;

  for (const m of relevant) {
    const isDraw = m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
    if (isDraw) {
      draws++;
      continue;
    }
    const mySide = m.sides.find((s) => s.wrestlerIds.includes(wrestlerId));
    const isWin = Boolean(mySide && mySide.id === m.winnerSideId);
    if (isWin) {
      wins++;
      if (m.titleId) titleMatchWins++;
    } else {
      losses++;
      if (m.titleId) titleMatchLosses++;
    }
  }

  const total = wins + losses + draws;
  const winPct = total > 0 ? wins / total : 0;

  let streakKind: "W" | "L" | "N" = "N";
  let streakLength = 0;
  for (const m of relevant) {
    const isDraw = m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
    if (isDraw) break;
    const mySide = m.sides.find((s) => s.wrestlerIds.includes(wrestlerId));
    const isWin = Boolean(mySide && mySide.id === m.winnerSideId);
    const k: "W" | "L" = isWin ? "W" : "L";
    if (streakLength === 0) {
      streakKind = k;
      streakLength = 1;
    } else if (k === streakKind) {
      streakLength++;
    } else {
      break;
    }
  }

  return {
    wins,
    losses,
    draws,
    total,
    winPct,
    currentStreak: { kind: streakKind, length: streakLength },
    titleMatchWins,
    titleMatchLosses,
  };
}

export function deriveHeadToHead(
  sideAIds: string[],
  sideBIds: string[],
  matches: MatchResult[],
): { aWins: number; bWins: number; draws: number; total: number; lastMatchId?: string } {
  const relevant = matches
    .filter((m) => {
      if (m.sides.length < 2) return false;
      const hasA = m.sides.some((s) => sideAIds.every((id) => s.wrestlerIds.includes(id)));
      const hasB = m.sides.some((s) => sideBIds.every((id) => s.wrestlerIds.includes(id)));
      return hasA && hasB;
    })
    .sort((a, b) => cmpDate(b.date, a.date));

  let aWins = 0,
    bWins = 0,
    draws = 0;
  const lastMatchId = relevant[0]?.id;

  for (const m of relevant) {
    const isDraw = m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
    if (isDraw || !m.winnerSideId) {
      draws++;
      continue;
    }
    const winnerSide = m.sides.find((s) => s.id === m.winnerSideId);
    if (!winnerSide) {
      draws++;
      continue;
    }
    const aWon = sideAIds.every((id) => winnerSide.wrestlerIds.includes(id));
    if (aWon) aWins++;
    else bWins++;
  }

  return { aWins, bWins, draws, total: relevant.length, lastMatchId };
}
