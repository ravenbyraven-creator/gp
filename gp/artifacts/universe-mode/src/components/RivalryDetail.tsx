import { useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, User, X, Plus, Sparkles, ArrowUp, ArrowDown, Loader2, ChevronDown, ChevronRight, Check } from "lucide-react";
import { toast } from "sonner";
import {
  useSuggestChapter,
  useDistillMemories,
  useLabelEntry,
  useBlowoffScore,
} from "@workspace/api-client-react";
import {
  useRivalries,
  useRoster,
  useHistory,
  useUniverseDate,
  useChapters,
  useMemories,
  useChairman,
  useShows,
  useEvents,
  useChampionships,
  useStables,
  useChampionLookup,
  useMatchResults,
  useFeuArcMilestones,
  buildBookerContext,
  CHAPTER_TYPES,
  type RivalryEntry,
  type ChapterType,
} from "@/lib/storage";
import {
  ARC_MILESTONES, ACT_META, ACTS, deriveCurrentAct, actProgress,
  type ArcAct,
} from "@/lib/feudArc";
import { cn } from "@/lib/utils";
import { useTokenLog, recordTokenUsage } from "@/lib/tokens";
import { deriveHeadToHead } from "@/lib/matches";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";
import { useIssues } from "@/lib/news";
import { CHAIRMEN } from "@/lib/chairmen";
import {
  rivalryDisplayTitle,
  rivalryMatchupPlain,
  sideLabel,
  lookupWrestlers,
  allWrestlerIds,
  compareDate,
  type Rivalry,
  type Chapter,
  type Memory,
} from "@/lib/rivalry";
import { formatDate, type UniverseDate } from "@/lib/calendar";
import { IssueView } from "./IssueView";

const MEMORY_MAX = 200;

function entryKindForContext(kind: RivalryEntry["kind"]): "storyline" | "show" | "surprise" | "promo" | "log" {
  return kind === "magazine" ? "log" : kind;
}

function entrySummary(entry: RivalryEntry): string {
  if (entry.kind === "log") return entry.text.slice(0, 140);
  if (entry.kind === "storyline") return `${entry.data.feud} — ${entry.data.headline}`;
  if (entry.kind === "show") return `${entry.data.showName} — ${entry.data.headline}`;
  if (entry.kind === "surprise") return entry.data.headline;
  if (entry.kind === "promo") return `${entry.data.wrestlerName}: ${entry.data.headline}`;
  if (entry.kind === "magazine") return `Issue #${entry.data.issueNumber} cover — ${entry.data.coverHeadline}`;
  return "";
}

/**
 * Frontend blowoff confidence score — no token cost.
 * Based on how many distinct chapter types are present in the entries.
 * BLOWOFF entries push the score toward 100.
 */
function calcBlowoffScore(entries: RivalryEntry[]): number {
  if (entries.length === 0) return 0;
  const labeled = entries.filter((e) => e.chapter);
  const types = new Set(labeled.map((e) => e.chapter as ChapterType));

  // Weight each chapter type
  const weights: Record<ChapterType, number> = {
    BEGINNING: 15,
    ESCALATION: 20,
    "TURNING POINT": 25,
    FALLOUT: 20,
    BLOWOFF: 20,
  };
  let score = 0;
  for (const t of types) score += weights[t] ?? 0;

  // Entry count bonus (max +10)
  score += Math.min(entries.length * 2, 10);

  // If BLOWOFF is already labeled, cap at 100
  if (types.has("BLOWOFF")) score = 100;

  return Math.min(100, Math.round(score));
}

const BRAND_RED = "#dc1e1e";

type Tab = "HISTORY" | "CHAPTERS" | "MEMORIES" | "TIMELINE" | "ARC";

interface RivalryDetailProps {
  rivalryId: string | null;
  onClose: () => void;
}

