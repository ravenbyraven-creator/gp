import { describe, expect, it } from "vitest";
import { buildBookerContext, type RivalryEntry, type Championship, type Stable } from "./storage";
import type { Issue } from "./news";
import type { Rivalry, Memory } from "./rivalry";

const roster = [
  { id: "cody", name: "Cody Rhodes", showId: "raw", alignment: "FACE" },
  { id: "roman", name: "Roman Reigns", showId: "smackdown", alignment: "HEEL" },
] as any[];

const shows = [
  { id: "raw", name: "Monday Night Raw", night: "Monday", vibe: "Red brand chaos" },
  { id: "smackdown", name: "Friday Night SmackDown", night: "Friday" },
] as any[];

describe("buildBookerContext", () => {
  it("builds the compact context used by AI booker requests", () => {
    const history: RivalryEntry[] = [
      {
        kind: "log",
        id: "log-1",
        createdAt: 2,
        universeDate: { year: 0, month: 1, week: 2, day: 1 },
        text: "Cody Rhodes promised to finish the story.",
      },
      {
        kind: "storyline",
        id: "story-1",
        createdAt: 1,
        universeDate: { year: 0, month: 1, week: 1, day: 1 },
        data: {
          kind: "storyline",
          title: "STORYLINE",
          stamp: "ANGLE SET",
          feud: "CODY VS ROMAN",
          participants: ["Cody Rhodes", "Roman Reigns"],
          beats: [{ label: "OPENING", text: "Cody calls out Roman." }],
          headline: "CODY CALLS OUT ROMAN",
        } as any,
      },
    ];

    const rivalries: Rivalry[] = [
      {
        id: "r1",
        title: "Finish The Story",
        sides: [
          { id: "a", wrestlerIds: ["cody"] },
          { id: "b", wrestlerIds: ["roman"] },
        ],
        status: "ACTIVE",
        createdDate: { year: 0, month: 1, week: 1, day: 1 },
        lastActivityDate: { year: 0, month: 1, week: 2, day: 1 },
        historyEntryIds: ["story-1"],
      },
    ];

    const memories: Memory[] = [
      {
        id: "m1",
        rivalryId: "r1",
        text: "Roman escaped Cody after Solo interfered.",
        date: { year: 0, month: 1, week: 2, day: 1 },
        source: "manual",
      },
    ];

    const issues: Issue[] = [
      {
        id: "issue-1",
        issueNumber: 3,
        universeDate: { year: 0, month: 1, week: 2, day: 2 },
        createdAt: 3,
        cover: {
          masthead: "GORILLA POSITION",
          primaryHeadline: "ROMAN ON THE RUN",
          teasers: [],
          coverColor: "BLACK",
        },
        features: [],
        read: false,
      },
    ];

    const context = buildBookerContext(
      roster,
      { name: "Paul Heyman", style: "Long-term manipulation" } as any,
      history,
      shows,
      { year: 0, month: 1, week: 2, day: 1 },
      [{ id: "rumble", name: "Royal Rumble", month: 1, week: 4, day: 6 }],
      rivalries,
      memories,
      issues,
    );

    expect(context.roster).toEqual(roster);
    expect(context.shows).toEqual([
      { id: "raw", name: "Monday Night Raw", vibe: "Red brand chaos", night: "Monday" },
      { id: "smackdown", name: "Friday Night SmackDown", vibe: undefined, night: "Friday" },
    ]);
    expect(context.recentEvents).toEqual(["Cody Rhodes promised to finish the story."]);
    expect(context.ongoingRivalries[0]).toMatchObject({
      title: "CODY VS ROMAN",
      participants: ["Cody Rhodes", "Roman Reigns"],
      recentBeats: ["Cody calls out Roman."],
    });
    expect(context.upcomingEvents[0]).toMatchObject({
      name: "Royal Rumble",
      weeksOut: 2,
    });
    expect(context.activeRivalryMemories).toEqual([
      {
        rivalryTitle: "FINISH THE STORY",
        beats: ["Roman escaped Cody after Solo interfered."],
      },
    ]);
    expect(context.recentMagazineHeadlines).toEqual([
      {
        issueNumber: 3,
        coverHeadline: "ROMAN ON THE RUN",
        universeDate: { month: 1, week: 2, day: 2 },
      },
    ]);
  });

  it("includes championships in the context", () => {
    const championships: Championship[] = [
      {
        id: "wwe-title",
        name: "WWE Championship",
        brand: "RAW",
        division: "MENS",
        currentChampionIds: ["cody"],
        active: true,
        notes: "Main title",
      },
      {
        id: "womens-title",
        name: "Women's Championship",
        brand: "RAW",
        division: "WOMENS",
        currentChampionIds: [],
        active: true,
      },
    ];

    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], championships);

    expect(context.championships).toBeDefined();
    expect(context.championships).toHaveLength(2);
    expect(context.championships![0]).toMatchObject({
      id: "wwe-title",
      name: "WWE Championship",
      brand: "RAW",
      currentChampionIds: ["cody"],
    });
    expect(context.championships![1]).toMatchObject({
      id: "womens-title",
      name: "Women's Championship",
    });
  });

  it("includes stables in the context", () => {
    const stables: Stable[] = [
      {
        id: "bloodline",
        name: "The Bloodline",
        memberIds: ["roman"],
        leaderId: "roman",
        brand: "SMACKDOWN",
        alignment: "HEEL",
        status: "ACTIVE",
        notes: "Most dominant faction",
      },
    ];

    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], [], stables);

    expect(context.stables).toBeDefined();
    expect(context.stables).toHaveLength(1);
    expect(context.stables![0]).toMatchObject({
      id: "bloodline",
      name: "The Bloodline",
      memberIds: ["roman"],
      alignment: "HEEL",
      status: "ACTIVE",
    });
  });

  it("strips imageUrl from roster wrestlers before sending to AI", () => {
    const rosterWithImages = [
      { id: "cody", name: "Cody Rhodes", alignment: "FACE", imageUrl: "data:image/png;base64,LARGEBASE64DATA" },
      { id: "roman", name: "Roman Reigns", alignment: "HEEL", imageUrl: "https://example.com/roman.jpg" },
    ] as any[];

    const context = buildBookerContext(rosterWithImages, null, [], []);

    expect(context.roster).toHaveLength(2);
    expect((context.roster[0] as any).imageUrl).toBeUndefined();
    expect((context.roster[1] as any).imageUrl).toBeUndefined();
    expect((context.roster[0] as any).name).toBe("Cody Rhodes");
    expect((context.roster[1] as any).name).toBe("Roman Reigns");
  });

  it("strips imageUrl from championships before sending to AI", () => {
    const championships: Championship[] = [
      {
        id: "wwe-title",
        name: "WWE Championship",
        active: true,
        currentChampionIds: ["cody"],
        imageUrl: "data:image/png;base64,BELTIMAGE",
      },
    ];

    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], championships);

    expect(context.championships).toBeDefined();
    expect((context.championships![0] as any).imageUrl).toBeUndefined();
    expect(context.championships![0].name).toBe("WWE Championship");
    expect(context.championships![0].currentChampionIds).toEqual(["cody"]);
  });

  it("strips logoUrl from stables before sending to AI", () => {
    const stables: Stable[] = [
      {
        id: "bloodline",
        name: "The Bloodline",
        memberIds: ["roman"],
        alignment: "HEEL",
        status: "ACTIVE",
        logoUrl: "data:image/png;base64,STABLELOGODATA",
      },
    ];

    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], [], stables);

    expect(context.stables).toBeDefined();
    expect((context.stables![0] as any).logoUrl).toBeUndefined();
    expect(context.stables![0].name).toBe("The Bloodline");
    expect(context.stables![0].memberIds).toEqual(["roman"]);
  });

  it("returns undefined for championships and stables when arrays are empty", () => {
    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], [], []);

    expect(context.championships).toBeUndefined();
    expect(context.stables).toBeUndefined();
  });

  it("excludes inactive championships from the context", () => {
    const championships: Championship[] = [
      { id: "active-title", name: "Active Title", active: true, currentChampionIds: ["cody"] },
      { id: "retired-title", name: "Retired Title", active: false, currentChampionIds: [] },
    ];

    const context = buildBookerContext(roster, null, [], [], undefined, [], [], [], [], championships);

    expect(context.championships).toBeDefined();
    expect(context.championships).toHaveLength(2);
  });
});
