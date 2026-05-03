import { describe, expect, it } from "vitest";
import { COVER_HEX, COVER_IS_DARK, resolveWrestlerIdByName } from "./news";

describe("news helpers", () => {
  const roster = [
    { id: "bianca", name: "Bianca Belair" },
    { id: "rhea", name: "Rhea Ripley" },
  ];

  it("resolves wrestler names case-insensitively", () => {
    expect(resolveWrestlerIdByName("  rhea ripley ", roster)).toBe("rhea");
    expect(resolveWrestlerIdByName("BIANCA BELAIR", roster)).toBe("bianca");
  });

  it("returns undefined when a cover name is missing or not on the roster", () => {
    expect(resolveWrestlerIdByName(undefined, roster)).toBeUndefined();
    expect(resolveWrestlerIdByName("Iyo Sky", roster)).toBeUndefined();
  });

  it("keeps cover color metadata in sync for sanctioned colors", () => {
    expect(Object.keys(COVER_HEX).sort()).toEqual(["BLACK", "BLUE", "RED", "YELLOW"]);
    expect(COVER_IS_DARK.BLACK).toBe(true);
    expect(COVER_IS_DARK.YELLOW).toBe(false);
  });
});
