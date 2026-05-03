import type { ChapterType } from "./storage";

export type ArcAct = "ACT_1" | "ACT_2" | "ACT_3";

export interface ArcMilestone {
  id: string;
  act: ArcAct;
  label: string;
}

export const ARC_MILESTONES: ArcMilestone[] = [
  // Act 1 — Build
  { id: "a1_first_confrontation", act: "ACT_1", label: "First confrontation" },
  { id: "a1_promo_war",           act: "ACT_1", label: "Promo war / callout" },
  { id: "a1_first_match",         act: "ACT_1", label: "First match" },
  { id: "a1_crowd_sides",         act: "ACT_1", label: "Crowd picks a side" },
  // Act 2 — Heat
  { id: "a2_screwjob",            act: "ACT_2", label: "Screwjob / cheap finish" },
  { id: "a2_attack",              act: "ACT_2", label: "Brutal attack / sneak attack" },
  { id: "a2_stipulation",         act: "ACT_2", label: "Stipulation added" },
  { id: "a2_title_involved",      act: "ACT_2", label: "Title on the line" },
  { id: "a2_turn",                act: "ACT_2", label: "Heel / face turn" },
  // Act 3 — Blow-Off
  { id: "a3_match_booked",        act: "ACT_3", label: "Blowoff match booked" },
  { id: "a3_final_promo",         act: "ACT_3", label: "Final promo / contract signing" },
  { id: "a3_match_happens",       act: "ACT_3", label: "Blowoff match happens" },
  { id: "a3_aftermath",           act: "ACT_3", label: "Aftermath / winner statement" },
];

export const ACT_META: Record<ArcAct, { label: string; shortLabel: string; color: string; chapters: ChapterType[] }> = {
  ACT_1: {
    label:      "Act 1 — Build",
    shortLabel: "Act 1",
    color:      "#3b82f6",
    chapters:   ["BEGINNING", "ESCALATION"],
  },
  ACT_2: {
    label:      "Act 2 — Heat",
    shortLabel: "Act 2",
    color:      "#dc1e1e",
    chapters:   ["TURNING POINT", "FALLOUT"],
  },
  ACT_3: {
    label:      "Act 3 — Blow-Off",
    shortLabel: "Act 3",
    color:      "#f59e0b",
    chapters:   ["BLOWOFF"],
  },
};

export const ACTS: ArcAct[] = ["ACT_1", "ACT_2", "ACT_3"];

/** Derive current act from which chapter types have entries */
export function deriveCurrentAct(
  checkedChapterTypes: Set<ChapterType>,
): ArcAct {
  if (checkedChapterTypes.has("BLOWOFF")) return "ACT_3";
  if (
    checkedChapterTypes.has("TURNING POINT") ||
    checkedChapterTypes.has("FALLOUT")
  )
    return "ACT_2";
  return "ACT_1";
}

/** How many milestones are done for a given act */
export function actProgress(
  act: ArcAct,
  checked: Set<string>,
): { done: number; total: number } {
  const milestones = ARC_MILESTONES.filter((m) => m.act === act);
  return {
    done:  milestones.filter((m) => checked.has(m.id)).length,
    total: milestones.length,
  };
}
