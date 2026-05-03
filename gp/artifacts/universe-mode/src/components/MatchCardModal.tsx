import { useState } from "react";
import { Plus, Trash2, Edit2, Shield, Link2, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useMatchCards,
  useRoster,
  useRivalries,
  useHistory,
  type PlannedMatch,
  type MatchCard,
} from "@/lib/storage";
import { rivalryDisplayTitle } from "@/lib/rivalry";
import type { UniverseDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const MATCH_TYPES = [
  "Singles",
  "Tag Team",
  "Triple Threat",
  "Fatal Four-Way",
  "Ladder Match",
  "TLC Match",
  "Steel Cage",
  "Hell in a Cell",
  "Last Man Standing",
  "I Quit",
  "Tables Match",
  "Extreme Rules",
  "Battle Royal",
  "Royal Rumble",
];

const DAY_SHORT: Record<number, string> = {
  0: "SUN", 1: "MON", 2: "TUE", 3: "WED", 4: "THU", 5: "FRI", 6: "SAT",
};

interface MatchCardModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  month: number;
  week: number;
  day: number;
  showName?: string;
  pleName?: string;
  currentDate: UniverseDate;
}

const CARD_ID = (month: number, week: number, day: number) => `${month}-${week}-${day}`;

export function MatchCardModal({
  open,
  onOpenChange,
  month,
  week,
  day,
  showName,
  pleName,
  currentDate,
}: MatchCardModalProps) {
  const [matchCards, setMatchCards] = useMatchCards();
  const [roster] = useRoster();
  const [rivalries] = useRivalries();
  const [history, setHistory] = useHistory();

  const cardId = CARD_ID(month, week, day);
  const card = matchCards.find((c) => c.id === cardId);
  const matches = card?.matches ?? [];

  const [editingMatch, setEditingMatch] = useState<PlannedMatch | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const activeRivalries = rivalries.filter((r) => r.status === "ACTIVE");

  const rosterNames = roster.map((w) => w.name);

  const nightLabel = showName ?? pleName ?? `${DAY_SHORT[day]} · Week ${week}`;

  function saveMatch(match: PlannedMatch, prevRivalryId?: string) {
    const hadRivalry = prevRivalryId && prevRivalryId !== match.rivalryId;
    const isNewRivalry = match.rivalryId && match.rivalryId !== prevRivalryId;

    setMatchCards((prev) => {
      const existing = prev.find((c) => c.id === cardId);
      if (existing) {
        return prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                matches: c.matches.some((m) => m.id === match.id)
                  ? c.matches.map((m) => (m.id === match.id ? match : m))
                  : [...c.matches, match],
              }
            : c,
        );
      }
      const newCard: MatchCard = { id: cardId, month, week, day, matches: [match] };
      return [...prev, newCard];
    });

    if (isNewRivalry && match.rivalryId) {
      const logId = crypto.randomUUID();
      const logText = `PLANNED: ${match.superstarA} vs ${match.superstarB} (${match.matchType})${match.title ? ` — ${match.title} on the line` : ""}`;
      const entry = {
        kind: "log" as const,
        id: logId,
        createdAt: Date.now(),
        universeDate: currentDate,
        text: logText,
      };
      setHistory((prev) => [entry, ...prev]);
      setMatchCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                matches: c.matches.map((m) =>
                  m.id === match.id ? { ...m, rivalryLogEntryId: logId } : m,
                ),
              }
            : c,
        ),
      );
    }

    if (hadRivalry && match.rivalryLogEntryId) {
      setMatchCards((prev) =>
        prev.map((c) =>
          c.id === cardId
            ? {
                ...c,
                matches: c.matches.map((m) =>
                  m.id === match.id ? { ...m, rivalryLogEntryId: undefined } : m,
                ),
              }
            : c,
        ),
      );
    }

    setEditingMatch(null);
    setIsAdding(false);
    toast.success(isAdding ? "Match added" : "Match updated");
  }

  function deleteMatch(matchId: string) {
    setMatchCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, matches: c.matches.filter((m) => m.id !== matchId) }
          : c,
      ),
    );
    toast.success("Match removed");
  }

  function startAdd() {
    setEditingMatch(null);
    setIsAdding(true);
  }

  function startEdit(match: PlannedMatch) {
    setEditingMatch(match);
    setIsAdding(false);
  }

  function cancelForm() {
    setEditingMatch(null);
    setIsAdding(false);
  }

  const showingForm = isAdding || editingMatch !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) cancelForm(); }}>
      <DialogContent className="sm:max-w-[540px] bg-card border-border text-foreground max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest flex items-center gap-2 text-base">
            <Shield className="w-4 h-4" />
            {nightLabel}
            <span className="text-muted-foreground font-normal text-xs normal-case tracking-normal ml-1">
              · Week {week}
            </span>
          </DialogTitle>
        </DialogHeader>

        {showingForm ? (
          <MatchForm
            initial={editingMatch}
            rosterNames={rosterNames}
            rivalries={activeRivalries.map((r) => ({
              id: r.id,
              label: rivalryDisplayTitle(r, roster),
            }))}
            onSave={(m) => saveMatch(m, editingMatch?.rivalryId)}
            onCancel={cancelForm}
            isNew={isAdding}
          />
        ) : (
          <div className="pt-2 space-y-3">
            {matches.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-border rounded-lg">
                <Shield className="w-8 h-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No matches booked yet.</p>
                <Button
                  onClick={startAdd}
                  variant="outline"
                  className="border-foreground/40 text-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" /> BOOK FIRST MATCH
                </Button>
              </div>
            ) : (
              <>
                <ul className="space-y-2">
                  {matches.map((m, i) => {
                    const linkedRivalry = activeRivalries.find((r) => r.id === m.rivalryId);
                    return (
                      <li
                        key={m.id}
                        className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-foreground/30 transition-colors"
                      >
                        <div className="flex-shrink-0 w-6 h-6 rounded bg-muted/40 flex items-center justify-center text-[10px] font-bold text-muted-foreground mt-0.5">
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold uppercase tracking-wider text-sm leading-tight">
                            {m.superstarA}
                            <span className="text-muted-foreground font-normal mx-1.5 normal-case tracking-normal">vs</span>
                            {m.superstarB}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-border bg-muted/20 text-muted-foreground">
                              {m.matchType}
                            </span>
                            {m.title && (
                              <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">
                                {m.title}
                              </span>
                            )}
                            {linkedRivalry && (
                              <span className="flex items-center gap-0.5 text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded border border-[#dc1e1e]/30 bg-[#dc1e1e]/10 text-[#dc1e1e]">
                                <Link2 className="w-2.5 h-2.5" />
                                {rivalryDisplayTitle(linkedRivalry, roster)}
                              </span>
                            )}
                          </div>
                          {m.note && (
                            <p className="text-xs text-muted-foreground/70 mt-1.5 italic">
                              {m.note}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(m)}
                            className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                            aria-label="Edit match"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteMatch(m.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            aria-label="Remove match"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    {matches.length} match{matches.length !== 1 ? "es" : ""} booked
                  </span>
                  <Button
                    onClick={startAdd}
                    className="bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Plus className="w-4 h-4 mr-2" /> ADD MATCH
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface MatchFormProps {
  initial: PlannedMatch | null;
  rosterNames: string[];
  rivalries: { id: string; label: string }[];
  onSave: (m: PlannedMatch) => void;
  onCancel: () => void;
  isNew: boolean;
}

function MatchForm({ initial, rosterNames, rivalries, onSave, onCancel, isNew }: MatchFormProps) {
  const [superstarA, setSuperstarA] = useState(initial?.superstarA ?? "");
  const [superstarB, setSuperstarB] = useState(initial?.superstarB ?? "");
  const [matchType, setMatchType] = useState(initial?.matchType ?? "Singles");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [rivalryId, setRivalryId] = useState(initial?.rivalryId ?? "");
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initial?.title || initial?.note || initial?.rivalryId),
  );

  const datalistId = "roster-names-list";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!superstarA.trim()) { toast.error("Enter Superstar A"); return; }
    if (!superstarB.trim()) { toast.error("Enter Superstar B"); return; }
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      superstarA: superstarA.trim(),
      superstarB: superstarB.trim(),
      matchType,
      title: title.trim() || undefined,
      note: note.trim() || undefined,
      rivalryId: rivalryId || undefined,
      rivalryLogEntryId: initial?.rivalryLogEntryId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <datalist id={datalistId}>
        {rosterNames.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Superstar A
          </label>
          <Input
            value={superstarA}
            onChange={(e) => setSuperstarA(e.target.value)}
            list={datalistId}
            autoFocus
            placeholder="Name or pick from roster"
            className="bg-background border-border"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            Superstar B
          </label>
          <Input
            value={superstarB}
            onChange={(e) => setSuperstarB(e.target.value)}
            list={datalistId}
            placeholder="Name or pick from roster"
            className="bg-background border-border"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          Match Type
        </label>
        <select
          value={matchType}
          onChange={(e) => setMatchType(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground/40"
        >
          {MATCH_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        Title, Stipulation & Rivalry
      </button>

      {showAdvanced && (
        <div className="space-y-3 pl-3 border-l border-border">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              Title on the Line (optional)
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. WWE Championship"
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              Stipulation / Note (optional)
            </label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Stipulation, contract signing fallout, revenge..."
              className="bg-background resize-none h-16 text-sm"
            />
          </div>

          {rivalries.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3 h-3" /> Tag to Rivalry (optional)
              </label>
              <select
                value={rivalryId}
                onChange={(e) => setRivalryId(e.target.value)}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground/40"
              >
                <option value="">— No rivalry —</option>
                {rivalries.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
              {rivalryId && (
                <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                  This match will be logged as a planned entry on that rivalry's timeline.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
        <Button type="button" variant="ghost" onClick={onCancel}>
          CANCEL
        </Button>
        <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">
          {isNew ? "ADD MATCH" : "SAVE"}
        </Button>
      </div>
    </form>
  );
}
