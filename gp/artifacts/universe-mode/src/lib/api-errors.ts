type ApiErrorLike = {
  status?: number;
  statusText?: string;
  message?: string;
  data?: unknown;
};

function getStringField(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
}

export function describeApiError(error: unknown): string {
  const err = error as ApiErrorLike | undefined;
  const status = err?.status;
  const serverError =
    getStringField(err?.data, "detail") ??
    getStringField(err?.data, "error") ??
    getStringField(err?.data, "message");

  if (serverError) return serverError;

  if (status === 429) {
    return "Too many AI requests. Give it a moment and try again.";
  }

  if (status === 401 || status === 403) {
    return "The AI server rejected the request. Check the API credentials for this environment.";
  }

  if (status === 404) {
    return "The app could not find the AI route. Check that the API server is running.";
  }

  if (status && status >= 500) {
    return "The AI server hit an internal error. Try again, or use a manual creative note for now.";
  }

  const message = err?.message ?? "";
  if (
    message.toLowerCase().includes("failed to fetch") ||
    message.toLowerCase().includes("network") ||
    message.toLowerCase().includes("load failed")
  ) {
    return "Creative team is offline. The app could not reach the AI server.";
  }

  return message || "Something went wrong, but the app did not receive a clear reason.";
}
