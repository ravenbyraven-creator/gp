import { useState, useMemo } from "react";
import { ChevronLeft, Check, Zap, RotateCcw, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  useRoster,
  useMatchResults,
  useHistory,
  useShows,
  useUniverseDate,
  type ShowResultsEntryData,
} from "@/lib/storage";
import type { Wrestler, Show } from "@workspace/api-client-react";
import { nightToDay } from "@/lib/calendar";

const BRAND_RED = "#dc1e1e";

type Phase = "picking-a" | "picking-b" | "picking-winner";

interface CompletedMatch {
  sideA: Wrestler[];
  sideB: Wrestler[];
  winningSide: "a" | "b";
}

interface TapLogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Roster photo card ─────────────────────────────────────────────────────────

function RosterCard({
  wrestler,
  state,
  onClick,
}: {
  wrestler: Wrestler;
  state: "idle" | "in-a" | "in-b" | "used";
  onClick: () => void;
}) {
  const dimmed = state === "used";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden border-2 flex flex-col items-center gap-1 p-1.5 transition-all active:scale-95",
        state === "in-a" && "border-[#dc1e1e] bg-[#dc1e1e]/10 ring-2 ring-[#dc1e1e]/20",
        state === "in-b" && "border-blue-400 bg-blue-400/10 ring-2 ring-blue-400/20",
        state === "idle" && "border-white/10 bg-white/4 hover:border-white/30 hover:bg-white/8",
        dimmed && "border-white/5 bg-white/2 opacity-25",
      )}
    >
      <div className="w-full aspect-[3/4] rounded overflow-hidden">
        {wrestler.imageUrl ? (
          <img
            src={wrestler.imageUrl}
            alt={wrestler.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <span className="text-base font-bold text-white/40">{wrestler.name[0]}</span>
          </div>
        )}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wide text-center leading-tight line-clamp-2 w-full text-white/60">
        {wrestler.name}
      </span>

      {state === "in-a" && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#dc1e1e] flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      {state === "in-b" && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
    </button>
  );
}

// ─── Side card (for winner-pick phase) ────────────────────────────────────────

