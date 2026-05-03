import { useState, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Zap, Check, Plus, Trash2, Star, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  useRoster, useChampionships, useMatchResults, useHistory,
  useShows, useUniverseDate, type ShowResultsEntryData,
} from "@/lib/storage";
import type { MatchResult, MatchOutcome } from "@/lib/matches";
import type { Wrestler, Show } from "@workspace/api-client-react";
import { nightToDay } from "@/lib/calendar";
import { CreateRivalryDialog } from "@/components/RivalryDialogs";

const BRAND_RED = "#dc1e1e";

type FinishType = "CLEAN" | "ROLLUP" | "SUBMISSION" | "DQ" | "COUNTOUT" | "DRAW";

const FINISH_OPTIONS: { value: FinishType; label: string; outcome: MatchOutcome; hideWinner?: boolean }[] = [
  { value: "CLEAN",      label: "Clean",       outcome: "PIN" },
  { value: "ROLLUP",     label: "Rollup",      outcome: "PIN" },
  { value: "SUBMISSION", label: "Submission",  outcome: "SUBMISSION" },
  { value: "DQ",         label: "DQ",          outcome: "DQ" },
  { value: "COUNTOUT",   label: "Countout",    outcome: "COUNTOUT" },
  { value: "DRAW",       label: "Draw",        outcome: "DRAW", hideWinner: true },
];

interface QuickMatch {
  id: string;
  sideA: Wrestler | null;
  sideB: Wrestler | null;
  sideALabel: string;
  sideBLabel: string;
  winner: "A" | "B" | "DRAW" | null;
  finish: FinishType;
  stars: number;
  titleChanged: boolean;
}

function makeMatch(): QuickMatch {
  return {
    id: crypto.randomUUID(),
    sideA: null,
    sideB: null,
    sideALabel: "",
    sideBLabel: "",
    winner: null,
    finish: "CLEAN",
    stars: 0,
    titleChanged: false,
  };
}

// ─── Wrestler Search ──────────────────────────────────────────────────────────

