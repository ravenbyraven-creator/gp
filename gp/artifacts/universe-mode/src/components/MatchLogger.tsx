import { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Trash2, Save, ChevronDown, ChevronUp, Trophy, Swords } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRoster, useChampionships, useMatchResults, useHistory, useShows, type ShowResultsEntryData } from "@/lib/storage";
import type { MatchResult, MatchOutcome } from "@/lib/matches";
import type { UniverseDate } from "@/lib/calendar";
import { formatDate } from "@/lib/calendar";
import type { Wrestler, Championship } from "@workspace/api-client-react";
import { CreateRivalryDialog } from "@/components/RivalryDialogs";

const BRAND_RED = "#dc1e1e";

const OUTCOMES: { value: MatchOutcome; label: string }[] = [
  { value: "PIN", label: "Pinfall" },
  { value: "SUBMISSION", label: "Submission" },
  { value: "DQ", label: "Disqualification" },
  { value: "COUNTOUT", label: "Count Out" },
  { value: "KO", label: "Knockout" },
  { value: "DRAW", label: "Draw" },
  { value: "NO_CONTEST", label: "No Contest" },
  { value: "OTHER", label: "Other" },
];

interface InternalSide {
  id: string;
  label: string;
  wrestlerIds: string[];
}

interface MatchRow {
  id: string;
  slot: string;
  sides: InternalSide[];
  winnerSideId: string | null;
  outcome: MatchOutcome;
  finish: string;
  stipulation: string;
  titleId: string;
  titleChanged: boolean;
  stars: number;
  notes: string;
  expanded: boolean;
}

function makeSide(label: string): InternalSide {
  return { id: crypto.randomUUID(), label, wrestlerIds: [] };
}

function defaultRow(slot: string, expanded = true): MatchRow {
  return {
    id: crypto.randomUUID(),
    slot,
    sides: [makeSide("Side A"), makeSide("Side B")],
    winnerSideId: null,
    outcome: "PIN",
    finish: "",
    stipulation: "",
    titleId: "",
    titleChanged: false,
    stars: 0,
    notes: "",
    expanded,
  };
}

function fuzzyFindWrestler(
  name: string,
  roster: Wrestler[],
): Wrestler | undefined {
  const lower = name.trim().toLowerCase();
  return (
    roster.find((w) => w.name.toLowerCase() === lower) ??
    roster.find((w) => w.name.toLowerCase().startsWith(lower)) ??
    roster.find((w) => lower.startsWith(w.name.toLowerCase())) ??
    roster.find(
      (w) => w.name.toLowerCase().includes(lower) || lower.includes(w.name.toLowerCase()),
    )
  );
}

function buildPrefillRows(
  slots: PrefillSlot[],
  roster: Wrestler[],
): MatchRow[] {
  return slots.map((slot, idx) => {
    const row = defaultRow(slot.slot || `Match ${idx + 1}`);

    const rawParts = slot.matchText.split(/\s+vs\.?\s+/i);
    if (rawParts.length >= 2) {
      const nameA = rawParts[0].trim();
      const nameB = rawParts.slice(1).join(" vs ").trim();
      const wA = fuzzyFindWrestler(nameA, roster);
      const wB = fuzzyFindWrestler(nameB, roster);
      row.sides[0].label = nameA;
      row.sides[1].label = nameB;
      if (wA) row.sides[0].wrestlerIds = [wA.id];
      if (wB) row.sides[1].wrestlerIds = [wB.id];

      if (slot.resultText) {
        const lower = slot.resultText.toLowerCase();
        if (lower.includes("no contest")) {
          row.outcome = "NO_CONTEST";
          row.winnerSideId = null;
        } else if (lower.includes("draw")) {
          row.outcome = "DRAW";
          row.winnerSideId = null;
        } else {
          const aWon =
            (wA && lower.includes(wA.name.toLowerCase())) ||
            lower.includes(nameA.toLowerCase());
          const bWon =
            (wB && lower.includes(wB.name.toLowerCase())) ||
            lower.includes(nameB.toLowerCase());

          if (aWon && !bWon) row.winnerSideId = row.sides[0].id;
          else if (bWon && !aWon) row.winnerSideId = row.sides[1].id;

          if (lower.includes("submission")) row.outcome = "SUBMISSION";
          else if (lower.includes(" dq") || lower.includes("disqualif"))
            row.outcome = "DQ";
          else if (lower.includes("count out") || lower.includes("countout"))
            row.outcome = "COUNTOUT";
          else if (row.winnerSideId) row.outcome = "PIN";
        }
      }
    }
    return row;
  });
}

