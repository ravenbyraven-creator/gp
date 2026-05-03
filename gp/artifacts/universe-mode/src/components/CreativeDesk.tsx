import { useState, useEffect } from "react";
import { useGenerateStoryline, useBookShow, useSurpriseMe, useGeneratePromo } from "@workspace/api-client-react";
import { useRoster, useChairman, useHistory, useShows, useUniverseDate, useEvents, useRivalries, useMemories, useChampionships, useStables, useUniverseBible, useSeasonChronicles, buildBookerContext, type RivalryEntry } from "@/lib/storage";
import { useIssues } from "@/lib/news";
import { useTokenLog, recordTokenUsage } from "@/lib/tokens";
import { ResultScreen } from "./ResultScreen";
import { CHAIRMEN } from "@/lib/chairmen";
import { Loader2, Zap, Tv2, Shuffle, Mic2, NotebookPen, Newspaper, Clock } from "lucide-react";
import { toast } from "sonner";
import { Chat } from "./Chat";
import { cn } from "@/lib/utils";
import { UniverseClock } from "./UniverseClock";
import { RoadToPLE } from "./RoadToPLE";
import { describeApiError } from "@/lib/api-errors";
import { formatDistanceToNow } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppTab } from "@/components/AppHeader";

type ActiveView = "DESK" | "LOG_ENTRY" | "PROMO_PICKER" | "MANUAL_MOMENT";
type PromoTone = "HEEL" | "BABYFACE" | "COCKY" | "WOUNDED";

const PROMO_TONES: { value: PromoTone; label: string; desc: string }[] = [
  { value: "HEEL", label: "Heel", desc: "Smug, vicious, hated." },
  { value: "BABYFACE", label: "Babyface", desc: "Fired-up, hungry, fights for the people." },
  { value: "COCKY", label: "Cocky", desc: "Swagger, charisma, talks down with a smile." },
  { value: "WOUNDED", label: "Wounded", desc: "Quiet, raw, dangerous after a loss." },
];

function kindLabel(kind: RivalryEntry["kind"]): string {
  if (kind === "storyline") return "Storyline";
  if (kind === "show") return "Show card";
  if (kind === "surprise") return "Surprise";
  if (kind === "promo") return "Promo";
  if (kind === "log") return "Night note";
  if (kind === "magazine") return "Magazine";
  return kind;
}

function KindIcon({ kind, className }: { kind: RivalryEntry["kind"]; className?: string }) {
  const cls = cn("shrink-0", className);
  if (kind === "storyline") return <Zap className={cls} />;
  if (kind === "show") return <Tv2 className={cls} />;
  if (kind === "surprise") return <Shuffle className={cls} />;
  if (kind === "promo") return <Mic2 className={cls} />;
  if (kind === "log") return <NotebookPen className={cls} />;
  if (kind === "magazine") return <Newspaper className={cls} />;
  return <Clock className={cls} />;
}

