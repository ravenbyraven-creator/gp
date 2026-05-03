import type { MatchResult } from "./matches";
import type { Championship } from "./storage";
import type { Rivalry } from "./rivalry";
import { wrestlerMatches } from "./matches";

export type PushTier =
  | "MAIN EVENT"
  | "UPPER CARD"
  | "MID CARD"
  | "LOWER CARD"
  | "BURIED";

export interface PushScore {
  wrestlerId: string;
  score: number;
  tier: PushTier;
  breakdown: {
    matchRecord: number;
    titleBonus: number;
    feudBonus: number;
    streakBonus: number;
    starBonus: number;
  };
}

function tier(score: number): PushTier {
  if (score >= 85) return "MAIN EVENT";
  if (score >= 70) return "UPPER CARD";
  if (score >= 50) return "MID CARD";
  if (score >= 30) return "LOWER CARD";
  return "BURIED";
}

export function computePushScore(
  wrestlerId: string,
  allMatches: MatchResult[],
  championships: Championship[],
  rivalries: Rivalry[],
): PushScore {
  const recent = wrestlerMatches(wrestlerId, allMatches).slice(0, 10);

  let matchRecord = 0;
  let streakLen = 0;
  let streakKind: "W" | "L" | null = null;
  let starBonus = 0;
  let starCount = 0;

  for (const m of recent) {
    const isDraw = m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
    if (!isDraw) {
      const mySide = m.sides.find((s) => s.wrestlerIds.includes(wrestlerId));
      const isWin = Boolean(mySide && mySide.id === m.winnerSideId);
      matchRecord += isWin ? 4 : -3;

      const k: "W" | "L" = isWin ? "W" : "L";
      if (streakLen === 0) {
        streakKind = k;
        streakLen = 1;
      } else if (k === streakKind) {
        streakLen++;
      }
    }
    if (m.stars && m.stars >= 4 && starCount < 3) {
      starBonus += 2;
      starCount++;
    }
  }

  const streakBonus =
    streakKind === "W" && streakLen >= 3
      ? 5
      : streakKind === "L" && streakLen >= 3
      ? -8
      : 0;

  const isChampion = championships.some(
    (c) =>
      c.active !== false &&
      (c.currentChampionIds ?? []).includes(wrestlerId),
  );
  const titleBonus = isChampion ? 20 : 0;

  const hasActiveFeud = rivalries.some(
    (r) =>
      r.status !== "COMPLETED" &&
      r.sides?.some((s) => (s.wrestlerIds ?? []).includes(wrestlerId)),
  );
  const feudBonus = hasActiveFeud ? 8 : 0;

  const raw = 50 + matchRecord + titleBonus + feudBonus + streakBonus + starBonus;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    wrestlerId,
    score,
    tier: tier(score),
    breakdown: { matchRecord, titleBonus, feudBonus, streakBonus, starBonus },
  };
}

export const TIER_STYLE: Record<PushTier, { bar: string; badge: string; text: string }> = {
  "MAIN EVENT": {
    bar: "bg-amber-400",
    badge: "border-amber-400/40 bg-amber-400/10 text-amber-400",
    text: "text-amber-400",
  },
  "UPPER CARD": {
    bar: "bg-blue-400",
    badge: "border-blue-400/30 bg-blue-400/10 text-blue-400",
    text: "text-blue-400",
  },
  "MID CARD": {
    bar: "bg-foreground/60",
    badge: "border-white/15 bg-white/6 text-foreground/70",
    text: "text-foreground/70",
  },
  "LOWER CARD": {
    bar: "bg-rose-400/60",
    badge: "border-rose-400/20 bg-rose-400/6 text-rose-400/60",
    text: "text-rose-400/60",
  },
  BURIED: {
    bar: "bg-muted-foreground/20",
    badge: "border-white/8 bg-white/3 text-muted-foreground/40",
    text: "text-muted-foreground/40",
  },
};
