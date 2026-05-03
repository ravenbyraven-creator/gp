import { useLocalStorage } from "./storage";
import type { UniverseDate } from "./calendar";

export type EndpointKey =
  | "storyline"
  | "show"
  | "surprise"
  | "promo"
  | "chat"
  | "summarize"
  | "issue"
  | "rumor"
  | "suggestChapter"
  | "distillMemories"
  | "labelEntry"
  | "blowoffScore";

export interface TokenLogEntry {
  id: string;
  endpoint: EndpointKey;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  at: number;
  universeDate?: UniverseDate;
}

export interface EndpointStats {
  in: number;
  out: number;
  total: number;
  calls: number;
}

export interface TokenStats {
  today: EndpointStats;
  last7Days: EndpointStats;
  lifetime: EndpointStats;
  byEndpoint: Record<EndpointKey, EndpointStats>;
  topRequests: TokenLogEntry[];
}

const TOKEN_LOG_KEY = "umc.tokenLog";
const MAX_LOG_ENTRIES = 500;

const ALL_ENDPOINTS: EndpointKey[] = [
  "storyline",
  "show",
  "surprise",
  "promo",
  "chat",
  "summarize",
  "issue",
  "rumor",
  "suggestChapter",
  "distillMemories",
  "labelEntry",
  "blowoffScore",
];

export function useTokenLog() {
  return useLocalStorage<TokenLogEntry[]>(TOKEN_LOG_KEY, []);
}

// R-06 fix: accepts a functional-updater setter so it always reads the
// live log value even when called from a stale closure (e.g. inside a
// mutation onSuccess that closes over a snapshot from an earlier render).
export function recordTokenUsage(
  setLog: (updater: (prev: TokenLogEntry[]) => TokenLogEntry[]) => void,
  endpoint: EndpointKey,
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null | undefined,
  universeDate?: UniverseDate,
): void {
  if (!usage) return;
  const entry: TokenLogEntry = {
    id: crypto.randomUUID(),
    endpoint,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    at: Date.now(),
    universeDate,
  };
  setLog(prev => [entry, ...prev].slice(0, MAX_LOG_ENTRIES));
}

function emptyStats(): EndpointStats {
  return { in: 0, out: 0, total: 0, calls: 0 };
}

function addEntry(stats: EndpointStats, entry: TokenLogEntry): EndpointStats {
  return {
    in: stats.in + entry.promptTokens,
    out: stats.out + entry.completionTokens,
    total: stats.total + entry.totalTokens,
    calls: stats.calls + 1,
  };
}

export function deriveTokenStats(log: TokenLogEntry[]): TokenStats {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();
  const sevenDaysMs = now - 7 * 24 * 60 * 60 * 1000;

  const today = emptyStats();
  const last7Days = emptyStats();
  const lifetime = emptyStats();
  const byEndpoint: Record<EndpointKey, EndpointStats> = {} as Record<EndpointKey, EndpointStats>;
  for (const ep of ALL_ENDPOINTS) {
    byEndpoint[ep] = emptyStats();
  }

  for (const entry of log) {
    const isToday = entry.at >= todayMs;
    const isLast7 = entry.at >= sevenDaysMs;

    if (isToday) {
      Object.assign(today, addEntry(today, entry));
    }
    if (isLast7) {
      Object.assign(last7Days, addEntry(last7Days, entry));
    }
    Object.assign(lifetime, addEntry(lifetime, entry));

    const ep = entry.endpoint;
    if (byEndpoint[ep]) {
      byEndpoint[ep] = addEntry(byEndpoint[ep], entry);
    }
  }

  const topRequests = [...log]
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 5);

  return { today, last7Days, lifetime, byEndpoint, topRequests };
}

export function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const ENDPOINT_LABELS: Record<EndpointKey, string> = {
  storyline: "Storyline",
  show: "Book Show",
  surprise: "Surprise",
  promo: "Promo",
  chat: "Chat",
  summarize: "Chat Archive",
  issue: "Magazine Issue",
  rumor: "Rumor",
  suggestChapter: "Suggest Chapter",
  distillMemories: "Distill Memories",
  labelEntry: "Label Entry",
  blowoffScore: "Blowoff Score",
};
