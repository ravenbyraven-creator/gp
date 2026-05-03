import { useState, useMemo } from "react";
import { CheckCircle2, Circle, MoreVertical, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useShowDrafts,
  useMatchResults,
  useHistory,
  type ShowDraftMatch,
  type ShowDraft,
} from "@/lib/storage";
import type { MatchOutcome, MatchResult } from "@/lib/matches";
import { cn } from "@/lib/utils";

const OUTCOMES: { value: MatchOutcome; label: string }[] = [
  { value: "PIN", label: "Pinfall" },
  { value: "SUBMISSION", label: "Submission" },
  { value: "DQ", label: "Disqualification" },
  { value: "COUNTOUT", label: "Count-Out" },
  { value: "KO", label: "KO" },
  { value: "NO_CONTEST", label: "No Contest" },
  { value: "DRAW", label: "Draw" },
  { value: "OTHER", label: "Other" },
];

function parseSides(matchText: string): [string, string] {
  const parts = matchText.split(/ vs\.? /i);
  if (parts.length >= 2) {
    return [parts[0].trim(), parts.slice(1).join(" vs ").trim()];
  }
  return ["Side A", "Side B"];
}

interface LogFormState {
  winnerKey: "a" | "b" | "draw" | null;
  outcome: MatchOutcome;
  notes: string;
  stars: number;
  titleChanged: boolean;
}

function emptyForm(): LogFormState {
  return { winnerKey: null, outcome: "PIN", notes: "", stars: 0, titleChanged: false };
}

function formFromMatch(m: ShowDraftMatch): LogFormState {
  let winnerKey: "a" | "b" | "draw" | null = null;
  if (m.actualOutcome === "DRAW" || m.actualOutcome === "NO_CONTEST") {
    winnerKey = "draw";
  } else if (m.actualWinnerSideId === "a") {
    winnerKey = "a";
  } else if (m.actualWinnerSideId === "b") {
    winnerKey = "b";
  }
  return {
    winnerKey,
    outcome: m.actualOutcome ?? "PIN",
    notes: m.actualNotes ?? "",
    stars: m.stars ?? 0,
    titleChanged: m.titleChanged ?? false,
  };
}

