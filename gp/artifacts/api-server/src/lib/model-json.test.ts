import { describe, expect, it } from "vitest";
import { GenerateStorylineResponse } from "@workspace/api-zod";
import { ModelJsonParseError, parseModelJson } from "./model-json";

describe("parseModelJson", () => {
  it("parses valid JSON model output", () => {
    expect(parseModelJson('{"kind":"storyline","title":"STORYLINE"}')).toEqual({
      kind: "storyline",
      title: "STORYLINE",
    });
  });

  it("throws a typed error for empty model output", () => {
    expect(() => parseModelJson("   ")).toThrow(ModelJsonParseError);
    try {
      parseModelJson("");
    } catch (err) {
      expect(err).toBeInstanceOf(ModelJsonParseError);
      expect((err as ModelJsonParseError).rawPreview).toBe("<empty>");
    }
  });

  it("throws a typed error with a short preview for malformed JSON", () => {
    try {
      parseModelJson("{not json");
    } catch (err) {
      expect(err).toBeInstanceOf(ModelJsonParseError);
      expect((err as ModelJsonParseError).message).toBe("AI model returned invalid JSON.");
      expect((err as ModelJsonParseError).rawPreview).toBe("{not json");
    }
  });

  it("lets schema validation catch structurally wrong JSON separately", () => {
    const parsed = parseModelJson(JSON.stringify({ kind: "storyline" }));
    expect(() => GenerateStorylineResponse.parse(parsed)).toThrow();
  });

  it("accepts a valid storyline fixture through the response schema", () => {
    const parsed = parseModelJson(
      JSON.stringify({
        kind: "storyline",
        title: "STORYLINE",
        stamp: "ANGLE SET",
        feud: "CODY VS ROMAN",
        participants: ["Cody Rhodes", "Roman Reigns"],
        beats: [{ label: "OPENING", text: "Cody calls out Roman." }],
        headline: "CODY CALLS OUT ROMAN",
        suggestedRivalryHint: {
          matchupGuess: "CODY RHODES vs ROMAN REIGNS",
          confidence: "high",
        },
      }),
    );

    expect(GenerateStorylineResponse.parse(parsed)).toMatchObject({
      feud: "CODY VS ROMAN",
      participants: ["Cody Rhodes", "Roman Reigns"],
    });
  });
});