function WrestlerSearch({
  label,
  value,
  roster,
  exclude,
  onSelect,
  onClear,
}: {
  label: string;
  value: Wrestler | null;
  roster: Wrestler[];
  exclude: string[];
  onSelect: (w: Wrestler) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return roster
      .filter((w) => !exclude.includes(w.id))
      .filter((w) => !q || w.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, roster, exclude]);

  if (value) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/10">
        <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border border-border/50">
          {value.imageUrl ? (
            <img src={value.imageUrl} alt={value.name} className="w-full h-full object-cover object-top" />
          ) : (
            <div className="w-full h-full bg-muted/40 flex items-center justify-center">
              <span className="text-sm font-bold text-muted-foreground/60">{value.name[0]}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-0.5">{label}</div>
          <div className="text-sm font-bold uppercase tracking-wide text-foreground truncate">{value.name}</div>
        </div>
        <button type="button" onClick={onClear} className="text-muted-foreground/50 hover:text-foreground transition-colors p-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-1">{label}</div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${label}…`}
        className="w-full px-3 py-2 rounded-lg border border-border bg-muted/10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-foreground/30"
        autoComplete="off"
      />
      {query.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground/50">No results</div>
          ) : (
            filtered.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => { onSelect(w); setQuery(""); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors text-left border-b border-border/40 last:border-0"
              >
                <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border/50">
                  {w.imageUrl ? (
                    <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                  ) : (
                    <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-muted-foreground/60">{w.name[0]}</span>
                    </div>
                  )}
                </div>
                <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">{w.name}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Star Picker ─────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? 0 : n)}
          className={cn(
            "text-lg transition-colors",
            n <= value ? "text-amber-400" : "text-muted-foreground/20 hover:text-amber-400/50"
          )}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs text-amber-400/70 font-bold ml-1">{value}★</span>
      )}
    </div>
  );
}

// ─── Show Selector ────────────────────────────────────────────────────────────

function ShowSelector({
  shows,
  universeDay,
  value,
  onChange,
}: {
  shows: Show[];
  universeDay: number | null;
  value: Show | null;
  onChange: (s: Show | null) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50">Show</div>
      <div className="grid gap-2">
        {shows.map((s) => {
          const isToday = universeDay !== null && nightToDay(s.night) === universeDay;
          const selected = value?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onChange(selected ? null : s)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
                selected
                  ? "border-foreground bg-foreground/8"
                  : "border-border hover:border-foreground/30 hover:bg-muted/10"
              )}
            >
              {s.imageUrl && (
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0">
                  <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold uppercase tracking-wide text-foreground truncate">{s.name}</div>
                {isToday && (
                  <div className="text-[9px] font-bold tracking-widest uppercase text-[#dc1e1e]/80 mt-0.5">Tonight</div>
                )}
              </div>
              {selected && <Check className="w-4 h-4 text-foreground shrink-0" />}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all text-left",
            !value
              ? "border-foreground bg-foreground/8"
              : "border-border hover:border-foreground/30 hover:bg-muted/10"
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold uppercase tracking-wide text-foreground">No Show / House Show</div>
          </div>
          {!value && <Check className="w-4 h-4 text-foreground shrink-0" />}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface QuickLogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultShow?: Show | null;
}

type Step = "setup" | "match" | "review" | "rate";

export function QuickLog({ open, onOpenChange, defaultShow }: QuickLogProps) {
  const [roster] = useRoster();
  const [, setMatchResults] = useMatchResults();
  const [, setHistory] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();

  const [step, setStep] = useState<Step>("setup");
  const [selectedShow, setSelectedShow] = useState<Show | null>(defaultShow ?? null);
  const [matches, setMatches] = useState<QuickMatch[]>([makeMatch()]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [startRivalryMatch, setStartRivalryMatch] = useState<MatchResult | null>(null);
  const [matchStars, setMatchStars] = useState(0);
  const [crowdStars, setCrowdStars] = useState(0);

  const universeDay = useMemo(() => universeDate?.day ?? null, [universeDate]);

  const resetAndClose = useCallback(() => {
    onOpenChange(false);
    setTimeout(() => {
      setStep("setup");
      setSelectedShow(defaultShow ?? null);
      setMatches([makeMatch()]);
      setCurrentIdx(0);
      setMatchStars(0);
      setCrowdStars(0);
    }, 300);
  }, [onOpenChange, defaultShow]);

  const currentMatch = matches[currentIdx];

  const updateMatch = useCallback((patch: Partial<QuickMatch>) => {
    setMatches((prev) => prev.map((m, i) => i === currentIdx ? { ...m, ...patch } : m));
  }, [currentIdx]);

  const currentFinishMeta = FINISH_OPTIONS.find((f) => f.value === (currentMatch?.finish ?? "CLEAN"))!;
  const isDraw = currentFinishMeta?.hideWinner;

  // ── validation ──
  const matchIsReady = useMemo(() => {
    if (!currentMatch) return false;
    const hasSides = (currentMatch.sideA || currentMatch.sideALabel.trim()) &&
                     (currentMatch.sideB || currentMatch.sideBLabel.trim());
    const hasWinner = isDraw || currentMatch.winner !== null;
    return hasSides && hasWinner;
  }, [currentMatch, isDraw]);

  const allMatchesComplete = useMemo(() => matches.every((m) => {
    const hasSides = (m.sideA || m.sideALabel.trim()) && (m.sideB || m.sideBLabel.trim());
    const hasDraw = FINISH_OPTIONS.find((f) => f.value === m.finish)?.hideWinner;
    const hasWinner = hasDraw || m.winner !== null;
    return hasSides && hasWinner;
  }), [matches]);

  // ── save matches (goes to rate step) ──
  const savedEntryRef = { id: "" };
  const handleSave = useCallback(() => {
    const show = selectedShow;
    const results: MatchResult[] = matches.map((m) => {
      const sideAId = crypto.randomUUID();
      const sideBId = crypto.randomUUID();
      const finishMeta = FINISH_OPTIONS.find((f) => f.value === m.finish)!;
      const isDraw = finishMeta.hideWinner;
      const winnerSideId = isDraw
        ? undefined
        : m.winner === "A" ? sideAId : m.winner === "B" ? sideBId : undefined;
      return {
        id: crypto.randomUUID(),
        date: universeDate,
        showId: show?.id,
        showName: show?.name,
        sides: [
          { id: sideAId, label: m.sideA?.name ?? m.sideALabel, wrestlerIds: m.sideA ? [m.sideA.id] : [] },
          { id: sideBId, label: m.sideB?.name ?? m.sideBLabel, wrestlerIds: m.sideB ? [m.sideB.id] : [] },
        ],
        winnerSideId,
        outcome: isDraw ? "DRAW" : finishMeta.outcome,
        finish: m.finish === "ROLLUP" ? "Rollup" : undefined,
        stars: m.stars > 0 ? m.stars : undefined,
        titleChanged: m.titleChanged || undefined,
      };
    });

    setMatchResults((prev) => [...prev, ...results]);

    const entryId = crypto.randomUUID();
    savedEntryRef.id = entryId;

    const entryData: ShowResultsEntryData = {
      showId: show?.id,
      showName: show?.name,
      showImageUrl: show?.imageUrl ?? undefined,
      matches: results,
    };

    setHistory((prev) => [
      {
        kind: "results",
        id: entryId,
        createdAt: Date.now(),
        universeDate,
        data: entryData,
      },
      ...prev,
    ]);

    setStep("rate");
  }, [matches, selectedShow, universeDate, setMatchResults, setHistory]);

  // ── save rating and close ──
  const handleSaveRating = useCallback((ms: number, cs: number) => {
    if (ms > 0 || cs > 0) {
      setHistory((prev) =>
        prev.map((entry) => {
          if (entry.kind !== "results") return entry;
          const data = entry.data as ShowResultsEntryData;
          if (
            data.showId === selectedShow?.id &&
            entry.universeDate?.year === universeDate?.year &&
            entry.universeDate?.month === universeDate?.month &&
            entry.universeDate?.week === universeDate?.week
          ) {
            return {
              ...entry,
              data: {
                ...data,
                matchStars: ms > 0 ? ms : undefined,
                crowdStars: cs > 0 ? cs : undefined,
              },
            };
          }
          return entry;
        })
      );
    }
    toast.success(`${matches.length} match${matches.length !== 1 ? "es" : ""} logged!`);
    resetAndClose();
  }, [selectedShow, universeDate, matches.length, setHistory, resetAndClose]);

  // ── navigation ──
  const goNext = () => {
    if (step === "setup") { setStep("match"); setCurrentIdx(0); return; }
    if (step === "match") {
      if (currentIdx < matches.length - 1) setCurrentIdx((i) => i + 1);
      else setStep("review");
    }
  };

  const goBack = () => {
    if (step === "match") {
      if (currentIdx > 0) setCurrentIdx((i) => i - 1);
      else setStep("setup");
    }
    if (step === "review") {
      setCurrentIdx(matches.length - 1);
      setStep("match");
    }
    if (step === "rate") {
      setStep("review");
    }
  };

  const addMatch = () => {
    setMatches((prev) => [...prev, makeMatch()]);
  };

  const removeMatch = (idx: number) => {
    if (matches.length <= 1) return;
    setMatches((prev) => prev.filter((_, i) => i !== idx));
    if (currentIdx >= idx && currentIdx > 0) setCurrentIdx((i) => i - 1);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground p-0 gap-0 max-w-lg w-full max-h-[92dvh] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="shrink-0">
            <div className="h-[3px] w-full" style={{ background: BRAND_RED }} />
            <div className="px-5 pt-4 pb-3 border-b border-border">
              <div className="flex items-center gap-2 mb-0.5">
                <Zap className="w-3.5 h-3.5 text-[#dc1e1e]" />
                <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/60">
                  Quick Log
                </span>
              </div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold uppercase tracking-widest text-foreground leading-tight">
                  {step === "setup" && "Select Show"}
                  {step === "match" && `Match ${currentIdx + 1} of ${matches.length}`}
                  {step === "review" && "Review & Save"}
                  {step === "rate" && "Rate the Show"}
                </h2>
                {step === "match" && (
                  <div className="flex items-center gap-1.5">
                    {matches.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentIdx(i)}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          i === currentIdx ? "bg-foreground scale-125" : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                        )}
                      />
                    ))}
                  </div>
                )}
              </div>
              {step === "match" && (
                <div className="mt-2 h-1 rounded-full bg-muted/20 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ background: BRAND_RED, width: `${((currentIdx + 1) / matches.length) * 100}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* ── Setup ── */}
            {step === "setup" && (
              <div className="p-5 space-y-6">
                <ShowSelector
                  shows={shows}
                  universeDay={universeDay}
                  value={selectedShow}
                  onChange={setSelectedShow}
                />
                <div className="space-y-2">
                  <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50">Matches on card</div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMatches((prev) => prev.length > 1 ? prev.slice(0, -1) : prev)}
                      disabled={matches.length <= 1}
                      className="w-10 h-10 rounded-lg border border-border hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors font-bold text-lg"
                    >
                      −
                    </button>
                    <span className="text-2xl font-display font-bold uppercase tracking-wider text-foreground w-8 text-center">
                      {matches.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setMatches((prev) => [...prev, makeMatch()])}
                      disabled={matches.length >= 12}
                      className="w-10 h-10 rounded-lg border border-border hover:border-foreground/30 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors font-bold text-lg"
                    >
                      +
                    </button>
                    <span className="text-xs text-muted-foreground/50">
                      {matches.length === 1 ? "match" : "matches"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ── Match Entry ── */}
            {step === "match" && currentMatch && (
              <div className="p-5 space-y-5">

                {/* Wrestler pickers */}
                <WrestlerSearch
                  label="Side A"
                  value={currentMatch.sideA}
                  roster={roster}
                  exclude={currentMatch.sideB ? [currentMatch.sideB.id] : []}
                  onSelect={(w) => updateMatch({ sideA: w, sideALabel: w.name })}
                  onClear={() => updateMatch({ sideA: null, sideALabel: "", winner: null })}
                />
                <WrestlerSearch
                  label="Side B"
                  value={currentMatch.sideB}
                  roster={roster}
                  exclude={currentMatch.sideA ? [currentMatch.sideA.id] : []}
                  onSelect={(w) => updateMatch({ sideB: w, sideBLabel: w.name })}
                  onClear={() => updateMatch({ sideB: null, sideBLabel: "", winner: null })}
                />

                {/* Who won — big tap targets */}
                {(currentMatch.sideA || currentMatch.sideB) && !isDraw && (
                  <div>
                    <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2">Who Won?</div>
                    <div className="grid grid-cols-2 gap-3">
                      {(["A", "B"] as const).map((side) => {
                        const wrestler = side === "A" ? currentMatch.sideA : currentMatch.sideB;
                        const label = side === "A"
                          ? (currentMatch.sideA?.name || currentMatch.sideALabel || "Side A")
                          : (currentMatch.sideB?.name || currentMatch.sideBLabel || "Side B");
                        const selected = currentMatch.winner === side;
                        return (
                          <button
                            key={side}
                            type="button"
                            onClick={() => updateMatch({ winner: selected ? null : side })}
                            className={cn(
                              "relative overflow-hidden rounded-xl border-2 transition-all p-3 flex flex-col items-center gap-2 min-h-[96px]",
                              selected
                                ? "border-emerald-400 bg-emerald-400/10"
                                : "border-border bg-muted/5 hover:border-foreground/30 hover:bg-muted/10"
                            )}
                          >
                            {wrestler?.imageUrl && (
                              <div className="w-14 h-14 rounded-lg overflow-hidden border border-border/50">
                                <img src={wrestler.imageUrl} alt={label} className="w-full h-full object-cover object-top" />
                              </div>
                            )}
                            {!wrestler?.imageUrl && (
                              <div className="w-14 h-14 rounded-lg border border-border/50 bg-muted/30 flex items-center justify-center">
                                <span className="text-lg font-bold text-muted-foreground/40">{label[0]}</span>
                              </div>
                            )}
                            <span className={cn(
                              "text-[10px] font-bold uppercase tracking-wide text-center leading-tight",
                              selected ? "text-emerald-400" : "text-foreground/80"
                            )}>
                              {label}
                            </span>
                            {selected && (
                              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center">
                                <Check className="w-3 h-3 text-black" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Finish type */}
                <div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2">How?</div>
                  <div className="flex flex-wrap gap-2">
                    {FINISH_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => updateMatch({
                          finish: f.value,
                          winner: f.hideWinner ? null : currentMatch.winner,
                        })}
                        className={cn(
                          "px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
                          currentMatch.finish === f.value
                            ? "border-foreground bg-foreground text-background"
                            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stars */}
                <div>
                  <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 mb-2">Rating (optional)</div>
                  <StarPicker value={currentMatch.stars} onChange={(n) => updateMatch({ stars: n })} />
                </div>

                {/* Title changed */}
                <button
                  type="button"
                  onClick={() => updateMatch({ titleChanged: !currentMatch.titleChanged })}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all",
                    currentMatch.titleChanged
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  🏆 Title Changed Hands
                </button>
              </div>
            )}

            {/* ── Review ── */}
            {step === "review" && (
              <div className="p-5 space-y-3">
                <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-4">
                  {selectedShow?.name ?? "House Show"} · {matches.length} match{matches.length !== 1 ? "es" : ""}
                </div>
                {matches.map((m, i) => {
                  const finishMeta = FINISH_OPTIONS.find((f) => f.value === m.finish)!;
                  const isDraw = finishMeta.hideWinner;
                  const winnerName = isDraw
                    ? "Draw"
                    : m.winner === "A"
                      ? (m.sideA?.name || m.sideALabel || "Side A")
                      : m.winner === "B"
                        ? (m.sideB?.name || m.sideBLabel || "Side B")
                        : "No winner";
                  const sideAName = m.sideA?.name || m.sideALabel || "?";
                  const sideBName = m.sideB?.name || m.sideBLabel || "?";
                  const complete = (m.sideA || m.sideALabel) && (m.sideB || m.sideBLabel) && (isDraw || m.winner);

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border overflow-hidden",
                        complete ? "border-border" : "border-amber-400/30"
                      )}
                    >
                      <div className="px-4 py-2 bg-muted/10 border-b border-border/50 flex items-center justify-between">
                        <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                          Match {i + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {m.stars > 0 && (
                            <span className="text-[9px] text-amber-400 font-bold">{m.stars}★</span>
                          )}
                          {m.titleChanged && (
                            <span className="text-[9px] text-amber-400 font-bold">Title Change</span>
                          )}
                          <button
                            type="button"
                            onClick={() => { setCurrentIdx(i); setStep("match"); }}
                            className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50 hover:text-foreground transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMatch(i)}
                            disabled={matches.length <= 1}
                            className="text-muted-foreground/40 hover:text-red-400 transition-colors disabled:opacity-20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          {m.sideA?.imageUrl && (
                            <img src={m.sideA.imageUrl} alt={sideAName} className="w-6 h-6 rounded-full object-cover object-top border border-border/50" />
                          )}
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-wide",
                            m.winner === "A" && !isDraw ? "text-emerald-400" : "text-foreground/80"
                          )}>
                            {sideAName}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40 font-bold">vs</span>
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-wide",
                            m.winner === "B" && !isDraw ? "text-emerald-400" : "text-foreground/80"
                          )}>
                            {sideBName}
                          </span>
                          {m.sideB?.imageUrl && (
                            <img src={m.sideB.imageUrl} alt={sideBName} className="w-6 h-6 rounded-full object-cover object-top border border-border/50" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {complete ? (
                            <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                              W: {winnerName}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold tracking-widest uppercase text-amber-400/70">
                              Incomplete
                            </span>
                          )}
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">
                            {finishMeta.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={addMatch}
                  disabled={matches.length >= 12}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border hover:border-foreground/30 hover:bg-muted/10 transition-colors text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
                >
                  <Plus className="w-3 h-3" />
                  Add Match
                </button>
              </div>
            )}
            {/* ── Rate ── */}
            {step === "rate" && (
              <div className="p-5 flex flex-col items-center gap-8">
                <div className="text-center space-y-1 pt-2">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">
                    {selectedShow?.name ?? "House Show"} · {matches.length} match{matches.length !== 1 ? "es" : ""} logged
                  </div>
                  <div className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">
                    Rate the show — optional, skip to close
                  </div>
                </div>

                <div className="w-full space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">Match Quality</span>
                      {matchStars > 0 && <span className="text-xs font-black text-amber-400">{matchStars}★</span>}
                    </div>
                    <div className="flex justify-center gap-3">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setMatchStars(matchStars === n ? 0 : n)}
                          className={cn(
                            "text-4xl transition-all duration-150 hover:scale-110",
                            n <= matchStars ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" : "text-muted-foreground/15 hover:text-amber-400/40"
                          )}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="h-px bg-border/30" />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">Crowd Heat</span>
                      {crowdStars > 0 && <span className="text-xs font-black text-orange-400">{crowdStars}★</span>}
                    </div>
                    <div className="flex justify-center gap-3">
                      {[1,2,3,4,5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setCrowdStars(crowdStars === n ? 0 : n)}
                          className={cn(
                            "text-4xl transition-all duration-150 hover:scale-110",
                            n <= crowdStars ? "text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.5)]" : "text-muted-foreground/15 hover:text-orange-400/40"
                          )}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer nav */}
          <div className="shrink-0 px-5 py-4 border-t border-border bg-muted/5 flex items-center gap-3">
            <button
              type="button"
              onClick={step === "setup" ? resetAndClose : step === "rate" ? () => handleSaveRating(0, 0) : goBack}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border hover:border-foreground/30 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              {step === "setup" ? "Cancel" : step === "rate" ? "Skip" : "Back"}
            </button>

            <div className="flex-1" />

            {step === "review" ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={!allMatchesComplete}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Check className="w-3.5 h-3.5" />
                Save {matches.length} Match{matches.length !== 1 ? "es" : ""}
              </button>
            ) : step === "rate" ? (
              <button
                type="button"
                onClick={() => handleSaveRating(matchStars, crowdStars)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                {matchStars > 0 || crowdStars > 0 ? "Save Rating" : "Done"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={step === "match" && !matchIsReady}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                {step === "setup" ? "Start" : currentIdx < matches.length - 1 ? "Next" : "Review"}
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {startRivalryMatch && (
        <CreateRivalryDialog
          open={!!startRivalryMatch}
          onOpenChange={(o) => { if (!o) setStartRivalryMatch(null); }}
          initialSideA={startRivalryMatch.sides[0]?.wrestlerIds ?? []}
          initialSideALabel={startRivalryMatch.sides[0]?.label ?? ""}
          initialSideB={startRivalryMatch.sides[1]?.wrestlerIds ?? []}
          initialSideBLabel={startRivalryMatch.sides[1]?.label ?? ""}
        />
      )}
    </>
  );
}