export function RivalryDetail({ rivalryId, onClose }: RivalryDetailProps) {
  const [rivalries, setRivalries] = useRivalries();
  const [roster] = useRoster();
  const [history] = useHistory();
  const [universeDate] = useUniverseDate();
  const [chapters] = useChapters();
  const [memories] = useMemories();
  const [matchResults] = useMatchResults();

  const rivalry = useMemo(
    () => rivalries.find((r) => r.id === rivalryId) ?? null,
    [rivalries, rivalryId],
  );

  const h2h = useMemo(() => {
    if (!rivalry || matchResults.length === 0) return null;
    const sideAIds: string[] = (rivalry.sides[0] as any)?.wrestlerIds ?? [];
    const sideBIds: string[] = (rivalry.sides[1] as any)?.wrestlerIds ?? [];
    if (sideAIds.length === 0 || sideBIds.length === 0) return null;
    const result = deriveHeadToHead(sideAIds, sideBIds, matchResults);
    if (result.total === 0) return null;
    return result;
  }, [rivalry, matchResults]);

  const [tab, setTab] = useState<Tab>("TIMELINE");
  const [titleEdit, setTitleEdit] = useState("");
  const [mobilePane, setMobilePane] = useState<"info" | "content">("content");

  const open = Boolean(rivalry);

  const update = (patch: Partial<Rivalry>) => {
    if (!rivalry) return;
    setRivalries(rivalries.map((r) => (r.id === rivalry.id ? { ...r, ...patch } : r)));
  };

  const handleDelete = () => {
    if (!rivalry) return;
    if (!confirm("Delete this rivalry? History entries will not be deleted.")) return;
    setRivalries(rivalries.filter((r) => r.id !== rivalry.id));
    toast.success("Rivalry deleted");
    onClose();
  };

  const handleToggleStatus = () => {
    if (!rivalry) return;
    if (rivalry.status === "ACTIVE") {
      update({ status: "CONCLUDED", concludedDate: universeDate });
      toast.success("Rivalry concluded");
    } else {
      update({ status: "ACTIVE", concludedDate: undefined });
      toast.success("Rivalry reactivated");
    }
  };

  const linkedEntries: RivalryEntry[] = useMemo(() => {
    if (!rivalry) return [];
    const byId = new Map(history.map((h) => [h.id, h]));
    return rivalry.historyEntryIds
      .map((id) => byId.get(id))
      .filter((e): e is RivalryEntry => Boolean(e))
      .sort((a, b) => {
        if (a.universeDate && b.universeDate) {
          return compareDate(b.universeDate, a.universeDate);
        }
        return b.createdAt - a.createdAt;
      });
  }, [rivalry, history]);

  const linkedChapters = useMemo(
    () => (rivalry ? chapters.filter((c) => c.rivalryId === rivalry.id) : []),
    [chapters, rivalry],
  );
  const linkedMemories = useMemo(
    () => (rivalry ? memories.filter((m) => m.rivalryId === rivalry.id) : []),
    [memories, rivalry],
  );

  const wrestlers = useMemo(
    () => (rivalry ? lookupWrestlers(allWrestlerIds(rivalry), roster) : []),
    [rivalry, roster],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="bg-card border-border text-foreground p-0 overflow-hidden gap-0 sm:max-w-[1200px] w-[95vw] h-[88vh] max-h-[88vh] grid grid-rows-[auto_1fr]"
      >
        {!rivalry ? (
          <div className="p-8 text-center text-muted-foreground">No rivalry selected.</div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/20">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                {rivalry.status === "ACTIVE" ? "Active Rivalry" : "Past Rivalry"}
              </div>
              <div className="flex items-center gap-2">
                <div className="md:hidden flex rounded-md overflow-hidden border border-border text-[10px] font-bold tracking-widest uppercase">
                  <button
                    onClick={() => setMobilePane("info")}
                    className={mobilePane === "info" ? "px-3 py-1.5 bg-foreground text-background" : "px-3 py-1.5 text-muted-foreground hover:text-foreground"}
                  >
                    Info
                  </button>
                  <button
                    onClick={() => setMobilePane("content")}
                    className={mobilePane === "content" ? "px-3 py-1.5 bg-foreground text-background" : "px-3 py-1.5 text-muted-foreground hover:text-foreground"}
                  >
                    Timeline
                  </button>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] min-h-0 overflow-hidden">
              {/* LEFT PANE */}
              <div className={`border-r border-border p-5 space-y-5 overflow-y-auto ${mobilePane === "info" ? "block" : "hidden"} md:block`}>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Title
                  </label>
                  <Input
                    value={titleEdit !== "" ? titleEdit : (rivalry.title ?? "")}
                    onChange={(e) => setTitleEdit(e.target.value)}
                    onFocus={() => setTitleEdit(rivalry.title ?? "")}
                    onBlur={() => {
                      const next = titleEdit.trim();
                      if (next !== (rivalry.title ?? "")) {
                        update({ title: next || undefined });
                      }
                      setTitleEdit("");
                    }}
                    placeholder="Auto: matchup"
                    className="bg-background border-border font-display tracking-widest uppercase"
                  />
                  <div className="font-display text-2xl uppercase tracking-widest text-foreground leading-tight pt-1">
                    {rivalryDisplayTitle(rivalry, roster)}
                  </div>
                  <div
                    className="text-xs uppercase tracking-widest font-bold"
                    style={{ color: BRAND_RED }}
                  >
                    {rivalry.sides[0] ? sideLabel(rivalry.sides[0], roster) : "—"}
                    <span className="px-2 text-muted-foreground/60">VS</span>
                    {rivalry.sides[1] ? sideLabel(rivalry.sides[1], roster) : "—"}
                  </div>
                </div>

                <MatchupGraphic rivalry={rivalry} roster={roster} />

                <ArcSummaryBadge rivalryId={rivalry.id} entries={linkedEntries} onOpenArc={() => setTab("ARC")} />

                {h2h && (
                  <div className="flex items-center justify-center gap-2 py-1.5 px-3 rounded border border-border bg-muted/10 text-xs font-bold tracking-widest uppercase">
                    <span className="text-emerald-400">{h2h.aWins}W</span>
                    <span className="text-muted-foreground/40">–</span>
                    <span className="text-muted-foreground">{h2h.draws}D</span>
                    <span className="text-muted-foreground/40">–</span>
                    <span className="text-red-400">{h2h.bWins}L</span>
                    <span className="text-muted-foreground/40 ml-1 font-normal">({h2h.total})</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span className="uppercase tracking-wider">Started</span>
                    <span className="text-foreground/80">
                      {formatDate(rivalry.createdDate)}
                    </span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="uppercase tracking-wider">Last Activity</span>
                    <span className="text-foreground/80">
                      {formatDate(rivalry.lastActivityDate)}
                    </span>
                  </div>
                  {rivalry.concludedDate && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="uppercase tracking-wider">Concluded</span>
                      <span className="text-foreground/80">
                        {formatDate(rivalry.concludedDate)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground">
                    <span className="uppercase tracking-wider">Entries</span>
                    <span className="text-foreground/80">{linkedEntries.length}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                  <Button
                    onClick={handleToggleStatus}
                    variant="outline"
                    className="w-full text-xs uppercase tracking-widest"
                  >
                    {rivalry.status === "ACTIVE" ? "Conclude Rivalry" : "Reactivate Rivalry"}
                  </Button>
                  <Button
                    onClick={handleDelete}
                    variant="ghost"
                    className="w-full text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" />
                    Delete Rivalry
                  </Button>
                </div>
              </div>

              {/* RIGHT PANE */}
              <div className={`flex-col min-h-0 ${mobilePane === "content" ? "flex" : "hidden"} md:flex`}>
                <div className="flex border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
                  {(["TIMELINE", "HISTORY", "CHAPTERS", "MEMORIES", "ARC"] as Tab[]).map((t) => {
                    const active = tab === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setTab(t)}
                        className="relative px-5 py-3 text-xs font-bold tracking-widest uppercase transition-colors whitespace-nowrap"
                        style={{
                          color: active ? "var(--foreground)" : "var(--muted-foreground)",
                        }}
                      >
                        {t}
                        {active && (
                          <span
                            className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full"
                            style={{ background: BRAND_RED }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                  {tab === "TIMELINE" && (
                    <TimelineTab rivalry={rivalry} entries={linkedEntries} />
                  )}
                  {tab === "HISTORY" && (
                    <HistoryTab entries={linkedEntries} />
                  )}
                  {tab === "CHAPTERS" && (
                    <ChaptersTab rivalry={rivalry} entries={linkedEntries} />
                  )}
                  {tab === "MEMORIES" && (
                    <MemoriesTab rivalry={rivalry} entries={linkedEntries} />
                  )}
                  {tab === "ARC" && (
                    <ArcTab rivalryId={rivalry.id} entries={linkedEntries} />
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MatchupGraphic({ rivalry, roster }: { rivalry: Rivalry; roster: ReturnType<typeof lookupWrestlers> }) {
  const sideA = useMemo(
    () => lookupWrestlers(rivalry.sides[0]?.wrestlerIds ?? [], roster),
    [rivalry, roster],
  );
  const sideB = useMemo(
    () => lookupWrestlers(rivalry.sides[1]?.wrestlerIds ?? [], roster),
    [rivalry, roster],
  );
  const aImg = sideA[0]?.imageUrl;
  const bImg = sideB[0]?.imageUrl;
  const aName = sideA.map(w => w.name).join(" & ");
  const bName = sideB.map(w => w.name).join(" & ");
  const champLookup = useChampionLookup();
  const sideAChamps = champLookup.get(sideA[0]?.id ?? "") ?? [];
  const sideBChamps = champLookup.get(sideB[0]?.id ?? "") ?? [];

  return (
    <div
      className="relative overflow-hidden rounded-lg"
      style={{ height: "180px", background: "#0a0a0a" }}
    >
      {/* Side A — left half */}
      <div className="absolute inset-y-0 left-0" style={{ width: "50%" }}>
        {aImg ? (
          <img
            src={aImg}
            alt={aName}
            className="w-full h-full object-cover object-top"
            style={{ filter: "brightness(0.85) contrast(1.05)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            <User className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, transparent 40%, rgba(0,0,0,0.92) 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)" }}
        />
        <div className="absolute bottom-2 left-2 pr-4">
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/90 leading-snug line-clamp-2" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {aName}
          </div>
        </div>
        <ChampionBeltOverlay championships={sideAChamps} size="sm" />
      </div>

      {/* Side B — right half */}
      <div className="absolute inset-y-0 right-0" style={{ width: "50%" }}>
        {bImg ? (
          <img
            src={bImg}
            alt={bName}
            className="w-full h-full object-cover object-top"
            style={{ filter: "brightness(0.85) contrast(1.05)" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-muted/20">
            <User className="w-10 h-10 text-muted-foreground/30" />
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to left, transparent 40%, rgba(0,0,0,0.92) 100%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 55%)" }}
        />
        <div className="absolute bottom-2 right-2 pl-4 text-right">
          <div className="text-[9px] font-bold uppercase tracking-wider text-white/90 leading-snug line-clamp-2" style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}>
            {bName}
          </div>
        </div>
        <ChampionBeltOverlay championships={sideBChamps} size="sm" />
      </div>

      {/* VS badge */}
      <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 10 }}>
        <div
          className="font-display text-sm tracking-widest px-2.5 py-1"
          style={{
            background: "rgba(0,0,0,0.88)",
            color: BRAND_RED,
            border: `1px solid ${BRAND_RED}50`,
            letterSpacing: "4px",
            boxShadow: `0 0 12px ${BRAND_RED}30`,
          }}
        >
          VS
        </div>
      </div>

      {/* Status bar at bottom */}
      {rivalry.status === "ACTIVE" && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[2px]"
          style={{ background: BRAND_RED, boxShadow: `0 0 6px ${BRAND_RED}` }}
        />
      )}
    </div>
  );
}

function PortraitFrame({ imageUrl, name, wrestlerId }: { imageUrl?: string; name: string; wrestlerId?: string }) {
  const champLookup = useChampionLookup();
  const championships = wrestlerId ? (champLookup.get(wrestlerId) ?? []) : [];
  return (
    <div
      className="relative w-full aspect-square"
      style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))" }}
    >
      <div
        className="w-full h-full p-[3px]"
        style={{
          clipPath:
            "polygon(7px 0%,calc(100% - 7px) 0%,100% 7px,100% calc(100% - 7px),calc(100% - 7px) 100%,7px 100%,0% calc(100% - 7px),0% 7px)",
          background:
            "linear-gradient(145deg,#e6e6e6 0%,#a4a4a4 18%,#efefef 34%,#b8b8b8 50%,#7e7e7e 66%,#cccccc 82%,#9a9a9a 100%)",
        }}
      >
        <div
          className="relative w-full h-full overflow-hidden bg-muted/30"
          style={{
            clipPath:
              "polygon(5px 0%,calc(100% - 5px) 0%,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0% calc(100% - 5px),0% 5px)",
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt={name} className="w-full h-full object-cover object-center" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-6 h-6 text-muted-foreground/40" strokeWidth={1.25} />
            </div>
          )}
        </div>
      </div>
      <ChampionBeltOverlay championships={championships} size="md" />
    </div>
  );
}

// ── Timeline Tab ──────────────────────────────────────────────────────────

function TimelineTab({ rivalry, entries }: { rivalry: Rivalry; entries: RivalryEntry[] }) {
  const [roster] = useRoster();
  const [, setHistory] = useHistory();
  const baseContext = useAnalyzeBaseContext();
  const labelMutation = useLabelEntry();
  const blowoffMutation = useBlowoffScore();

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set(["BEGINNING"]));
  const [aiBlowoffScore, setAiBlowoffScore] = useState<{ score: number; rationale: string } | null>(null);
  const [pendingEntryId, setPendingEntryId] = useState<string | null>(null);
  const [tokenLog, setTokenLog] = useTokenLog();

  // Sorted oldest→newest for timeline display
  const sorted = useMemo(() => [...entries].reverse(), [entries]);

  // Entries grouped by chapter type
  const grouped = useMemo(() => {
    const map = new Map<string, RivalryEntry[]>();
    map.set("UNLABELED", []);
    for (const ct of CHAPTER_TYPES) map.set(ct, []);
    for (const e of sorted) {
      const key = e.chapter ?? "UNLABELED";
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [sorted]);

  const frontendScore = calcBlowoffScore(entries);
  const displayScore = aiBlowoffScore?.score ?? frontendScore;

  const scoreColor =
    displayScore >= 66
      ? "#22c55e"
      : displayScore >= 45
      ? "#eab308"
      : "var(--muted-foreground)";

  const toggleChapter = (key: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // Assign chapter to an entry in history
  const assignChapter = (entryId: string, chapter: ChapterType | undefined) => {
    setHistory((prev) =>
      prev.map((e) => (e.id === entryId ? { ...e, chapter } : e))
    );
  };

  // AI label the oldest unlabeled entry
  const handleAISuggestNext = () => {
    const unlabeled = sorted.filter((e) => !e.chapter);
    const target = unlabeled[0];
    if (!target) {
      toast.message("All entries have chapter labels.");
      return;
    }
    setPendingEntryId(target.id);
    const existingLabels = sorted
      .filter((e) => e.chapter && e.id !== target.id)
      .map((e) => e.chapter as string);

    labelMutation.mutate(
      {
        data: {
          roster: baseContext.roster,
          rivalryContext: buildRivalryContext(rivalry, roster, entries),
          entryKind: entryKindForContext(target.kind) as "storyline" | "show" | "surprise" | "promo" | "log" | "magazine",
          entrySummary: entrySummary(target),
          entryDate: target.universeDate ? formatDate(target.universeDate) : undefined,
          existingLabels,
        },
      },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "labelEntry", data._usage);
          assignChapter(target.id, data.chapterType as ChapterType);
          toast.success(`Labeled as ${data.chapterType}`, { description: data.rationale });
          setPendingEntryId(null);
        },
        onError: () => {
          toast.error("Creative Overruled", { description: "Couldn't label this entry." });
          setPendingEntryId(null);
        },
      }
    );
  };

  const handleAskCreative = () => {
    blowoffMutation.mutate(
      {
        data: {
          ...baseContext,
          rivalryContext: buildRivalryContext(rivalry, roster, entries),
        },
      },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "blowoffScore", data._usage);
          setAiBlowoffScore({ score: data.score, rationale: data.rationale });
        },
        onError: () => {
          toast.error("Creative Overruled", { description: "Couldn't score blowoff readiness." });
        },
      }
    );
  };

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-16">
        <div className="font-display text-lg uppercase tracking-widest text-foreground mb-2">
          The Timeline Is Empty
        </div>
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
          This feud's story fills up here as you file canon moments — storylines, shows, promos, surprises, and manual logs — to the rivalry. Every saved moment becomes part of the arc.
        </p>
      </div>
    );
  }

  const unlabeledCount = grouped.get("UNLABELED")?.length ?? 0;

  return (
    <div className="space-y-5">
      {/* Blowoff readiness bar */}
      <div className="rounded-lg border border-border bg-background p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
              Blowoff Readiness
            </div>
            <div
              className="font-display text-2xl font-black tracking-widest"
              style={{ color: scoreColor }}
            >
              {displayScore}%
            </div>
            {aiBlowoffScore && (
              <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">
                {aiBlowoffScore.rationale}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAskCreative}
            disabled={blowoffMutation.isPending}
            className="text-[10px] uppercase tracking-widest h-8 shrink-0"
            style={{ borderColor: BRAND_RED, color: BRAND_RED }}
          >
            {blowoffMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Ask Creative
          </Button>
        </div>

        {/* Score bar */}
        <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: scoreColor }}
            initial={{ width: 0 }}
            animate={{ width: `${displayScore}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* AI label action */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {unlabeledCount} unlabeled {unlabeledCount === 1 ? "entry" : "entries"}
        </div>
        {unlabeledCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAISuggestNext}
            disabled={labelMutation.isPending}
            className="text-[10px] uppercase tracking-widest h-8"
            style={{ borderColor: BRAND_RED, color: BRAND_RED }}
          >
            {labelMutation.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Label Next Entry
          </Button>
        )}
      </div>

      {/* Chapter cards — WWE Network chapter-select style */}
      <div className="space-y-3">
        {CHAPTER_TYPES.map((ct) => {
          const chapterEntries = grouped.get(ct) ?? [];
          if (chapterEntries.length === 0) return null;
          const isExpanded = expandedChapters.has(ct);
          return (
            <ChapterCard
              key={ct}
              chapterType={ct}
              entries={chapterEntries}
              isExpanded={isExpanded}
              onToggle={() => toggleChapter(ct)}
              onChangeChapter={assignChapter}
              pendingEntryId={pendingEntryId}
            />
          );
        })}

        {/* Unlabeled bucket */}
        {unlabeledCount > 0 && (
          <ChapterCard
            chapterType={null}
            entries={grouped.get("UNLABELED") ?? []}
            isExpanded={expandedChapters.has("UNLABELED")}
            onToggle={() => toggleChapter("UNLABELED")}
            onChangeChapter={assignChapter}
            pendingEntryId={pendingEntryId}
          />
        )}
      </div>
    </div>
  );
}

interface ChapterCardProps {
  chapterType: ChapterType | null;
  entries: RivalryEntry[];
  isExpanded: boolean;
  onToggle: () => void;
  onChangeChapter: (entryId: string, chapter: ChapterType | undefined) => void;
  pendingEntryId: string | null;
}

function ChapterCard({ chapterType, entries, isExpanded, onToggle, onChangeChapter, pendingEntryId }: ChapterCardProps) {
  const label = chapterType ?? "UNLABELED";

  const accentColor = chapterType
    ? {
        BEGINNING: "#6b7280",
        ESCALATION: "#3b82f6",
        "TURNING POINT": BRAND_RED,
        FALLOUT: "#f59e0b",
        BLOWOFF: "#22c55e",
      }[chapterType]
    : "var(--muted-foreground)";

  return (
    <div className="rounded-lg border border-border bg-background overflow-hidden">
      {/* Chapter header — click to expand/collapse */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <span
          className="shrink-0 w-1.5 h-8 rounded-full"
          style={{ background: accentColor }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="text-[10px] font-black tracking-[0.2em] uppercase"
            style={{ color: accentColor }}
          >
            {label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-border divide-y divide-border/50">
              {entries.map((entry) => (
                <TimelineEntryRow
                  key={entry.id}
                  entry={entry}
                  currentChapter={chapterType}
                  onChangeChapter={onChangeChapter}
                  isPending={pendingEntryId === entry.id}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TimelineEntryRowProps {
  entry: RivalryEntry;
  currentChapter: ChapterType | null;
  onChangeChapter: (entryId: string, chapter: ChapterType | undefined) => void;
  isPending: boolean;
}

function TimelineEntryRow({ entry, currentChapter, onChangeChapter, isPending }: TimelineEntryRowProps) {
  const [showOverride, setShowOverride] = useState(false);

  let typeLabel = "";
  let title = "";
  if (entry.kind === "log") { typeLabel = "LOG"; title = entry.text.split("\n")[0].slice(0, 60) || "Night note"; }
  else if (entry.kind === "storyline") { typeLabel = "STORYLINE"; title = entry.data.feud; }
  else if (entry.kind === "show") { typeLabel = "SHOW"; title = entry.data.showName; }
  else if (entry.kind === "surprise") { typeLabel = "SURPRISE"; title = entry.data.headline; }
  else if (entry.kind === "promo") { typeLabel = "PROMO"; title = entry.data.headline; }
  else if (entry.kind === "magazine") { typeLabel = "MAGAZINE"; title = entry.data.coverHeadline; }

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {isPending && (
        <Loader2 className="w-3.5 h-3.5 mt-0.5 animate-spin text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border border-foreground/30 text-foreground/60 bg-muted/20">
            {typeLabel}
          </span>
          {entry.universeDate && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {formatDate(entry.universeDate)}
            </span>
          )}
        </div>
        <div className="text-sm font-display uppercase tracking-wider text-foreground leading-snug">
          {title}
        </div>
      </div>

      {/* Chapter override controls */}
      <div className="shrink-0 flex items-center gap-1">
        {showOverride ? (
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {CHAPTER_TYPES.map((ct) => (
              <button
                key={ct}
                type="button"
                onClick={() => {
                  onChangeChapter(entry.id, ct);
                  setShowOverride(false);
                }}
                className="text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded border border-border hover:border-foreground/40 hover:text-foreground text-muted-foreground transition-colors bg-background"
                style={ct === currentChapter ? { borderColor: BRAND_RED, color: BRAND_RED } : {}}
              >
                {ct}
              </button>
            ))}
            {currentChapter && (
              <button
                type="button"
                onClick={() => {
                  onChangeChapter(entry.id, undefined);
                  setShowOverride(false);
                }}
                className="text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded border border-border hover:border-destructive hover:text-destructive text-muted-foreground transition-colors bg-background"
              >
                REMOVE
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowOverride(false)}
              className="text-[9px] font-bold tracking-widest uppercase px-2 py-1 rounded hover:bg-muted text-muted-foreground transition-colors"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowOverride(true)}
            className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
          >
            CHANGE
          </button>
        )}
      </div>
    </div>
  );
}

function HistoryTab({ entries }: { entries: RivalryEntry[] }) {
  const [issues] = useIssues();
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const activeIssue = activeIssueId ? (issues.find((i) => i.id === activeIssueId) ?? null) : null;

  if (entries.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center py-12">
        <div className="font-display text-lg uppercase tracking-widest text-foreground mb-2">
          Nothing filed yet
        </div>
        <p className="text-sm text-muted-foreground max-w-sm">
          Book a storyline, show, surprise, or promo from the Creative Desk, then use FILE TO RIVALRY to add it here.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {entries.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onOpenMagazine={e.kind === "magazine" ? () => setActiveIssueId(e.data.issueId) : undefined}
            />
          ))}
        </AnimatePresence>
      </div>
      <IssueView
        issue={activeIssue}
        open={!!activeIssue}
        onOpenChange={(o) => { if (!o) setActiveIssueId(null); }}
        onMarkRead={() => {}}
      />
    </>
  );
}

function EntryCard({ entry, onOpenMagazine }: { entry: RivalryEntry; onOpenMagazine?: () => void }) {
  let typeLabel = "";
  let title = "";
  let sub = "";
  if (entry.kind === "log") {
    typeLabel = "LOG";
    title = entry.text.split("\n")[0].slice(0, 60) || "Night note";
    sub = "";
  } else if (entry.kind === "storyline") {
    typeLabel = "STORYLINE";
    title = entry.data.feud;
    sub = entry.data.participants.join(" VS ");
  } else if (entry.kind === "show") {
    typeLabel = "SHOW";
    title = entry.data.showName;
    sub = `${entry.data.matches.length} matches`;
  } else if (entry.kind === "surprise") {
    typeLabel = "SURPRISE";
    title = entry.data.headline;
    sub = entry.data.stamp;
  } else if (entry.kind === "promo") {
    typeLabel = "PROMO";
    title = entry.data.headline;
    sub = `${entry.data.wrestlerName} · ${entry.data.tone}`;
  } else if (entry.kind === "magazine") {
    typeLabel = "MAGAZINE";
    title = entry.data.coverHeadline;
    sub = `Issue #${entry.data.issueNumber} cover`;
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-background border border-border rounded-lg p-4 hover:border-foreground/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] px-2 py-0.5 rounded font-bold tracking-widest uppercase border border-foreground/40 text-foreground/70 bg-muted/30">
          {typeLabel}
        </span>
        {entry.universeDate && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {formatDate(entry.universeDate)}
          </span>
        )}
      </div>
      <div className="font-display text-sm uppercase tracking-widest text-foreground leading-tight">
        {title}
      </div>
      {sub && (
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">
          {sub}
        </div>
      )}
      {entry.kind === "log" && (
        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap mt-2">
          {entry.text}
        </p>
      )}
      {entry.kind === "magazine" && onOpenMagazine && (
        <button
          type="button"
          onClick={onOpenMagazine}
          className="mt-3 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 px-3 py-1.5 rounded transition-colors"
        >
          Read Issue
        </button>
      )}
    </motion.div>
  );
}

function useAnalyzeBaseContext() {
  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [issues] = useIssues();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const currentChairman = chairman || CHAIRMEN[0];
  return useMemo(
    () =>
      buildBookerContext(
        roster,
        currentChairman,
        history,
        shows,
        universeDate,
        events,
        rivalries,
        memories,
        issues,
        championships,
        stables,
      ),
    [roster, currentChairman, history, shows, universeDate, events, rivalries, memories, issues, championships, stables],
  );
}

function buildRivalryContext(rivalry: Rivalry, roster: Wrestler[], entries: RivalryEntry[]) {
  return {
    title: rivalryDisplayTitle(rivalry, roster),
    sides: rivalry.sides.map((s) => sideLabel(s, roster)),
    recentEntries: entries.slice(0, 10).map((e) => ({
      kind: entryKindForContext(e.kind),
      summary: entrySummary(e),
      universeDate: e.universeDate ? formatDate(e.universeDate) : undefined,
    })),
  };
}

type Wrestler = ReturnType<typeof lookupWrestlers>[number];

function ChaptersTab({ rivalry, entries }: { rivalry: Rivalry; entries: RivalryEntry[] }) {
  const [roster] = useRoster();
  const [chapters, setChapters] = useChapters();
  const [universeDate] = useUniverseDate();
  const baseContext = useAnalyzeBaseContext();
  const suggest = useSuggestChapter();
  const [tokenLog, setTokenLog] = useTokenLog();

  const linked = useMemo(
    () =>
      chapters
        .filter((c) => c.rivalryId === rivalry.id)
        .slice()
        .sort((a, b) => a.order - b.order),
    [chapters, rivalry.id],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");

  const updateChapters = (next: Chapter[]) => setChapters(next);

  const handleAdd = () => {
    const title = addTitle.trim();
    if (!title) {
      toast.error("Give the chapter a title.");
      return;
    }
    const order = linked.length > 0 ? Math.max(...linked.map((c) => c.order)) + 1 : 0;
    const next: Chapter = {
      id: crypto.randomUUID(),
      rivalryId: rivalry.id,
      title,
      startDate: universeDate,
      description: addDesc.trim() || undefined,
      order,
    };
    updateChapters([next, ...chapters]);
    setAdding(false);
    setAddTitle("");
    setAddDesc("");
    toast.success("Chapter added");
  };

  const handleSaveEdit = (id: string) => {
    const title = editTitle.trim();
    if (!title) {
      toast.error("Title can't be empty.");
      return;
    }
    updateChapters(
      chapters.map((c) =>
        c.id === id ? { ...c, title, description: editDesc.trim() || undefined } : c,
      ),
    );
    setEditingId(null);
    toast.success("Chapter updated");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this chapter?")) return;
    updateChapters(chapters.filter((c) => c.id !== id));
    toast.success("Chapter deleted");
  };

  const handleMove = (id: string, dir: -1 | 1) => {
    const idx = linked.findIndex((c) => c.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= linked.length) return;
    const a = linked[idx];
    const b = linked[swap];
    updateChapters(
      chapters.map((c) => {
        if (c.id === a.id) return { ...c, order: b.order };
        if (c.id === b.id) return { ...c, order: a.order };
        return c;
      }),
    );
  };

  const handleSuggest = () => {
    suggest.mutate(
      {
        data: {
          ...baseContext,
          rivalryContext: buildRivalryContext(rivalry, roster, entries),
        },
      },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "suggestChapter", data._usage);
          const order = linked.length > 0 ? Math.max(...linked.map((c) => c.order)) + 1 : 0;
          const next: Chapter = {
            id: crypto.randomUUID(),
            rivalryId: rivalry.id,
            title: data.title,
            description: data.description,
            startDate: data.suggestedStartDate as UniverseDate,
            endDate: data.suggestedEndDate as UniverseDate | undefined,
            order,
          };
          updateChapters([next, ...chapters]);
          toast.success("Chapter suggested");
        },
        onError: () => {
          toast.error("Creative Overruled", { description: "Couldn't suggest a chapter. Try again." });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {linked.length} {linked.length === 1 ? "chapter" : "chapters"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-widest h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Add Chapter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={suggest.isPending || entries.length === 0}
            className="text-[10px] uppercase tracking-widest h-8"
            style={{ borderColor: BRAND_RED, color: BRAND_RED }}
          >
            {suggest.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Suggest Chapter
          </Button>
        </div>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <Input
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            placeholder="Chapter title (e.g. THE BETRAYAL)"
            className="bg-background border-border font-display tracking-widest uppercase"
          />
          <textarea
            value={addDesc}
            onChange={(e) => setAddDesc(e.target.value)}
            rows={3}
            placeholder="Optional description"
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setAddTitle(""); setAddDesc(""); }}>
              CANCEL
            </Button>
            <Button size="sm" onClick={handleAdd} className="bg-foreground text-background hover:bg-foreground/90">
              SAVE
            </Button>
          </div>
        </div>
      )}

      {linked.length === 0 && !adding ? (
        <div className="text-center py-12">
          <div className="font-display text-lg uppercase tracking-widest text-foreground mb-2">
            No chapters yet
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Group history into named arcs. Add one manually, or let the AI propose the next chapter from what's already happened.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {linked.map((c, i) => {
            const isEditing = editingId === c.id;
            return (
              <motion.div
                key={c.id}
                layout
                className="rounded-lg border border-border bg-background p-4"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="bg-background border-border font-display tracking-widest uppercase"
                    />
                    <textarea
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>CANCEL</Button>
                      <Button size="sm" onClick={() => handleSaveEdit(c.id)} className="bg-foreground text-background hover:bg-foreground/90">
                        SAVE
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-display text-sm uppercase tracking-widest text-foreground leading-tight">
                          {i + 1}. {c.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                          {formatDate(c.startDate)}
                          {c.endDate ? ` → ${formatDate(c.endDate)}` : ""}
                        </div>
                        {c.description && (
                          <p className="text-sm text-foreground/80 leading-relaxed mt-2 whitespace-pre-wrap">
                            {c.description}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => handleMove(c.id, -1)}
                          disabled={i === 0}
                          className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(c.id, 1)}
                          disabled={i === linked.length - 1}
                          className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-1 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditTitle(c.title);
                          setEditDesc(c.description ?? "");
                        }}
                        className="h-7 text-[10px] uppercase tracking-widest"
                      >
                        EDIT
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(c.id)}
                        className="h-7 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> DELETE
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemoriesTab({ rivalry, entries }: { rivalry: Rivalry; entries: RivalryEntry[] }) {
  const [roster] = useRoster();
  const [memories, setMemories] = useMemories();
  const [universeDate] = useUniverseDate();
  const baseContext = useAnalyzeBaseContext();
  const distill = useDistillMemories();
  const [tokenLog, setTokenLog] = useTokenLog();

  const linked = useMemo(
    () =>
      memories
        .filter((m) => m.rivalryId === rivalry.id)
        .slice()
        .sort((a, b) => compareDate(b.date, a.date)),
    [memories, rivalry.id],
  );

  const [adding, setAdding] = useState(false);
  const [addText, setAddText] = useState("");

  const overLimit = addText.length > MEMORY_MAX;

  const handleAdd = () => {
    const text = addText.trim();
    if (!text) {
      toast.error("Write a memory first.");
      return;
    }
    const next: Memory = {
      id: crypto.randomUUID(),
      rivalryId: rivalry.id,
      text: text.slice(0, MEMORY_MAX),
      date: universeDate,
      source: "manual",
    };
    setMemories([next, ...memories]);
    setAddText("");
    setAdding(false);
    toast.success("Memory pinned");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this memory?")) return;
    setMemories(memories.filter((m) => m.id !== id));
  };

  const handleDistill = () => {
    distill.mutate(
      {
        data: {
          ...baseContext,
          rivalryContext: buildRivalryContext(rivalry, roster, entries),
        },
      },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "distillMemories", data._usage);
          if (!data.memories || data.memories.length === 0) {
            toast.message("No new memories surfaced.");
            return;
          }
          const created: Memory[] = data.memories.map((m) => ({
            id: crypto.randomUUID(),
            rivalryId: rivalry.id,
            text: m.text.slice(0, MEMORY_MAX),
            date: m.date as UniverseDate,
            source: "ai" as const,
          }));
          setMemories([...created, ...memories]);
          toast.success(`${created.length} ${created.length === 1 ? "memory" : "memories"} distilled`);
        },
        onError: () => {
          toast.error("Creative Overruled", { description: "Couldn't distill memories. Try again." });
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {linked.length} {linked.length === 1 ? "memory" : "memories"}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
            className="text-[10px] uppercase tracking-widest h-8"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Pin Memory
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDistill}
            disabled={distill.isPending || entries.length === 0}
            className="text-[10px] uppercase tracking-widest h-8"
            style={{ borderColor: BRAND_RED, color: BRAND_RED }}
          >
            {distill.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
            )}
            Distill From History
          </Button>
        </div>
      </div>

      {adding && (
        <div className="rounded-lg border border-border bg-background p-4 space-y-2">
          <textarea
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            rows={3}
            placeholder="One sentence the wrestlers will reference forever."
            className="w-full bg-background border border-border rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-foreground resize-none"
          />
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: overLimit ? BRAND_RED : "var(--muted-foreground)" }}
            >
              {addText.length} / {MEMORY_MAX}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setAddText(""); }}>
                CANCEL
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={overLimit} className="bg-foreground text-background hover:bg-foreground/90">
                PIN
              </Button>
            </div>
          </div>
        </div>
      )}

      {linked.length === 0 && !adding ? (
        <div className="text-center py-12">
          <div className="font-display text-lg uppercase tracking-widest text-foreground mb-2">
            No memories yet
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Pin one-line moments wrestlers will reference forever — betrayals, costs, finishes. The AI will honor these in future bookings.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {linked.map((m) => (
            <motion.div
              key={m.id}
              layout
              className="rounded-lg border border-border bg-background p-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground/90 leading-relaxed">{m.text}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDate(m.date)}
                    </span>
                    {m.source === "ai" && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase"
                        style={{ color: BRAND_RED }}
                      >
                        <Sparkles className="w-2.5 h-2.5" /> AI
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(m.id)}
                  className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Arc Summary Badge (left pane mini widget) ─────────────────────────────

function ArcSummaryBadge({
  rivalryId,
  entries,
  onOpenArc,
}: {
  rivalryId: string;
  entries: RivalryEntry[];
  onOpenArc: () => void;
}) {
  const [allMilestones, setAllMilestones] = useFeuArcMilestones();

  const checkedSet = useMemo(() => {
    const ids = allMilestones[rivalryId] ?? [];
    return new Set<string>(ids);
  }, [allMilestones, rivalryId]);

  const chapterTypesSeen = useMemo(() => {
    const s = new Set<ChapterType>();
    for (const e of entries) if (e.chapter) s.add(e.chapter as ChapterType);
    return s;
  }, [entries]);

  const currentAct = deriveCurrentAct(chapterTypesSeen);
  const meta = ACT_META[currentAct];

  const overallDone = ARC_MILESTONES.filter((m) => checkedSet.has(m.id)).length;
  const overallTotal = ARC_MILESTONES.length;

  return (
    <button
      type="button"
      onClick={onOpenArc}
      className="w-full text-left group rounded-lg border border-border bg-muted/10 hover:bg-muted/20 hover:border-foreground/20 transition-all px-3 py-2.5 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: meta.color, boxShadow: `0 0 5px ${meta.color}60` }}
          />
          <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>
        <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">
          {overallDone}/{overallTotal} milestones
        </span>
      </div>

      <div className="w-full h-1 rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${overallTotal > 0 ? (overallDone / overallTotal) * 100 : 0}%`,
            background: meta.color,
          }}
        />
      </div>

      <div className="flex gap-1.5 pt-0.5">
        {ACTS.map((act) => {
          const { done, total } = actProgress(act, checkedSet);
          const m = ACT_META[act];
          const isActive = act === currentAct;
          return (
            <div
              key={act}
              className={cn(
                "flex-1 rounded px-1.5 py-1 text-center transition-all",
                isActive ? "bg-muted/30" : "opacity-50",
              )}
            >
              <div
                className="text-[9px] font-bold uppercase tracking-widest"
                style={{ color: isActive ? m.color : "var(--muted-foreground)" }}
              >
                {m.shortLabel}
              </div>
              <div className="text-[9px] text-muted-foreground/60 mt-0.5 tabular-nums">
                {done}/{total}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pt-0.5">
        <span className="text-[9px] text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors uppercase tracking-widest">
          Open Arc Planner →
        </span>
      </div>
    </button>
  );
}

// ── Arc Tab (full milestone map) ──────────────────────────────────────────

function ArcTab({
  rivalryId,
  entries,
}: {
  rivalryId: string;
  entries: RivalryEntry[];
}) {
  const [allMilestones, setAllMilestones] = useFeuArcMilestones();

  const checkedSet = useMemo(() => {
    const ids = allMilestones[rivalryId] ?? [];
    return new Set<string>(ids);
  }, [allMilestones, rivalryId]);

  const toggle = useCallback(
    (id: string) => {
      setAllMilestones((prev) => {
        const current = new Set<string>(prev[rivalryId] ?? []);
        current.has(id) ? current.delete(id) : current.add(id);
        return { ...prev, [rivalryId]: Array.from(current) };
      });
    },
    [rivalryId, setAllMilestones],
  );

  const chapterTypesSeen = useMemo(() => {
    const s = new Set<ChapterType>();
    for (const e of entries) if (e.chapter) s.add(e.chapter as ChapterType);
    return s;
  }, [entries]);

  const currentAct = deriveCurrentAct(chapterTypesSeen);

  const overallDone = ARC_MILESTONES.filter((m) => checkedSet.has(m.id)).length;
  const overallTotal = ARC_MILESTONES.length;
  const pct = overallTotal > 0 ? (overallDone / overallTotal) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-foreground mb-0.5">
            Feud Arc Planner
          </div>
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Check milestones as you book them. Acts are independent — skip any that don't fit your story.
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Overall progress</span>
            <span className="tabular-nums">{overallDone} / {overallTotal}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(to right, #3b82f6, #dc1e1e, #f59e0b)" }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      {ACTS.map((act) => {
        const meta = ACT_META[act];
        const milestones = ARC_MILESTONES.filter((m) => m.act === act);
        const { done, total } = actProgress(act, checkedSet);
        const isCurrentAct = act === currentAct;
        const allDone = done === total;

        return (
          <div key={act} className="space-y-3">
            <div className="flex items-center gap-3">
              <div
                className="flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0 transition-all"
                style={{
                  background: allDone ? meta.color : "transparent",
                  color: allDone ? "#000" : meta.color,
                  border: `1.5px solid ${meta.color}60`,
                }}
              >
                {allDone ? <Check className="w-3 h-3" /> : act.replace("ACT_", "")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="text-xs font-bold uppercase tracking-widest"
                    style={{ color: isCurrentAct ? meta.color : "var(--muted-foreground)" }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground/50 tabular-nums shrink-0">
                    {done}/{total}
                  </span>
                </div>
                <div className="mt-1 w-full h-1 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${total > 0 ? (done / total) * 100 : 0}%`,
                      background: meta.color,
                    }}
                  />
                </div>
              </div>
              {isCurrentAct && (
                <span
                  className="text-[8px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={{
                    background: `${meta.color}18`,
                    color: meta.color,
                    border: `1px solid ${meta.color}40`,
                  }}
                >
                  Current
                </span>
              )}
            </div>

            <div className="ml-9 space-y-1.5">
              {milestones.map((m) => {
                const checked = checkedSet.has(m.id);
                return (
                  <motion.button
                    key={m.id}
                    type="button"
                    onClick={() => toggle(m.id)}
                    whileTap={{ scale: 0.97 }}
                    className={cn(
                      "w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all",
                      checked
                        ? "border-transparent bg-muted/20"
                        : "border-border/60 bg-background hover:border-foreground/20 hover:bg-muted/10",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all",
                        checked ? "" : "border border-border/60",
                      )}
                      style={checked ? { background: meta.color } : {}}
                    >
                      {checked && <Check className="w-2.5 h-2.5 text-black" strokeWidth={3} />}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium transition-all",
                        checked ? "line-through text-muted-foreground/40" : "text-foreground/80",
                      )}
                    >
                      {m.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );
      })}

      <AnimatePresence>
        {overallDone === overallTotal && overallTotal > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-4 text-center"
          >
            <div className="text-amber-400 font-display text-sm uppercase tracking-widest font-bold">
              Story Complete
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              All milestones checked — time to conclude the rivalry.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
