import { describe, expect, it } from "vitest";
import {
  allWrestlerIds,
  compareDate,
  entryParticipantNames,
  resolveNamesToIds,
  rivalryDisplayTitle,
  rivalryMatchupPlain,
  sideLabel,
  splitIntoSides,
  type Rivalry,
} from "./rivalry";

const roster = [
  { id: "cody", name: "Cody Rhodes" },
  { id: "roman", name: "Roman Reigns" },
  { id: "solo", name: "Solo Sikoa" },
  { id: "rhea", name: "Rhea Ripley" },
];

const rivalry: Rivalry = {
  id: "r1",
  sides: [
    { id: "a", wrestlerIds: ["cody"] },
    { id: "b", label: "The Bloodline", wrestlerIds: ["roman", "solo"] },
  ],
  status: "ACTIVE",
  createdDate: { year: 0, month: 1, week: 1, day: 1 },
  lastActivityDate: { year: 0, month: 1, week: 2, day: 1 },
  historyEntryIds: [],
};

describe("rivalry helpers", () => {
  it("builds display titles and matchup labels from roster ids", () => {
    expect(sideLabel(rivalry.sides[0], roster)).toBe("CODY RHODES");
    expect(sideLabel(rivalry.sides[1], roster)).toBe("THE BLOODLINE");
    expect(rivalryMatchupPlain(rivalry, roster)).toBe("CODY RHODES VS THE BLOODLINE");
    expect(rivalryDisplayTitle(rivalry, roster)).toBe("CODY RHODES VS THE BLOODLINE");
  });

  it("prefers a custom rivalry title when present", () => {
    expect(rivalryDisplayTitle({ ...rivalry, title: "Finish The Story" }, roster)).toBe(
      "FINISH THE STORY",
    );
  });

  it("deduplicates wrestler ids while preserving side order", () => {
    expect(
      allWrestlerIds({
        ...rivalry,
        sides: [
          { id: "a", wrestlerIds: ["cody", "roman"] },
          { id: "b", wrestlerIds: ["roman", "solo"] },
        ],
      }),
    ).toEqual(["cody", "roman", "solo"]);
  });

  it("resolves exact names case-insensitively and splits sides predictably", () => {
    expect(resolveNamesToIds(["cody rhodes", "RHEA RIPLEY", "Unknown"], roster)).toEqual([
      "cody",
      "rhea",
    ]);
    expect(splitIntoSides(["cody"])).toEqual([["cody"], []]);
    expect(splitIntoSides(["cody", "roman", "solo"])).toEqual([
      ["cody", "roman"],
      ["solo"],
    ]);
  });

  it("extracts participant names from entries worth filing to rivalries", () => {
    expect(
      entryParticipantNames({
        kind: "storyline",
        id: "h1",
        createdAt: 1,
        data: {
          kind: "storyline",
          title: "STORYLINE",
          stamp: "ANGLE SET",
          feud: "CODY VS ROMAN",
          participants: ["Cody Rhodes", "Roman Reigns"],
          beats: [],
          headline: "CODY CALLS OUT ROMAN",
        },
      }),
    ).toEqual(["Cody Rhodes", "Roman Reigns"]);
  });

  it("compares universe dates in year, month, week, day order", () => {
    expect(
      compareDate(
        { year: 1, month: 1, week: 1, day: 0 },
        { year: 0, month: 12, week: 4, day: 6 },
      ),
    ).toBeGreaterThan(0);
    expect(
      compareDate(
        { year: 0, month: 3, week: 1, day: 0 },
        { year: 0, month: 3, week: 2, day: 0 },
      ),
    ).toBeLessThan(0);
  });
});
