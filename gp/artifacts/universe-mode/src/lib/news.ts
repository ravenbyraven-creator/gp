import { useLocalStorage } from "./storage";
import type { UniverseDate } from "./calendar";
import type {
  IssueCoverDataCoverColor,
  IssueFeatureDataKind,
  SuggestedRivalryHint,
} from "@workspace/api-client-react";

export type CoverColor = IssueCoverDataCoverColor;
export type IssueFeatureKind = IssueFeatureDataKind;

export type IssueFeature = {
  kind: IssueFeatureKind;
  headline: string;
  dek?: string;
  byline?: string;
  body: string;
  pullQuote?: string;
  featuredWrestlerId?: string;
};

export type IssueCoverTeaser = {
  headline: string;
  dek: string;
  featureIndex: number;
};

export type Issue = {
  id: string;
  issueNumber: number;
  universeDate: UniverseDate;
  createdAt: number;
  cover: {
    masthead: string;
    primaryHeadline: string;
    primarySubhead?: string;
    featuredWrestlerId?: string;
    teasers: IssueCoverTeaser[];
    burstSticker?: string;
    coverColor: CoverColor;
    suggestedRivalryHint?: SuggestedRivalryHint;
  };
  features: IssueFeature[];
  read: boolean;
};

export type Rumor = {
  id: string;
  universeDate: UniverseDate;
  createdAt: number;
  headline: string;
  body: string;
  fakeSource: string;
};

export function useIssues() {
  return useLocalStorage<Issue[]>("umc.issues", []);
}

export function useRumors() {
  return useLocalStorage<Rumor[]>("umc.rumors", []);
}

/** Resolve a wrestler name (case-insensitive) to a wrestler id from the roster. */
export function resolveWrestlerIdByName(
  name: string | undefined,
  roster: { id: string; name: string }[],
): string | undefined {
  if (!name) return undefined;
  const target = name.trim().toLowerCase();
  const match = roster.find((w) => w.name.trim().toLowerCase() === target);
  return match?.id;
}

/** Hex values for the four sanctioned cover colors. */
export const COVER_HEX: Record<CoverColor, string> = {
  RED: "#dc1e1e",
  BLUE: "#1e4ebf",
  YELLOW: "#f4c41a",
  BLACK: "#0a0a0a",
};

/** When the cover background is dark, light-color the headline; light bg, dark headline. */
export const COVER_IS_DARK: Record<CoverColor, boolean> = {
  RED: true,
  BLUE: true,
  YELLOW: false,
  BLACK: true,
};
