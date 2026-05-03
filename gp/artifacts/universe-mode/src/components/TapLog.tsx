import { useState, useMemo } from "react";
import { ChevronLeft, Check, Zap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  a: Wrestler;
  b: Wrestler;
  winnerId: string;
}

interface TapLogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

// ─── Wrestler Photo Card ──────────────────────────────────────────────────────

function RosterCard({
  wrestler,
  highlight,
  dimmed,
  large,
  onClick,
}: {
  wrestler: Wrestler;
  highlight?: "a" | "b" | "winner";
  dimmed?: boolean;
  large?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative rounded-lg overflow-hidden border-2 flex flex-col items-center gap-1 transition-all active:scale-95",
        large ? "p-3" : "p-1.5",
        highlight === "a" && "border-[#dc1e1e] bg-[#dc1e1e]/10 ring-2 ring-[#dc1e1e]/20",
        highlight === "b" && "border-blue-400 bg-blue-400/10 ring-2 ring-blue-400/20",
        highlight === "winner" && "border-emerald-400 bg-emerald-400/10 ring-2 ring-emerald-400/20",
        !highlight && !dimmed && "border-white/10 bg-white/4 hover:border-white/30 hover:bg-white/8",
        !highlight && dimmed && "border-white/5 bg-white/2 opacity-30",
      )}
    >
      <div className={cn("w-full rounded overflow-hidden", large ? "aspect-[3/4]" : "aspect-[3/4]")}>
        {wrestler.imageUrl ? (
          <img
            src={wrestler.imageUrl}
            alt={wrestler.name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full bg-white/10 flex items-center justify-center">
            <span className={cn("font-bold text-white/40", large ? "text-4xl" : "text-base")}>
              {wrestler.name[0]}
            </span>
          </div>
        )}
      </div>
      <span
        className={cn(
          "font-bold uppercase tracking-wide text-center leading-tight line-clamp-2 w-full",
          large ? "text-xs text-white/90 mt-1" : "text-[9px] text-white/60",
        )}
      >
        {wrestler.name}
      </span>
      {/* Phase badge */}
      {highlight === "a" && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#dc1e1e] flex items-center justify-center shadow">
          <span className="text-[9px] font-bold text-white leading-none">A</span>
        </div>
      )}
      {highlight === "b" && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-blue-400 flex items-center justify-center shadow">
          <span className="text-[9px] font-bold text-white leading-none">B</span>
        </div>
      )}
      {highlight === "winner" && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center shadow">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      {/* Large layout: winner label */}
      {large && (
        <div
          className={cn(
            "mt-1 text-[10px] font-bold tracking-[0.2em] uppercase transition-colors",
            highlight === "winner" ? "text-emerald-400" : "text-white/30",
          )}
        >
          {highlight === "winner" ? "Winner" : "Tap to win"}
        </div>
      )}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TapLog({ open, onOpenChange }: TapLogProps) {
  const [roster] = useRoster();
  const [, setMatchResults] = useMatchResults();
  const [, setHistory] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();

  const [phase, setPhase] = useState<Phase>("picking-a");
  const [pendingA, setPendingA] = useState<Wrestler | null>(null);
  const [pendingB, setPendingB] = useState<Wrestler | null>(null);
  const [completed, setCompleted] = useState<CompletedMatch[]>([]);

  const tonightShow = useMemo<Show | null>(() => {
    if (!universeDate || shows.length === 0) return null;
    return shows.find((s) => nightToDay(s.night) === universeDate.day) ?? null;
  }, [shows, universeDate]);

  // IDs already logged in completed matches this session
  const usedIds = useMemo(() => {
    const s = new Set<string>();
    for (const m of completed) {
      s.add(m.a.id);
      s.add(m.b.id);
    }
    return s;
  }, [completed]);

  // ── Tap handler ─────────────────────────────────────────────────────────────
  const handleTap = (wrestler: Wrestler) => {
    if (phase === "picking-a") {
      setPendingA(wrestler);
      setPhase("picking-b");
      return;
    }
    if (phase === "picking-b") {
      if (wrestler.id === pendingA?.id) {
        // deselect A
        setPendingA(null);
        setPhase("picking-a");
        return;
      }
      setPendingB(wrestler);
      setPhase("picking-winner");
      return;
    }
    if (phase === "picking-winner") {
      if (wrestler.id !== pendingA?.id && wrestler.id !== pendingB?.id) return;
      setCompleted((prev) => [
        ...prev,
        { a: pendingA!, b: pendingB!, winnerId: wrestler.id },
      ]);
      setPendingA(null);
      setPendingB(null);
      setPhase("picking-a");
    }
  };

  // ── Back / undo ──────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (phase === "picking-winner") {
      setPendingB(null);
      setPhase("picking-b");
      return;
    }
    if (phase === "picking-b") {
      setPendingA(null);
      setPhase("picking-a");
      return;
    }
    if (phase === "picking-a" && completed.length > 0) {
      setCompleted((prev) => prev.slice(0, -1));
    }
  };

  const canGoBack =
    phase !== "picking-a" || completed.length > 0;

  // ── File show ────────────────────────────────────────────────────────────────
  const handleFileShow = () => {
    if (completed.length === 0) return;
    const show = tonightShow;

    const results = completed.map((m) => {
      const sideAId = crypto.randomUUID();
      const sideBId = crypto.randomUUID();
      const winnerSideId = m.winnerId === m.a.id ? sideAId : sideBId;
      return {
        id: crypto.randomUUID(),
        date: universeDate,
        showId: show?.id,
        showName: show?.name,
        sides: [
          { id: sideAId, label: m.a.name, wrestlerIds: [m.a.id] },
          { id: sideBId, label: m.b.name, wrestlerIds: [m.b.id] },
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
      {
        kind: "results",
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        universeDate,
        data: entryData,
      },
      ...prev,
    ]);

    toast.success(
      `${completed.length} match${completed.length !== 1 ? "es" : ""} filed.`,
      { description: show ? show.name : "Show results saved." },
    );

    close();
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(() => {
      setPhase("picking-a");
      setPendingA(null);
      setPendingB(null);
      setCompleted([]);
    }, 300);
  };

  // ── Derived display values ───────────────────────────────────────────────────
  const phaseLabel =
    phase === "picking-a"
      ? "Tap a wrestler"
      : phase === "picking-b"
        ? "Tap their opponent"
        : "Tap the winner";

  const isPickingWinner = phase === "picking-winner";

  // In winner-pick phase, show only the two combatants as big cards
  // Otherwise show full roster (used wrestlers dimmed but still tappable)
  const displayRoster = useMemo(() => {
    if (isPickingWinner) return [pendingA!, pendingB!].filter(Boolean);
    // Sort: used wrestlers sink to bottom
    return [...roster].sort((a, b) => {
      const aUsed = usedIds.has(a.id) ? 1 : 0;
      const bUsed = usedIds.has(b.id) ? 1 : 0;
      return aUsed - bUsed;
    });
  }, [roster, usedIds, isPickingWinner, pendingA, pendingB]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="bg-card border-border text-foreground p-0 gap-0 max-w-md w-full max-h-[96dvh] flex flex-col overflow-hidden rounded-xl">

        {/* ── Top bar ── */}
        <div className="shrink-0">
          <div className="h-[3px] w-full" style={{ background: BRAND_RED }} />

          <div className="px-4 pt-3 pb-3 border-b border-white/8 flex items-center gap-3">
            {/* Back / undo */}
            <button
              type="button"
              onClick={handleBack}
              disabled={!canGoBack}
              className="p-1 -ml-1 text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:pointer-events-none transition-colors shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Title */}
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

            {/* File button */}
            {completed.length > 0 && (
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
            {(["picking-a", "picking-b", "picking-winner"] as Phase[]).map((p) => {
              const phaseOrder = { "picking-a": 0, "picking-b": 1, "picking-winner": 2 };
              const current = phaseOrder[phase];
              const thisIdx = phaseOrder[p];
              const isActive = phase === p;
              const isPast = thisIdx < current;
              return (
                <div
                  key={p}
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-all duration-300",
                    isActive ? "opacity-100" : isPast ? "opacity-40" : "opacity-10",
                  )}
                  style={{ background: BRAND_RED }}
                />
              );
            })}
          </div>

          {/* Completed matches strip */}
          {completed.length > 0 && (
            <div className="border-t border-white/5 px-3 py-2 flex gap-2 overflow-x-auto">
              {completed.map((m, i) => {
                const winner = m.winnerId === m.a.id ? m.a : m.b;
                const loser = m.winnerId === m.a.id ? m.b : m.a;
                return (
                  <div
                    key={i}
                    className="shrink-0 flex items-center gap-1.5 bg-white/5 rounded px-2.5 py-1"
                  >
                    <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wide">
                      {winner.name}
                    </span>
                    <span className="text-[9px] text-white/20">def.</span>
                    <span className="text-[9px] text-white/35 uppercase tracking-wide">
                      {loser.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Roster grid / winner picker ── */}
        <div className="flex-1 overflow-y-auto p-3">
          {roster.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2">
              <span className="text-sm text-white/30 font-bold uppercase tracking-wider">
                No roster yet
              </span>
              <span className="text-xs text-white/20">
                Add superstars in the Roster tab first.
              </span>
            </div>
          ) : isPickingWinner ? (
            /* ── Winner picker: two big portrait cards ── */
            <div className="grid grid-cols-2 gap-4 px-2 py-4">
              {displayRoster.map((w) => (
                <RosterCard
                  key={w.id}
                  wrestler={w}
                  large
                  highlight={undefined}
                  onClick={() => handleTap(w)}
                />
              ))}
            </div>
          ) : (
            /* ── Full roster grid ── */
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {displayRoster.map((w) => {
                let highlight: "a" | "b" | undefined;
                if (w.id === pendingA?.id) highlight = "a";
                if (w.id === pendingB?.id) highlight = "b";
                const dimmed = usedIds.has(w.id) && !highlight;
                return (
                  <RosterCard
                    key={w.id}
                    wrestler={w}
                    highlight={highlight}
                    dimmed={dimmed}
                    onClick={() => handleTap(w)}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* ── Bottom hint ── */}
        <div className="shrink-0 border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
          <span className="text-[9px] text-white/20 tracking-widest uppercase">
            {isPickingWinner
              ? "Tap the winner"
              : phase === "picking-b"
                ? "Tap their opponent — or tap them again to deselect"
                : completed.length > 0
                  ? "Tap a wrestler to log another match"
                  : "Tap a wrestler to start a match"}
          </span>
          {completed.length > 0 && !isPickingWinner && phase === "picking-a" && (
            <button
              type="button"
              onClick={() => setCompleted((prev) => prev.slice(0, -1))}
              className="flex items-center gap-1 text-[9px] text-white/20 hover:text-white/50 transition-colors tracking-widest uppercase"
            >
              <RotateCcw className="w-3 h-3" />
              Undo
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