export function CreativeDesk({ onNavigate }: { onNavigate?: (tab: AppTab) => void } = {}) {
  const [activeView, setActiveView] = useState<ActiveView>("DESK");
  const [fullScreen, setFullScreen] = useState(false);
  const [roadToPLEOpen, setRoadToPLEOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualParticipants, setManualParticipants] = useState("");
  const [manualBeat, setManualBeat] = useState("");
  const [manualHeadline, setManualHeadline] = useState("");
  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history, setHistory] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [issues] = useIssues();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [universeBible] = useUniverseBible();
  const [seasonChronicles] = useSeasonChronicles();

  const [activeEntry, setActiveEntry] = useState<RivalryEntry | null>(null);
  const [promoWrestler, setPromoWrestler] = useState<string>("");
  const [promoTone, setPromoTone] = useState<PromoTone>("HEEL");
  const [focusViewEntry, setFocusViewEntry] = useState<RivalryEntry | null>(null);

  const storylineMutation = useGenerateStoryline();
  const showMutation = useBookShow();
  const surpriseMutation = useSurpriseMe();
  const promoMutation = useGeneratePromo();
  const [tokenLog, setTokenLog] = useTokenLog();

  const currentChairman = chairman || CHAIRMEN[0];

  // On mount: check sessionStorage for a focused entry from Rivalries History
  useEffect(() => {
    const focusId = sessionStorage.getItem("creativeDesk.focusEntryId");
    if (!focusId) return;
    sessionStorage.removeItem("creativeDesk.focusEntryId");
    const entry = history.find((h) => h.id === focusId);
    if (entry) {
      setFocusViewEntry(entry);
    }
  }, []);

  const handleAction = (type: "storyline" | "show" | "surprise") => {
    if (roster.length < 2) {
      toast.error("Roster too small", { description: "Add more superstars in the Roster tab first." });
      return;
    }
    const payload = { data: buildBookerContext(roster, currentChairman, history, shows, universeDate, events, rivalries, memories, issues, championships, stables, undefined, universeBible, seasonChronicles) };
    const onSuccess = (data: any) => {
      recordTokenUsage(tokenLog, setTokenLog, type as any, data._usage, universeDate ?? undefined);
      const newEntry = { kind: type, id: crypto.randomUUID(), createdAt: Date.now(), universeDate, data } as RivalryEntry;
      setHistory(prev => [newEntry, ...prev]);
      setActiveEntry(newEntry);
      toast.success("Saved to history");
    };
    const onError = (error: unknown) => toast.error("Creative Overruled", { description: describeApiError(error) });
    if (type === "storyline") storylineMutation.mutate(payload, { onSuccess, onError });
    else if (type === "show") showMutation.mutate(payload, { onSuccess, onError });
    else surpriseMutation.mutate(payload, { onSuccess, onError });
  };

  const handleSaveLog = () => {
    const trimmed = logText.trim();
    if (!trimmed) { toast.error("Nothing to save", { description: "Write something first." }); return; }
    const newEntry = { kind: "log" as const, id: crypto.randomUUID(), createdAt: Date.now(), universeDate, text: trimmed };
    setHistory(prev => [newEntry, ...prev]);
    setLogText("");
    setActiveView("DESK");
    toast.success("Night noted", { description: "Saved to history. The AI will treat this as canon." });
  };

  const handleOpenPromoPicker = () => {
    if (roster.length < 1) { toast.error("Roster empty", { description: "Add at least one superstar in the Roster tab first." }); return; }
    setPromoWrestler(roster[0].name);
    setPromoTone("HEEL");
    setActiveView("PROMO_PICKER");
  };

  const handleSubmitPromo = () => {
    if (!promoWrestler) { toast.error("Pick a wrestler first."); return; }
    const payload = {
      data: {
        ...buildBookerContext(roster, currentChairman, history, shows, universeDate, events, rivalries, memories, issues, championships, stables, undefined, universeBible, seasonChronicles),
        wrestlerName: promoWrestler,
        tone: promoTone,
      },
    };
    promoMutation.mutate(payload, {
      onSuccess: (data) => {
        recordTokenUsage(tokenLog, setTokenLog, "promo", data._usage, universeDate ?? undefined);
        const newEntry = { kind: "promo" as const, id: crypto.randomUUID(), createdAt: Date.now(), universeDate, data };
        setHistory(prev => [newEntry, ...prev]);
        setActiveEntry(newEntry);
        setActiveView("DESK");
        toast.success("Mic dropped", { description: "Saved to history." });
      },
      onError: (error) => toast.error("Creative Overruled", { description: describeApiError(error) }),
    });
  };

  const handleSaveManualMoment = () => {
    const title = manualTitle.trim();
    const beat = manualBeat.trim();
    if (!title || !beat) {
      toast.error("Moment needs a title and beat", {
        description: "Write the story beat you want Gorilla Position to remember.",
      });
      return;
    }

    const participants = manualParticipants
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const headline =
      manualHeadline.trim() ||
      title.toUpperCase().replace(/[.!?]+$/g, "").slice(0, 80);

    const newEntry: RivalryEntry = {
      kind: "storyline",
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      universeDate,
      data: {
        kind: "storyline",
        title: "STORYLINE",
        stamp: "CANON LOCKED",
        feud: title.toUpperCase(),
        participants,
        beats: [{ label: "CANON", text: beat }],
        headline: headline.toUpperCase(),
      },
    };

    setHistory((prev) => [newEntry, ...prev]);
    setManualTitle("");
    setManualParticipants("");
    setManualBeat("");
    setManualHeadline("");
    setActiveView("DESK");
    setActiveEntry(newEntry);
    toast.success("Canon moment saved", {
      description: "Saved to history. File it to a rivalry if it belongs to a feud.",
    });
  };

  const isLoading = storylineMutation.isPending || showMutation.isPending || surpriseMutation.isPending || promoMutation.isPending;

  // Recent saves — last 8 entries
  const recentSaves = history.slice(0, 8);

  // Full-screen chat overlay
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 py-3 border-b border-border bg-card shrink-0">
          <ToolButton icon={Zap} label="Storyline" onClick={() => handleAction("storyline")} loading={storylineMutation.isPending} disabled={isLoading} />
          <ToolButton icon={Tv2} label="Book Show" onClick={() => handleAction("show")} loading={showMutation.isPending} disabled={isLoading} />
          <ToolButton icon={Shuffle} label="Surprise" onClick={() => handleAction("surprise")} loading={surpriseMutation.isPending} disabled={isLoading} />
          <ToolButton icon={Mic2} label="Promo" onClick={handleOpenPromoPicker} loading={promoMutation.isPending} disabled={isLoading} />
          <ToolButton icon={NotebookPen} label="Canon Moment" onClick={() => { setFullScreen(false); setActiveView("MANUAL_MOMENT"); }} loading={false} disabled={isLoading} />
          <ToolButton icon={NotebookPen} label="Night Notes" onClick={() => { setFullScreen(false); setActiveView("LOG_ENTRY"); }} loading={false} disabled={isLoading} />
        </div>
        <div className="flex-1 min-h-0">
          <Chat fullScreen onToggleFullScreen={() => setFullScreen(false)} onRequestBack={() => setFullScreen(false)} />
        </div>
      </div>
    );
  }

  // Result screen
  if (activeEntry && activeEntry.kind !== "log" && activeEntry.kind !== "magazine") {
    return <ResultScreen entry={activeEntry} onBack={() => setActiveEntry(null)} />;
  }

  // Promo picker
  if (activeView === "PROMO_PICKER") {
    return (
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Cut A Promo</h1>
          <p className="text-muted-foreground mt-1">Pick a wrestler. Pick a tone. Get a script.</p>
        </div>
        <div className="flex-1 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Wrestler</label>
            <select
              value={promoWrestler}
              onChange={e => setPromoWrestler(e.target.value)}
              disabled={promoMutation.isPending}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground text-sm focus:outline-none focus:border-foreground/40 transition-colors disabled:opacity-50"
            >
              {roster.map(w => (
                <option key={w.name} value={w.name}>{w.name}{w.alignment ? ` — ${w.alignment}` : ""}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold tracking-wider uppercase text-muted-foreground">Tone</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {PROMO_TONES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setPromoTone(t.value)}
                  disabled={promoMutation.isPending}
                  className={cn(
                    "text-left p-4 rounded-xl border transition-colors disabled:opacity-50",
                    promoTone === t.value ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground hover:border-foreground/30"
                  )}
                >
                  <div className="text-sm font-bold tracking-wider uppercase">{t.label}</div>
                  <div className={cn("text-xs mt-1", promoTone === t.value ? "text-background/70" : "text-muted-foreground")}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 justify-end pb-10 mt-auto">
            <button onClick={() => setActiveView("DESK")} disabled={promoMutation.isPending} className="px-6 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSubmitPromo} disabled={promoMutation.isPending} className="px-6 py-2.5 rounded bg-foreground text-background text-xs font-bold tracking-wider uppercase hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50">
              {promoMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {promoMutation.isPending ? "Writing..." : "Cut The Promo"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Night Notes entry
  if (activeView === "LOG_ENTRY") {
    return (
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Night Notes</h1>
          <p className="text-muted-foreground mt-1">What actually happened on TV tonight. The AI treats this as canon.</p>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <textarea
            autoFocus
            value={logText}
            onChange={e => setLogText(e.target.value)}
            placeholder="What happened on TV tonight? Promo moments, run-ins, audibles, surprises. Anything the AI should treat as canon going forward."
            className="flex-1 w-full min-h-[320px] bg-card border border-border rounded-xl p-5 text-foreground placeholder:text-muted-foreground/50 text-sm leading-relaxed resize-none focus:outline-none focus:border-foreground/40 transition-colors"
          />
          <div className="flex gap-3 justify-end pb-10">
            <button onClick={() => setActiveView("DESK")} className="px-6 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-xs font-bold tracking-wider uppercase transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveLog} className="px-6 py-2.5 rounded bg-foreground text-background text-xs font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
              Save
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Manual creative capture
  if (activeView === "MANUAL_MOMENT") {
    return (
      <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
        <div className="mb-6">
          <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Canon Moment</h1>
          <p className="text-muted-foreground mt-1">
            Capture the story of what happened. This feeds history, rivalries, inbox, news, and future AI context.
          </p>
        </div>
        <div className="flex-1 flex flex-col gap-4">
          <input
            value={manualTitle}
            onChange={(e) => setManualTitle(e.target.value)}
            placeholder="Moment title, e.g. Cody refuses Roman's offer"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-foreground/40"
          />
          <input
            value={manualParticipants}
            onChange={(e) => setManualParticipants(e.target.value)}
            placeholder="Participants, comma-separated, e.g. Cody Rhodes, Roman Reigns"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-foreground/40"
          />
          <textarea
            autoFocus
            value={manualBeat}
            onChange={(e) => setManualBeat(e.target.value)}
            placeholder="What was the story beat? Keep it as the creative note, not a full match result database."
            className="flex-1 w-full min-h-[220px] bg-card border border-border rounded-xl p-5 text-foreground placeholder:text-muted-foreground/50 text-sm leading-relaxed resize-none focus:outline-none focus:border-foreground/40 transition-colors"
          />
          <input
            value={manualHeadline}
            onChange={(e) => setManualHeadline(e.target.value)}
            placeholder="Optional news ticker headline"
            className="w-full bg-card border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:border-foreground/40"
          />
          <div className="flex gap-3 justify-end pb-10">
            <button onClick={() => setActiveView("DESK")} className="px-6 py-2.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 text-xs font-bold tracking-wider uppercase transition-colors">
              Cancel
            </button>
            <button onClick={handleSaveManualMoment} className="px-6 py-2.5 rounded bg-foreground text-background text-xs font-bold tracking-wider uppercase hover:opacity-90 transition-opacity">
              Save Canon Moment
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main desk
  return (
    <div className="w-full max-w-4xl mx-auto h-full flex flex-col">
      <UniverseClock onOpenRoadToPLE={() => setRoadToPLEOpen(true)} />
      <div className="mb-4">
        <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Creative Desk</h1>
        <p className="text-muted-foreground mt-1">Book your next big moment.</p>
      </div>

      {/* Quick Book toolbar */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 mb-4 shrink-0">
        <ToolButton icon={Zap} label="Storyline" onClick={() => handleAction("storyline")} loading={storylineMutation.isPending} disabled={isLoading} />
        <ToolButton icon={Tv2} label="Book Show" onClick={() => handleAction("show")} loading={showMutation.isPending} disabled={isLoading} />
        <ToolButton icon={Shuffle} label="Surprise" onClick={() => handleAction("surprise")} loading={surpriseMutation.isPending} disabled={isLoading} />
        <ToolButton icon={Mic2} label="Promo" onClick={handleOpenPromoPicker} loading={promoMutation.isPending} disabled={isLoading} />
        <ToolButton icon={NotebookPen} label="Canon Moment" onClick={() => setActiveView("MANUAL_MOMENT")} loading={false} disabled={isLoading} />
        <ToolButton icon={NotebookPen} label="Night Notes" onClick={() => setActiveView("LOG_ENTRY")} loading={false} disabled={isLoading} />
      </div>

      {/* Recent saves strip */}
      {recentSaves.length > 0 && (
        <div className="mb-4 shrink-0">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">
            Recent Saves
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {recentSaves.map((entry) => {
              const label = kindLabel(entry.kind);
              const time = formatDistanceToNow(entry.createdAt, { addSuffix: true });
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFocusViewEntry(entry)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card hover:border-foreground/30 hover:bg-muted/30 transition-colors shrink-0 max-w-[180px] group"
                >
                  <KindIcon kind={entry.kind} className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <div className="min-w-0 text-left">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-foreground/80 truncate">
                      {label}
                    </div>
                    <div className="text-[9px] text-muted-foreground/60 truncate">{time}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 min-h-0 pb-10">
        <Chat onToggleFullScreen={() => setFullScreen(true)} />
      </div>

      <RoadToPLE
        open={roadToPLEOpen}
        onOpenChange={setRoadToPLEOpen}
        onNavigate={onNavigate}
      />

      {/* Focus entry view dialog (from Recent saves or sessionStorage) */}
      <FocusEntryDialog
        entry={focusViewEntry}
        onClose={() => setFocusViewEntry(null)}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Focus Entry Dialog — inline view for Recent saves
───────────────────────────────────────────── */
function FocusEntryDialog({
  entry,
  onClose,
}: {
  entry: RivalryEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;

  let dialogTitle = "";
  if (entry.kind === "log") dialogTitle = "Night Note";
  else if (entry.kind === "storyline") dialogTitle = entry.data.feud || "Storyline";
  else if (entry.kind === "show") dialogTitle = entry.data.showName || "Show";
  else if (entry.kind === "surprise") dialogTitle = entry.data.headline || "Surprise";
  else if (entry.kind === "promo") dialogTitle = entry.data.headline || "Promo";
  else if (entry.kind === "magazine") dialogTitle = entry.data.coverHeadline || "Magazine";

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[680px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <KindIcon kind={entry.kind} className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[9px] px-2 py-0.5 rounded font-bold tracking-widest uppercase border border-foreground/20 text-foreground/50 bg-muted/30">
              {kindLabel(entry.kind)}
            </span>
          </div>
          <DialogTitle className="font-display text-xl uppercase tracking-widest text-foreground text-left">
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {entry.kind === "log" && (
            <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-lg p-4">
              {entry.text}
            </p>
          )}

          {entry.kind === "storyline" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/20 rounded p-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Feud</span>
                  <span className="text-sm text-foreground">{entry.data.feud}</span>
                </div>
                <div className="bg-muted/20 rounded p-3">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Participants</span>
                  <span className="text-sm text-foreground">{entry.data.participants.join(" vs ")}</span>
                </div>
              </div>
              <div className="space-y-3">
                {entry.data.beats.map((b, i) => (
                  <div key={i} className="border-l-2 border-foreground/20 pl-3">
                    <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest block mb-0.5">{b.label}</span>
                    <p className="text-sm text-foreground/90">{b.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {entry.kind === "show" && (
            <div className="space-y-3">
              {entry.data.matches.map((m, i) => (
                <div key={i} className="bg-card p-3 rounded border border-border">
                  <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest block mb-1">{m.slot}</span>
                  <p className="text-sm font-bold text-foreground uppercase mb-1.5">{m.match}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p><strong className="text-foreground/70">RESULT:</strong> {m.result}</p>
                    <p><strong className="text-foreground/70">TWIST:</strong> <span className="italic">{m.twist}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {entry.kind === "surprise" && (
            <div className="space-y-3">
              {entry.data.beats.map((b, i) => (
                <div key={i} className="border-l-2 border-foreground/20 pl-3">
                  <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest block mb-0.5">{b.label}</span>
                  <p className="text-sm text-foreground/90">{b.text}</p>
                </div>
              ))}
            </div>
          )}

          {entry.kind === "promo" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[9px] font-bold tracking-widest uppercase text-foreground/60">
                <span className="px-2 py-0.5 border border-foreground/30 rounded">{entry.data.tone}</span>
                <span className="px-2 py-0.5 border border-foreground/30 rounded">{entry.data.stamp}</span>
              </div>
              {entry.data.beats.map((b, i) => (
                <div key={i} className="border-l-2 border-foreground/20 pl-3">
                  <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest block mb-0.5">{b.label}</span>
                  <p className="text-sm text-foreground/90 italic">"{b.text}"</p>
                </div>
              ))}
            </div>
          )}

          {entry.kind === "magazine" && (
            <div className="border-l-2 border-foreground/20 pl-3 space-y-1">
              <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest block">
                Cover Story · Issue #{entry.data.issueNumber}
              </span>
              <p className="text-sm text-foreground/90 italic">{entry.data.coverHeadline}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolButton({
  icon: Icon, label, onClick, loading, disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2 px-4 py-2 rounded-full border border-border",
        "bg-card text-muted-foreground text-xs font-bold tracking-wider uppercase whitespace-nowrap shrink-0",
        "hover:text-foreground hover:border-foreground/40 hover:bg-muted/30 transition-colors",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );
}