function SideCard({
  wrestlers,
  label,
  accent,
  isWinner,
  onClick,
}: {
  wrestlers: Wrestler[];
  label: string;
  accent: string;
  isWinner: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-xl border-2 flex flex-col items-center gap-3 p-4 transition-all active:scale-95",
        isWinner
          ? "border-emerald-400 bg-emerald-400/10 ring-2 ring-emerald-400/20"
          : "border-white/15 bg-white/4 hover:border-white/40 hover:bg-white/8",
      )}
    >
      <div className={cn("text-[9px] font-bold tracking-[0.3em] uppercase", isWinner ? "text-emerald-400" : "text-white/30")}>
        {isWinner ? "WINNER" : "Tap to win"}
      </div>

      {/* Photos */}
      <div className="flex flex-wrap justify-center gap-2">
        {wrestlers.map((w) => (
          <div key={w.id} className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-lg overflow-hidden border border-white/20">
              {w.imageUrl ? (
                <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-white/40">{w.name[0]}</span>
                </div>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/60 text-center max-w-[72px] line-clamp-2 leading-tight">
              {w.name}
            </span>
          </div>
        ))}
      </div>

      {isWinner && <Check className="w-5 h-5 text-emerald-400" />}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TapLog({ open, onOpenChange }: TapLogProps) {
  const [roster] = useRoster();
  const [, setMatchResults] = useMatchResults();
  const [, setHistory] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();

  const [phase, setPhase] = useState<Phase>("picking-a");
  const [sideA, setSideA] = useState<Wrestler[]>([]);
  const [sideB, setSideB] = useState<Wrestler[]>([]);
  const [winningSide, setWinningSide] = useState<"a" | "b" | null>(null);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);

  const tonightShow = useMemo<Show | null>(() => {
    if (!universeDate || shows.length === 0) return null;
    return shows.find((s) => nightToDay(s.night) === universeDate.day) ?? null;
  }, [shows, universeDate]);

  // IDs used in completed matches (greyed out)
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of completed) {
      m.sideA.forEach((w) => s.add(w.id));
      m.sideB.forEach((w) => s.add(w.id));
    }
    return s;
  }, [completed]);

  const sideAIds = useMemo(() => new Set(sideA.map((w) => w.id)), [sideA]);
  const sideBIds = useMemo(() => new Set(sideB.map((w) => w.id)), [sideB]);

  // ── Tap a roster card ────────────────────────────────────────────────────────
  const handleTap = (wrestler: Wrestler) => {
    if (phase === "picking-a") {
      if (sideAIds.has(wrestler.id)) {
        setSideA((prev) => prev.filter((w) => w.id !== wrestler.id));
      } else if (!usedIds.has(wrestler.id)) {
        setSideA((prev) => [...prev, wrestler]);
      }
    } else if (phase === "picking-b") {
      if (sideAIds.has(wrestler.id)) return; // can't re-use side A member
      if (sideBIds.has(wrestler.id)) {
        setSideB((prev) => prev.filter((w) => w.id !== wrestler.id));
      } else if (!usedIds.has(wrestler.id)) {
        setSideB((prev) => [...prev, wrestler]);
      }
    }
  };

  // ── Lock in side A → go to picking-b ────────────────────────────────────────
  const lockSideA = () => {
    if (sideA.length === 0) return;
    setPhase("picking-b");
  };

  // ── Lock in side B → go to picking-winner ───────────────────────────────────
  const lockSideB = () => {
    if (sideB.length === 0) return;
    setWinningSide(null);
    setPhase("picking-winner");
  };

  // ── Pick winner and confirm match ────────────────────────────────────────────
  const handlePickWinner = (side: "a" | "b") => {
    setWinningSide(side);
    // small delay for visual feedback before committing
    setTimeout(() => {
      setCompleted((prev) => [...prev, { sideA, sideB, winningSide: side }]);
      setSideA([]);
      setSideB([]);
      setWinningSide(null);
      setPhase("picking-a");
    }, 180);
  };

  // ── Back / undo ──────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (phase === "picking-winner") { setSideB([]); setPhase("picking-b"); return; }
    if (phase === "picking-b") { setSideA([]); setPhase("picking-a"); return; }
    if (phase === "picking-a" && completed.length > 0) {
      setCompleted((prev) => prev.slice(0, -1));
    }
  };

  const canGoBack = phase !== "picking-a" || completed.length > 0;

  // ── File show ────────────────────────────────────────────────────────────────
  const handleFileShow = () => {
    if (completed.length === 0) return;
    const show = tonightShow;

    const results = completed.map((m) => {
      const sideAId = crypto.randomUUID();
      const sideBId = crypto.randomUUID();
      const winnerSideId = m.winningSide === "a" ? sideAId : sideBId;
      return {
        id: crypto.randomUUID(),
        date: universeDate,
        showId: show?.id,
        showName: show?.name,
        sides: [
          { id: sideAId, label: m.sideA.map((w) => w.name).join(" & "), wrestlerIds: m.sideA.map((w) => w.id) },
          { id: sideBId, label: m.sideB.map((w) => w.name).join(" & "), wrestlerIds: m.sideB.map((w) => w.id) },
        ],
        winnerSideId,
        outcome: "PIN" as const,
      };
    });

    setMatchResults((prev) => [...prev, ...results]);

    const entryData: ShowResultsEntryData = {
      showId: show?.id,
      showName: show?.name,
      showImageUrl: show?.imageUrl ?? undefined,
      matches: results,
    };

    setHistory((prev) => [
      { kind: "results", id: crypto.randomUUID(), createdAt: Date.now(), universeDate, data: entryData },
      ...prev,
    ]);

    toast.success(
      `${completed.length} match${completed.length !== 1 ? "es" : ""} filed.`,
      { description: show ? show.name : "Show results saved." },
    );
    doClose();
  };

  const doClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setPhase("picking-a");
      setSideA([]);
      setSideB([]);
      setWinningSide(null);
      setCompleted([]);
    }, 300);
  };

  // ── Derived UI labels ─────────────────────────────────────────────────────────
  const phaseLabel =
    phase === "picking-a" ? "Who's in the match?" :
    phase === "picking-b" ? "Their opponent(s)?" :
    "Who won?";

  const phaseHint =
    phase === "picking-a" ? (sideA.length === 0 ? "Tap to add — tap again to remove" : `${sideA.length} selected — tap more or lock in`) :
    phase === "picking-b" ? (sideB.length === 0 ? "Tap to add — tap again to remove" : `${sideB.length} selected — tap more or lock in`) :
    "Tap the winning side";

  const isPickingWinner = phase === "picking-winner";

  // Roster sorted: current selection first, used last
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const aSelected = sideAIds.has(a.id) || sideBIds.has(a.id) ? -1 : 0;
      const bSelected = sideAIds.has(b.id) || sideBIds.has(b.id) ? -1 : 0;
      const aUsed = usedIds.has(a.id) && !sideAIds.has(a.id) && !sideBIds.has(a.id) ? 1 : 0;
      const bUsed = usedIds.has(b.id) && !sideAIds.has(b.id) && !sideBIds.has(b.id) ? 1 : 0;
      return (aSelected + aUsed) - (bSelected + bUsed);
    });
  }, [roster, sideAIds, sideBIds, usedIds]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={doClose}>
      <DialogContent className="bg-card border-border text-foreground p-0 gap-0 max-w-md w-full max-h-[96dvh] flex flex-col overflow-hidden rounded-xl">
        <DialogTitle className="sr-only">File Show</DialogTitle>

        {/* ── Top bar ── */}
        <div className="shrink-0">
          <div className="h-[3px] w-full" style={{ background: BRAND_RED }} />

          <div className="px-4 pt-3 pb-3 border-b border-white/8 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-1 -ml-1 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-[#dc1e1e] shrink-0" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">
                  {tonightShow?.name ?? "File Show"}
                </span>
              </div>
              <div className="font-display text-base font-bold uppercase tracking-widest text-foreground leading-tight mt-0.5">
                {phaseLabel}
              </div>
            </div>

            {completed.length > 0 && !isPickingWinner && (
              <button
                type="button"
                onClick={handleFileShow}
                className="shrink-0 px-4 py-2 rounded text-[11px] font-bold tracking-[0.15em] uppercase text-white transition-colors"
                style={{ background: BRAND_RED }}
              >
                File · {completed.length}
              </button>
            )}
          </div>

          {/* Phase step track */}
          <div className="px-4 py-2.5 flex gap-1.5">
            {(["picking-a", "picking-b", "picking-winner"] as Phase[]).map((p, i) => {
              const order = { "picking-a": 0, "picking-b": 1, "picking-winner": 2 };
              const current = order[phase];
              const isActive = phase === p;
              const isPast = i < current;
              return (
                <div
                  key={p}
                  className="h-0.5 flex-1 rounded-full transition-all duration-300"
                  style={{
                    background: BRAND_RED,
                    opacity: isActive ? 1 : isPast ? 0.35 : 0.1,
                  }}
                />
              );
            })}
          </div>

          {/* Completed matches strip */}
          {completed.length > 0 && (
            <div className="border-t border-white/5 px-3 py-2 flex gap-2 overflow-x-auto">
              {completed.map((m, i) => {
                const winner = m.winningSide === "a" ? m.sideA : m.sideB;
                const loser = m.winningSide === "a" ? m.sideB : m.sideA;
                const winnerLabel = winner.map((w) => w.name).join(" & ");
                const loserLabel = loser.map((w) => w.name).join(" & ");
                return (
                  <div key={i} className="shrink-0 flex items-center gap-1.5 bg-white/5 rounded px-2.5 py-1">
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">{winnerLabel}</span>
                    <span className="text-[9px] text-white/20">def.</span>
                    <span className="text-[9px] text-white/35 uppercase tracking-wide">{loserLabel}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          {roster.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 p-8 text-center">
              <span className="text-sm text-white/30 font-bold uppercase tracking-wider">No roster yet</span>
              <span className="text-xs text-white/20">Add superstars in the Roster tab first.</span>
            </div>
          ) : isPickingWinner ? (
            /* ── Winner picker: two full side cards ── */
            <div className="p-4 flex gap-3 min-h-[240px]">
              <SideCard
                wrestlers={sideA}
                label="Side A"
                accent={BRAND_RED}
                isWinner={winningSide === "a"}
                onClick={() => handlePickWinner("a")}
              />
              <div className="flex flex-col items-center justify-center shrink-0">
                <span className="text-xs font-bold text-white/20 tracking-widest uppercase">vs</span>
              </div>
              <SideCard
                wrestlers={sideB}
                label="Side B"
                accent="#60a5fa"
                isWinner={winningSide === "b"}
                onClick={() => handlePickWinner("b")}
              />
            </div>
          ) : (
            /* ── Roster grid ── */
            <div className="p-3 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {sortedRoster.map((w) => {
                let state: "idle" | "in-a" | "in-b" | "used" = "idle";
                if (sideAIds.has(w.id)) state = "in-a";
                else if (sideBIds.has(w.id)) state = "in-b";
                else if (usedIds.has(w.id)) state = "used";
                return (
                  <RosterCard key={w.id} wrestler={w} state={state} onClick={() => handleTap(w)} />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bottom action bar ── */}
        {!isPickingWinner && (
          <div className="shrink-0 border-t border-white/8 px-4 py-3 flex items-center justify-between gap-3">
            <span className="text-[9px] text-white/25 tracking-widest uppercase flex-1 min-w-0">
              {phaseHint}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              {phase === "picking-a" && completed.length > 0 && sideA.length === 0 && (
                <button
                  type="button"
                  onClick={() => setCompleted((prev) => prev.slice(0, -1))}
                  className="flex items-center gap-1 text-[9px] text-white/20 hover:text-white/50 transition-colors tracking-widest uppercase"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              )}
              {phase === "picking-a" && sideA.length > 0 && (
                <button
                  type="button"
                  onClick={lockSideA}
                  className="px-4 py-2 rounded text-[10px] font-bold tracking-[0.15em] uppercase text-white transition-colors"
                  style={{ background: BRAND_RED }}
                >
                  Next →
                </button>
              )}
              {phase === "picking-b" && sideB.length > 0 && (
                <button
                  type="button"
                  onClick={lockSideB}
                  className="px-4 py-2 rounded text-[10px] font-bold tracking-[0.15em] uppercase bg-blue-500 text-white hover:bg-blue-400 transition-colors"
                >
                  Who Won?
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