export interface PrefillSlot {
  slot: string;
  matchText: string;
  resultText: string;
}

interface MatchLoggerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: UniverseDate;
  showId?: string;
  showName?: string;
  prefillSlots?: PrefillSlot[];
  onSaved?: (entry: { id: string; data: ShowResultsEntryData }) => void;
}

export function MatchLogger({
  open,
  onOpenChange,
  date,
  showId,
  showName,
  prefillSlots,
  onSaved,
}: MatchLoggerProps) {
  const [roster] = useRoster();
  const [championships] = useChampionships();
  const [, setMatchResults] = useMatchResults();
  const [, setHistory] = useHistory();
  const [shows] = useShows();
  const [confirmEntry, setConfirmEntry] = useState<ShowResultsEntryData | null>(null);
  const [startRivalryMatch, setStartRivalryMatch] = useState<MatchResult | null>(null);

  const activeChamps = useMemo(
    () => championships.filter((c) => c.active !== false),
    [championships],
  );

  const initRows = (slots?: PrefillSlot[]): MatchRow[] => {
    if (slots && slots.length > 0) return buildPrefillRows(slots, roster);
    return [defaultRow("Match 1")];
  };

  const [rows, setRows] = useState<MatchRow[]>(() => initRows(prefillSlots));
  const prefillRef = useRef(prefillSlots);

  useEffect(() => {
    if (open && prefillSlots !== prefillRef.current) {
      prefillRef.current = prefillSlots;
      setRows(initRows(prefillSlots));
    }
    if (!open) {
      prefillRef.current = prefillSlots;
    }
  }, [open, prefillSlots]);

  useEffect(() => {
    if (open) setRows(initRows(prefillSlots));
  }, [open]);

  const updateRow = (id: string, patch: Partial<MatchRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const updateSide = (rowId: string, sideId: string, patch: Partial<InternalSide>) =>
    setRows((prev) =>
      prev.map((r) =>
        r.id !== rowId
          ? r
          : { ...r, sides: r.sides.map((s) => (s.id === sideId ? { ...s, ...patch } : s)) },
      ),
    );

  const addRow = () =>
    setRows((prev) => [
      ...prev,
      defaultRow(`Match ${prev.length + 1}`),
    ]);

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const handleSave = () => {
    const newResults: MatchResult[] = rows.map((row) => {
      const isDraw = row.outcome === "DRAW" || row.outcome === "NO_CONTEST";
      return {
        id: crypto.randomUUID(),
        date,
        showId,
        showName,
        slot: row.slot || undefined,
        sides: row.sides.map((s) => ({
          id: s.id,
          label: s.label,
          wrestlerIds: s.wrestlerIds,
        })),
        winnerSideId: isDraw ? undefined : (row.winnerSideId ?? undefined),
        outcome: isDraw
          ? row.outcome
          : row.winnerSideId
            ? row.outcome
            : "NO_CONTEST",
        finish: row.finish || undefined,
        stipulation: row.stipulation || undefined,
        titleId: row.titleId || undefined,
        titleChanged: row.titleChanged || undefined,
        stars: row.stars > 0 ? row.stars : undefined,
        notes: row.notes || undefined,
      };
    });

    setMatchResults((prev) => [...prev, ...newResults]);

    const matchedShow = shows.find((s) => s.id === showId);
    const entryData: ShowResultsEntryData = {
      showId,
      showName,
      showImageUrl: matchedShow?.imageUrl ?? undefined,
      matches: newResults,
    };
    const entryId = crypto.randomUUID();
    setHistory((prev) => [
      {
        kind: "results",
        id: entryId,
        createdAt: Date.now(),
        universeDate: date,
        data: entryData,
      },
      ...prev,
    ]);

    onOpenChange(false);
    setConfirmEntry(entryData);
    onSaved?.({ id: entryId, data: entryData });
  };

  return (
    <>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden"
      >
        <div className="h-[3px] w-full shrink-0" style={{ background: BRAND_RED }} />
        <SheetHeader className="px-5 pt-4 pb-4 border-b border-border bg-muted/10 shrink-0 space-y-0.5">
          <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
            Match Logger
          </div>
          <SheetTitle className="font-display text-xl font-bold uppercase tracking-wider text-foreground leading-tight">
            {showName ?? "Tonight's Card"} · {formatDate(date)}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows.map((row, idx) => (
            <MatchRowCard
              key={row.id}
              row={row}
              index={idx}
              roster={roster}
              championships={activeChamps}
              onUpdate={(patch) => updateRow(row.id, patch)}
              onUpdateSide={(sideId, patch) => updateSide(row.id, sideId, patch)}
              onRemove={() => removeRow(row.id)}
              removable={rows.length > 1}
            />
          ))}

          <button
            type="button"
            onClick={addRow}
            className="w-full flex items-center justify-center gap-2 py-3 rounded border border-dashed border-border hover:border-foreground/30 hover:bg-muted/10 transition-colors text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Match
          </button>
        </div>

        <SheetFooter className="px-5 py-4 border-t border-border bg-muted/5 shrink-0 flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1 text-xs uppercase tracking-widest"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={rows.length === 0}
            className="flex-1 text-xs uppercase tracking-widest font-bold"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            Save {rows.length} Match{rows.length !== 1 ? "es" : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    {/* Post-save confirmation screen */}
    <ShowResultsConfirm
      entry={confirmEntry}
      roster={roster}
      onClose={() => setConfirmEntry(null)}
      onStartRivalry={(match) => {
        setConfirmEntry(null);
        setStartRivalryMatch(match);
      }}
    />

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

/* ─────────────────────────────────────────────
   Show Results Confirmation Dialog
───────────────────────────────────────────── */
function outcomeLabel(outcome: MatchOutcome): string {
  const map: Record<MatchOutcome, string> = {
    PIN: "Pinfall",
    SUBMISSION: "Submission",
    DQ: "Disqualification",
    COUNTOUT: "Count Out",
    KO: "Knockout",
    DRAW: "Draw",
    NO_CONTEST: "No Contest",
    OTHER: "Other",
  };
  return map[outcome] ?? outcome;
}

function WrestlerAvatar({ name, imageUrl }: { name: string; imageUrl?: string }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        className="w-8 h-8 rounded-full object-cover object-top border border-border/50 shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full border border-border/50 bg-muted/30 flex items-center justify-center shrink-0">
      <span className="text-[10px] font-bold text-muted-foreground/70 uppercase">
        {name.charAt(0)}
      </span>
    </div>
  );
}

function ShowResultsConfirm({
  entry,
  roster,
  onClose,
  onStartRivalry,
}: {
  entry: ShowResultsEntryData | null;
  roster: Wrestler[];
  onClose: () => void;
  onStartRivalry: (match: MatchResult) => void;
}) {
  const rosterMap = useMemo(() => new Map(roster.map((w) => [w.id, w])), [roster]);

  if (!entry) return null;

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col p-0 gap-0">
        {/* Show brand header with backdrop */}
        <div
          className="relative shrink-0 overflow-hidden"
          style={{ minHeight: 88 }}
        >
          {entry.showImageUrl && (
            <img
              src={entry.showImageUrl}
              alt={entry.showName ?? "Show"}
              className="absolute inset-0 w-full h-full object-cover object-center opacity-20 saturate-0"
            />
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.5) 100%)" }} />
          <div className="relative z-10 px-5 py-4">
            <div
              className="h-[3px] w-10 rounded mb-3"
              style={{ background: BRAND_RED }}
            />
            <div className="text-[9px] font-bold tracking-[0.3em] uppercase text-white/40 mb-0.5">
              Results Logged
            </div>
            <DialogHeader>
              <DialogTitle className="font-display text-xl font-bold uppercase tracking-widest text-white leading-tight text-left">
                {entry.showName ?? "Show Night"}
              </DialogTitle>
            </DialogHeader>
            <div className="text-[10px] text-white/40 uppercase tracking-widest mt-0.5">
              {entry.matches.length} match{entry.matches.length !== 1 ? "es" : ""} logged
            </div>
          </div>
        </div>

        {/* Match list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {entry.matches.map((match) => {
            const sideA = match.sides[0];
            const sideB = match.sides[1];
            const isDraw = match.outcome === "DRAW" || match.outcome === "NO_CONTEST";
            const winnerSide = match.winnerSideId
              ? match.sides.find((s) => s.id === match.winnerSideId)
              : null;

            const sideAWrestlers = (sideA?.wrestlerIds ?? []).map((id) => rosterMap.get(id)).filter(Boolean) as typeof roster;
            const sideBWrestlers = (sideB?.wrestlerIds ?? []).map((id) => rosterMap.get(id)).filter(Boolean) as typeof roster;

            const sideALabel = sideAWrestlers.length > 0
              ? sideAWrestlers.map((w) => w.name).join(" & ")
              : (sideA?.label ?? "Side A");
            const sideBLabel = sideBWrestlers.length > 0
              ? sideBWrestlers.map((w) => w.name).join(" & ")
              : (sideB?.label ?? "Side B");

            return (
              <div
                key={match.id}
                className="rounded-lg border border-border bg-muted/5 overflow-hidden"
              >
                {/* Slot + stipulation header */}
                <div className="px-4 py-2 bg-muted/10 border-b border-border/50 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
                    {match.slot ?? "Match"}
                    {match.stipulation ? ` · ${match.stipulation}` : ""}
                  </span>
                  {match.stars && match.stars > 0 ? (
                    <span className="text-[9px] font-bold tracking-widest uppercase text-amber-400/80">
                      {"★".repeat(match.stars)} {match.stars}★
                    </span>
                  ) : null}
                </div>

                <div className="px-4 py-3">
                  {/* Competitors row */}
                  <div className="flex items-center gap-2 mb-3">
                    {/* Side A avatars */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {sideAWrestlers.slice(0, 3).map((w) => (
                        <WrestlerAvatar key={w.id} name={w.name} imageUrl={w.imageUrl} />
                      ))}
                      {sideAWrestlers.length === 0 && sideA && (
                        <WrestlerAvatar name={sideA.label} />
                      )}
                      <span
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-wide truncate",
                          winnerSide?.id === sideA?.id ? "text-emerald-400" : "text-foreground/80"
                        )}
                      >
                        {sideALabel}
                      </span>
                    </div>

                    <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50 shrink-0">
                      vs
                    </span>

                    {/* Side B avatars */}
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span
                        className={cn(
                          "text-[11px] font-bold uppercase tracking-wide truncate text-right",
                          winnerSide?.id === sideB?.id ? "text-emerald-400" : "text-foreground/80"
                        )}
                      >
                        {sideBLabel}
                      </span>
                      {sideBWrestlers.slice(0, 3).map((w) => (
                        <WrestlerAvatar key={w.id} name={w.name} imageUrl={w.imageUrl} />
                      ))}
                      {sideBWrestlers.length === 0 && sideB && (
                        <WrestlerAvatar name={sideB.label} />
                      )}
                    </div>
                  </div>

                  {/* Result row */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {!isDraw && winnerSide && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-emerald-400/30 bg-emerald-400/10 text-emerald-400">
                        W: {winnerSide.label}
                      </span>
                    )}
                    {isDraw && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-border text-muted-foreground">
                        {outcomeLabel(match.outcome)}
                      </span>
                    )}
                    <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60">
                      {outcomeLabel(match.outcome)}
                      {match.finish ? ` · ${match.finish}` : ""}
                    </span>
                    {match.titleChanged && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 text-amber-400">
                        Title Change
                      </span>
                    )}
                  </div>

                  {match.notes && (
                    <p className="text-[11px] text-muted-foreground/70 italic leading-relaxed mb-2">
                      {match.notes}
                    </p>
                  )}

                  {/* Start Rivalry action */}
                  <button
                    type="button"
                    onClick={() => onStartRivalry(match)}
                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 px-2.5 py-1 rounded transition-colors"
                  >
                    <Swords className="w-3 h-3" />
                    Start Rivalry
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-border bg-muted/5 shrink-0 flex items-center justify-between gap-3">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-widest">
            Saved to Rivalries History
          </span>
          <Button
            onClick={onClose}
            className="text-xs uppercase tracking-widest font-bold px-5"
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface MatchRowCardProps {
  row: MatchRow;
  index: number;
  roster: Wrestler[];
  championships: Championship[];
  onUpdate: (patch: Partial<MatchRow>) => void;
  onUpdateSide: (sideId: string, patch: Partial<InternalSide>) => void;
  onRemove: () => void;
  removable: boolean;
}