function MatchCard({
  match,
  idx,
  onLog,
}: {
  match: ShowDraftMatch;
  idx: number;
  onLog: (matchId: string, form: LogFormState) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LogFormState>(emptyForm);

  const [sideA, sideB] = useMemo(() => parseSides(match.match), [match.match]);

  const isLogged = match.logged;

  const winnerLabel = isLogged
    ? match.actualWinnerSideId === "a"
      ? sideA
      : match.actualWinnerSideId === "b"
        ? sideB
        : "Draw"
    : null;

  const startEdit = () => {
    setForm(formFromMatch(match));
    setEditing(true);
    setExpanded(true);
  };

  const handleSubmit = () => {
    if (!form.winnerKey) {
      toast.error("Select a winner first");
      return;
    }
    onLog(match.id, form);
    setExpanded(false);
    setEditing(false);
    setForm(emptyForm());
  };

  const handleCancel = () => {
    setExpanded(false);
    setEditing(false);
    setForm(emptyForm());
  };

  return (
    <div
      className={cn(
        "border rounded-lg overflow-hidden transition-colors",
        isLogged
          ? "border-emerald-500/30 bg-emerald-500/[0.03]"
          : "border-border bg-card",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          {isLogged ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <Circle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
          )}
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground shrink-0">
            {match.slot || `Match ${idx + 1}`}
          </span>
          {isLogged && (
            <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
              LOGGED
            </span>
          )}
        </div>
        {isLogged && !editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Match options"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={startEdit} className="text-xs">
                Edit result
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Planned booking */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-semibold uppercase tracking-wide text-foreground leading-snug">
          {match.match}
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs bg-muted/20 p-2.5 rounded">
          <span className="text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">
            Planned:
          </span>
          <span className="text-foreground/80">{match.plannedResult}</span>
          {match.plannedTwist && (
            <>
              <span className="text-muted-foreground uppercase tracking-wider font-semibold whitespace-nowrap">
                Twist:
              </span>
              <span className="text-foreground/60 italic">{match.plannedTwist}</span>
            </>
          )}
        </div>

        {/* Actual result row (logged, not editing) */}
        {isLogged && !editing && (
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs bg-emerald-500/5 border border-emerald-500/15 p-2.5 rounded">
            <span className="text-emerald-400/70 uppercase tracking-wider font-semibold whitespace-nowrap">
              Actual:
            </span>
            <span className="text-emerald-300/90 font-medium">
              {winnerLabel} won
            </span>
            {match.actualOutcome && (
              <>
                <span className="text-emerald-400/70 uppercase tracking-wider font-semibold whitespace-nowrap">
                  Via:
                </span>
                <span className="text-emerald-300/80">
                  {OUTCOMES.find((o) => o.value === match.actualOutcome)?.label ??
                    match.actualOutcome}
                </span>
              </>
            )}
            {match.titleChanged && (
              <>
                <span className="text-emerald-400/70 uppercase tracking-wider font-semibold whitespace-nowrap">
                  Title:
                </span>
                <span className="text-emerald-300/80">Changed hands</span>
              </>
            )}
            {(match.stars ?? 0) > 0 && (
              <>
                <span className="text-emerald-400/70 uppercase tracking-wider font-semibold whitespace-nowrap">
                  Stars:
                </span>
                <span className="text-emerald-300/80">{"★".repeat(match.stars ?? 0)}</span>
              </>
            )}
            {match.actualNotes && (
              <>
                <span className="text-emerald-400/70 uppercase tracking-wider font-semibold whitespace-nowrap">
                  Notes:
                </span>
                <span className="text-emerald-300/70 italic">{match.actualNotes}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Log button (not yet logged, not expanded) */}
      {!isLogged && !expanded && (
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-full py-2 rounded border border-dashed border-border/60 text-[11px] font-bold tracking-wider uppercase text-muted-foreground hover:border-foreground/30 hover:text-foreground transition-colors"
          >
            Log actual result
          </button>
        </div>
      )}

      {/* Inline form */}
      {(expanded || editing) && (
        <div className="px-4 pb-4 border-t border-border/40 pt-3 space-y-3">
          {/* Winner picker */}
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
              Who won?
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { key: "a" as const, label: sideA },
                  { key: "b" as const, label: sideB },
                  { key: "draw" as const, label: "Draw" },
                ] as const
              ).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      winnerKey: key,
                      outcome: key === "draw" ? "DRAW" : f.outcome === "DRAW" ? "PIN" : f.outcome,
                    }))
                  }
                  className={cn(
                    "py-2 px-1.5 rounded text-[10px] font-bold tracking-wider uppercase border transition-colors truncate",
                    form.winnerKey === key
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground/70 border-border hover:border-foreground/40 hover:text-foreground",
                  )}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Outcome */}
          {form.winnerKey !== "draw" && (
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
                Outcome
              </div>
              <select
                value={form.outcome}
                onChange={(e) =>
                  setForm((f) => ({ ...f, outcome: e.target.value as MatchOutcome }))
                }
                className="w-full bg-muted/20 border border-border rounded px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30"
              >
                {OUTCOMES.filter((o) => o.value !== "DRAW" && o.value !== "NO_CONTEST").map(
                  (o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ),
                )}
              </select>
            </div>
          )}

          {/* Stars */}
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
              Stars (0–5)
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, stars: n }))}
                  className={cn(
                    "w-8 h-8 rounded text-sm font-bold transition-colors",
                    form.stars === n
                      ? "bg-foreground text-background"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Title changed */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.titleChanged}
              onChange={(e) => setForm((f) => ({ ...f, titleChanged: e.target.checked }))}
              className="rounded"
            />
            <span className="text-xs text-muted-foreground">Title changed hands</span>
          </label>

          {/* Notes */}
          <div>
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1.5">
              Notes / what changed?
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="e.g. Run-in by Solo changed the finish..."
              rows={2}
              className="w-full bg-muted/20 border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 py-2 rounded border border-border text-[11px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={cn(
                "flex-1 py-2 rounded text-[11px] font-bold tracking-wider uppercase transition-colors",
                form.winnerKey
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed",
              )}
            >
              {editing ? "Update" : "Log result"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface ShowDraftLoggerProps {
  draftId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShowDraftLogger({ draftId, open, onOpenChange }: ShowDraftLoggerProps) {
  const [drafts, setDrafts] = useShowDrafts();
  const [, setMatchResults] = useMatchResults();
  const [, setHistory] = useHistory();

  const draft: ShowDraft | null = useMemo(
    () => drafts.find((d) => d.id === draftId) ?? null,
    [drafts, draftId],
  );

  const loggedCount = draft?.matches.filter((m) => m.logged).length ?? 0;
  const totalCount = draft?.matches.length ?? 0;
  const allLogged = totalCount > 0 && loggedCount === totalCount;

  const handleLog = (matchId: string, form: LogFormState) => {
    if (!draft) return;
    const match = draft.matches.find((m) => m.id === matchId);
    if (!match) return;

    const [sideA, sideB] = parseSides(match.match);
    const winnerSideId: "a" | "b" | undefined =
      form.winnerKey === "draw" ? undefined : (form.winnerKey as "a" | "b") ?? undefined;
    const outcome: MatchOutcome = form.winnerKey === "draw" ? "DRAW" : form.outcome;

    const matchResult: MatchResult = {
      id: `draft-${matchId}`,
      date: draft.universeDate,
      showId: draft.showId,
      showName: draft.showName,
      slot: match.slot,
      sides: [
        { id: "a", label: sideA, wrestlerIds: [] },
        { id: "b", label: sideB, wrestlerIds: [] },
      ],
      winnerSideId,
      outcome,
      titleChanged: form.titleChanged || undefined,
      stars: form.stars > 0 ? form.stars : undefined,
      notes: form.notes || undefined,
    };

    setMatchResults((prev) => {
      const without = prev.filter((r) => r.id !== `draft-${matchId}`);
      return [...without, matchResult];
    });

    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draft.id
          ? {
              ...d,
              matches: d.matches.map((m) =>
                m.id === matchId
                  ? {
                      ...m,
                      logged: true,
                      actualWinnerSideId: winnerSideId,
                      actualOutcome: outcome,
                      actualNotes: form.notes || undefined,
                      stars: form.stars > 0 ? form.stars : undefined,
                      titleChanged: form.titleChanged || undefined,
                    }
                  : m,
              ),
            }
          : d,
      ),
    );

    toast.success("Match logged");
  };

  const handleComplete = () => {
    if (!draft || !allLogged) return;

    const resultMatches: MatchResult[] = draft.matches.map((m) => {
      const [sideA, sideB] = parseSides(m.match);
      return {
        id: `draft-${m.id}`,
        date: draft.universeDate,
        showId: draft.showId,
        showName: draft.showName,
        slot: m.slot,
        sides: [
          { id: "a", label: sideA, wrestlerIds: [] },
          { id: "b", label: sideB, wrestlerIds: [] },
        ],
        winnerSideId: m.actualWinnerSideId,
        outcome: m.actualOutcome ?? "OTHER",
        titleChanged: m.titleChanged,
        stars: m.stars,
        notes: m.actualNotes,
      };
    });

    const entryId = crypto.randomUUID();

    setHistory((prev) => [
      {
        kind: "results" as const,
        id: entryId,
        createdAt: Date.now(),
        universeDate: draft.universeDate,
        data: {
          showId: draft.showId,
          showName: draft.showName,
          showImageUrl: draft.showImageUrl,
          matches: resultMatches,
        },
      },
      ...prev,
    ]);

    setMatchResults((prev) => {
      const draftIds = new Set(draft.matches.map((m) => `draft-${m.id}`));
      return [...prev.filter((r) => !draftIds.has(r.id)), ...resultMatches];
    });

    setDrafts((prev) =>
      prev.map((d) =>
        d.id === draft.id ? { ...d, status: "complete" as const, resultEntryId: entryId } : d,
      ),
    );

    toast.success(`${draft.showName} complete`, {
      description: `${totalCount} match${totalCount !== 1 ? "es" : ""} logged and saved to history.`,
    });
    onOpenChange(false);
  };

  if (!draft) return null;

  const { universeDate } = draft;
  const dateStr = universeDate
    ? `Year ${universeDate.year + 1} · Month ${universeDate.month} · Week ${universeDate.week}`
    : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0 overflow-hidden"
      >
        {/* Header */}
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
                Show Draft
                {draft.status === "complete" && (
                  <span className="ml-2 text-emerald-400">· Complete</span>
                )}
              </div>
              <SheetTitle className="text-lg font-display uppercase tracking-wider leading-tight">
                {draft.showName}
              </SheetTitle>
              {dateStr && (
                <div className="text-xs text-muted-foreground mt-0.5">{dateStr}</div>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold font-display tabular-nums">
                {loggedCount}/{totalCount}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                logged
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1 bg-muted/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: totalCount > 0 ? `${(loggedCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
        </SheetHeader>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {draft.matches.map((match, idx) => (
            <MatchCard key={match.id} match={match} idx={idx} onLog={handleLog} />
          ))}
        </div>

        {/* Footer */}
        {draft.status !== "complete" && (
          <div className="px-6 py-4 border-t border-border shrink-0 space-y-2">
            {!allLogged && (
              <p className="text-[11px] text-muted-foreground text-center">
                Log all {totalCount} matches to complete the show.
              </p>
            )}
            <button
              type="button"
              onClick={handleComplete}
              disabled={!allLogged}
              className={cn(
                "w-full py-3 rounded text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-colors",
                allLogged
                  ? "bg-foreground text-background hover:bg-foreground/90"
                  : "bg-muted/30 text-muted-foreground/50 cursor-not-allowed",
              )}
            >
              <ClipboardCheck className="w-4 h-4" />
              Complete Show — Save to History
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
