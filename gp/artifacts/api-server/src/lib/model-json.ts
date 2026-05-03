export class ModelJsonParseError extends Error {
  readonly rawPreview: string;

  constructor(message: string, rawContent: string | null | undefined, cause?: unknown) {
    super(message);
    this.name = "ModelJsonParseError";
    this.rawPreview = preview(rawContent);
    this.cause = cause;
  }
}

function preview(rawContent: string | null | undefined): string {
  const raw = rawContent ?? "";
  const trimmed = raw.trim();
  if (!trimmed) return "<empty>";
  return trimmed.length > 240 ? `${trimmed.slice(0, 237)}...` : trimmed;
}

export function parseModelJson(content: string | null | undefined): unknown {
  if (!content || content.trim() === "") {
    throw new ModelJsonParseError("AI model returned an empty JSON response.", content);
  }

  try {
    return JSON.parse(content);
  } catch (cause) {
    throw new ModelJsonParseError(
      "AI model returned invalid JSON.",
      content,
      cause,
    );
  }
}