function MatchRowCard({
  row,
  index,
  roster,
  championships,
  onUpdate,
  onUpdateSide,
  onRemove,
  removable,
}: MatchRowCardProps) {
  const isDraw = row.outcome === "DRAW" || row.outcome === "NO_CONTEST";

  const toggleWrestler = (sideId: string, wrestlerId: string) => {
    const side = row.sides.find((s) => s.id === sideId);
    if (!side) return;
    const has = side.wrestlerIds.includes(wrestlerId);
    onUpdateSide(sideId, {
      wrestlerIds: has
        ? side.wrestlerIds.filter((id) => id !== wrestlerId)
        : [...side.wrestlerIds, wrestlerId],
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => onUpdate({ expanded: !row.expanded })}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/10 hover:bg-muted/20 transition-colors text-left gap-2"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground shrink-0">
            {row.slot || `Match ${index + 1}`}
          </span>
          <span className="text-xs font-bold uppercase tracking-wide text-foreground truncate">
            {row.sides.map((s) => s.label || "?").join(" vs ")}
          </span>
          {row.winnerSideId && !isDraw && (
            <span className="text-[9px] font-bold tracking-widest uppercase text-emerald-400 border border-emerald-400/30 bg-emerald-400/10 px-1.5 py-0.5 rounded shrink-0">
              W: {row.sides.find((s) => s.id === row.winnerSideId)?.label ?? "?"}
            </span>
          )}
          {isDraw && (
            <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground border border-border px-1.5 py-0.5 rounded shrink-0">
              {row.outcome === "DRAW" ? "Draw" : "No Contest"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {removable && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {row.expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {row.expanded && (
        <div className="p-4 space-y-4">
          {/* Slot label */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                Match Slot
              </label>
              <Input
                value={row.slot}
                onChange={(e) => onUpdate({ slot: e.target.value })}
                placeholder="e.g. Main Event"
                className="h-7 text-xs bg-background"
              />
            </div>
            <div>
              <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                Stipulation
              </label>
              <Input
                value={row.stipulation}
                onChange={(e) => onUpdate({ stipulation: e.target.value })}
                placeholder="e.g. Steel Cage"
                className="h-7 text-xs bg-background"
              />
            </div>
          </div>

          {/* Sides */}
          <div className="grid grid-cols-2 gap-3">
            {row.sides.map((side) => (
              <div key={side.id}>
                <div className="flex items-center gap-2 mb-1.5">
                  <Input
                    value={side.label}
                    onChange={(e) => onUpdateSide(side.id, { label: e.target.value })}
                    placeholder="Side label"
                    className="h-6 text-[10px] bg-background flex-1"
                  />
                </div>
                <div className="rounded border border-border overflow-hidden max-h-36 overflow-y-auto">
                  {roster.length === 0 ? (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground/40 uppercase tracking-wider">
                      No roster
                    </div>
                  ) : (
                    roster
                      .slice()
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((w) => {
                        const isSelected = side.wrestlerIds.includes(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => toggleWrestler(side.id, w.id)}
                            className={cn(
                              "w-full text-left px-2.5 py-1.5 text-[11px] font-medium tracking-wide transition-colors flex items-center gap-1.5 border-b border-border last:border-b-0",
                              isSelected
                                ? "bg-foreground/10 text-foreground font-bold"
                                : "text-muted-foreground hover:bg-muted/20 hover:text-foreground",
                            )}
                          >
                            {isSelected && (
                              <span className="w-1.5 h-1.5 rounded-full bg-foreground shrink-0" />
                            )}
                            <span className="truncate">{w.name}</span>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Winner + Outcome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1.5">
                Winner
              </label>
              <div className="flex flex-col gap-1">
                {row.sides.map((side) => (
                  <button
                    key={side.id}
                    type="button"
                    onClick={() => {
                      if (isDraw) onUpdate({ outcome: "PIN" });
                      onUpdate({ winnerSideId: side.id });
                    }}
                    className={cn(
                      "w-full text-left px-2.5 py-1.5 rounded border text-[11px] font-bold tracking-wider uppercase transition-colors truncate",
                      !isDraw && row.winnerSideId === side.id
                        ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-400"
                        : "border-border bg-muted/10 text-muted-foreground hover:text-foreground hover:border-foreground/30",
                    )}
                  >
                    {side.label || `Side ${row.sides.indexOf(side) + 1}`}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onUpdate({ winnerSideId: null, outcome: "DRAW" })}
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded border text-[11px] font-bold tracking-wider uppercase transition-colors",
                    isDraw && row.outcome === "DRAW"
                      ? "border-muted-foreground/50 bg-muted/20 text-foreground"
                      : "border-border bg-muted/5 text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  Draw
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdate({ winnerSideId: null, outcome: "NO_CONTEST" })
                  }
                  className={cn(
                    "w-full text-left px-2.5 py-1.5 rounded border text-[11px] font-bold tracking-wider uppercase transition-colors",
                    isDraw && row.outcome === "NO_CONTEST"
                      ? "border-muted-foreground/50 bg-muted/20 text-foreground"
                      : "border-border bg-muted/5 text-muted-foreground hover:text-foreground hover:border-foreground/30",
                  )}
                >
                  No Contest
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                  Outcome
                </label>
                <Select
                  value={row.outcome}
                  onValueChange={(v) => onUpdate({ outcome: v as MatchOutcome })}
                >
                  <SelectTrigger className="h-7 text-xs bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-xs">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                  Finish
                </label>
                <Input
                  value={row.finish}
                  onChange={(e) => onUpdate({ finish: e.target.value })}
                  placeholder="e.g. RKO"
                  className="h-7 text-xs bg-background"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                  Stars (0–5)
                </label>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onUpdate({ stars: n })}
                      className={cn(
                        "flex-1 py-1 rounded border text-[10px] font-bold tracking-widest uppercase transition-colors",
                        row.stars === n
                          ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                          : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
                      )}
                    >
                      {n === 0 ? "–" : n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Title stake */}
          {championships.length > 0 && (
            <div>
              <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
                <Trophy className="w-3 h-3 inline mr-1 text-amber-400/60" />
                Title at Stake
              </label>
              <Select
                value={row.titleId || "__none__"}
                onValueChange={(v) =>
                  onUpdate({ titleId: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger className="h-7 text-xs bg-background">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-xs">
                    None
                  </SelectItem>
                  {championships.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {row.titleId && (
                <button
                  type="button"
                  onClick={() => onUpdate({ titleChanged: !row.titleChanged })}
                  className={cn(
                    "mt-1.5 w-full text-left px-2.5 py-1 rounded border text-[10px] font-bold tracking-widest uppercase transition-colors",
                    row.titleChanged
                      ? "border-amber-400/50 bg-amber-400/10 text-amber-400"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {row.titleChanged ? "Title Changed Hands" : "Title Did Not Change"}
                </button>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground block mb-1">
              Notes
            </label>
            <Input
              value={row.notes}
              onChange={(e) => onUpdate({ notes: e.target.value })}
              placeholder="Optional match notes"
              className="h-7 text-xs bg-background"
            />
          </div>
        </div>
      )}
    </div>
  );
}
