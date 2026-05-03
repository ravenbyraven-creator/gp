import { useEffect, useMemo, useRef, useState } from "react";
import type { Wrestler, SuggestedRivalryHint } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X, Plus, BookOpen, Sparkles, ChevronLeft, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useRivalries,
  useRoster,
  useUniverseDate,
  useHistory,
  type RivalryEntry,
  type ChapterType,
} from "@/lib/storage";
import {
  type Rivalry,
  type RivalrySide,
  rivalryDisplayTitle,
  rivalryMatchupPlain,
  entryParticipantNames,
  resolveNamesToIds,
  splitIntoSides,
  lookupWrestlers,
  allWrestlerIds,
} from "@/lib/rivalry";

const BRAND_RED = "#dc1e1e";

interface CreateRivalryDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTitle?: string;
  initialSideA?: string[];
  initialSideB?: string[];
  initialSideALabel?: string;
  initialSideBLabel?: string;
  onCreated?: (rivalry: Rivalry) => void;
}

type MatchFormat = "1v1" | "tag";

const BRAND_LABELS: Record<string, string> = {
  RAW: "RAW",
  SMACKDOWN: "SmackDown",
  NXT: "NXT",
  FREE_AGENT: "Free Agent",
};

export function CreateRivalryDialog({
  open,
  onOpenChange,
  initialTitle = "",
  initialSideA = [],
  initialSideB = [],
  initialSideALabel = "",
  initialSideBLabel = "",
  onCreated,
}: CreateRivalryDialogProps) {
  const [roster] = useRoster();
  const [rivalries, setRivalries] = useRivalries();
  const [universeDate] = useUniverseDate();

  const [step, setStep] = useState<1 | 2>(1);
  const [format, setFormat] = useState<MatchFormat>("1v1");
  const [title, setTitle] = useState(initialTitle);
  const [sideAIds, setSideAIds] = useState<string[]>(initialSideA);
  const [sideBIds, setSideBIds] = useState<string[]>(initialSideB);
  const [sideALabel, setSideALabel] = useState(initialSideALabel);
  const [sideBLabel, setSideBLabel] = useState(initialSideBLabel);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(initialTitle);
    setSideAIds(initialSideA);
    setSideBIds(initialSideB);
    setSideALabel(initialSideALabel);
    setSideBLabel(initialSideBLabel);
    const hasInitial = initialSideA.length > 0 || initialSideB.length > 0;
    const fmt: MatchFormat = (initialSideA.length > 1 || initialSideB.length > 1) ? "tag" : "1v1";
    setStep(hasInitial ? 2 : 1);
    setFormat(fmt);
    setActiveSlot(initialSideA.length > 0 ? "B" : "A");
    setSearch("");
    setBrandFilter(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSave = sideAIds.length > 0 && sideBIds.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const sideA: RivalrySide = {
      id: crypto.randomUUID(),
      label: sideAIds.length > 1 ? sideALabel.trim() || undefined : undefined,
      wrestlerIds: sideAIds,
    };
    const sideB: RivalrySide = {
      id: crypto.randomUUID(),
      label: sideBIds.length > 1 ? sideBLabel.trim() || undefined : undefined,
      wrestlerIds: sideBIds,
    };
    const rivalry: Rivalry = {
      id: crypto.randomUUID(),
      title: title.trim() || undefined,
      sides: [sideA, sideB],
      status: "ACTIVE",
      createdDate: universeDate,
      lastActivityDate: universeDate,
      historyEntryIds: [],
    };
    setRivalries([rivalry, ...rivalries]);
    onOpenChange(false);
    onCreated?.(rivalry);
    toast.success("Rivalry created");
  };

  const pickWrestler = (wrestlerId: string) => {
    if (format === "1v1") {
      if (activeSlot === "A") {
        setSideAIds([wrestlerId]);
        if (sideBIds.length === 0) setActiveSlot("B");
      } else {
        setSideBIds([wrestlerId]);
        if (sideAIds.length === 0) setActiveSlot("A");
      }
    } else {
      if (activeSlot === "A") {
        setSideAIds(prev => prev.includes(wrestlerId) ? prev.filter(x => x !== wrestlerId) : [...prev, wrestlerId]);
      } else {
        setSideBIds(prev => prev.includes(wrestlerId) ? prev.filter(x => x !== wrestlerId) : [...prev, wrestlerId]);
      }
    }
  };

  const removeFromSide = (side: "A" | "B", id: string) => {
    if (side === "A") setSideAIds(prev => prev.filter(x => x !== id));
    else setSideBIds(prev => prev.filter(x => x !== id));
  };

  const sideAWrestlers = useMemo(() => lookupWrestlers(sideAIds, roster), [sideAIds, roster]);
  const sideBWrestlers = useMemo(() => lookupWrestlers(sideBIds, roster), [sideBIds, roster]);

  const brands = useMemo(() => {
    const seen = new Set<string>();
    roster.forEach(w => { if (w.brand) seen.add(w.brand); });
    return [...seen].sort();
  }, [roster]);

  const filteredRoster = useMemo(() => {
    return roster.filter(w => {
      if (brandFilter && w.brand !== brandFilter) return false;
      if (search) return w.name.toLowerCase().includes(search.toLowerCase());
      return true;
    });
  }, [roster, brandFilter, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[820px] max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">

        {step === 1 ? (
          /* ── STEP 1: FORMAT PICKER ── */
          <div className="flex flex-col p-8 gap-8">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">New Rivalry</div>
              <div className="font-display text-2xl uppercase tracking-widest text-foreground">Choose Format</div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <button
                type="button"
                onClick={() => { setFormat("1v1"); setStep(2); }}
                className="flex flex-col items-center gap-5 p-8 rounded-xl border-2 border-border hover:border-foreground/60 bg-muted/10 hover:bg-muted/20 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-16 h-20 rounded-lg bg-muted/40 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden">
                    <User className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <div className="font-display text-xs tracking-widest" style={{ color: BRAND_RED }}>VS</div>
                  <div className="w-16 h-20 rounded-lg bg-muted/40 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden">
                    <User className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-display text-xl uppercase tracking-widest text-foreground">1 on 1</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">Single competitor per side</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => { setFormat("tag"); setStep(2); }}
                className="flex flex-col items-center gap-5 p-8 rounded-xl border-2 border-border hover:border-foreground/60 bg-muted/10 hover:bg-muted/20 transition-all group"
              >
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-3">
                    <div className="w-12 h-20 rounded-lg bg-muted/40 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden z-10">
                      <User className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <div className="w-12 h-20 rounded-lg bg-muted/50 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden">
                      <User className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  </div>
                  <div className="font-display text-xs tracking-widest" style={{ color: BRAND_RED }}>VS</div>
                  <div className="flex -space-x-3">
                    <div className="w-12 h-20 rounded-lg bg-muted/40 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden z-10">
                      <User className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                    <div className="w-12 h-20 rounded-lg bg-muted/50 border border-border group-hover:border-foreground/40 flex items-center justify-center transition-colors overflow-hidden">
                      <User className="w-6 h-6 text-muted-foreground/50" />
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <div className="font-display text-xl uppercase tracking-widest text-foreground">Tag Team</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground mt-1">Multiple wrestlers per side</div>
                </div>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>CANCEL</Button>
            </div>
          </div>
        ) : (
          /* ── STEP 2: VISUAL BUILDER ── */
          <>
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-muted/10 shrink-0">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="p-1 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Back to format picker"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                New Rivalry · {format === "1v1" ? "1 on 1" : "Tag Team"}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Matchup slots */}
              <div className="p-5 flex items-stretch gap-4">
                <MatchupSlot
                  label="Side A"
                  wrestlers={sideAWrestlers}
                  isActive={activeSlot === "A"}
                  format={format}
                  onClick={() => setActiveSlot("A")}
                  onRemove={(id) => removeFromSide("A", id)}
                  sideLabel={sideALabel}
                  onSideLabelChange={setSideALabel}
                />
                <div className="shrink-0 flex items-center font-display text-xl tracking-widest" style={{ color: BRAND_RED }}>
                  VS
                </div>
                <MatchupSlot
                  label="Side B"
                  wrestlers={sideBWrestlers}
                  isActive={activeSlot === "B"}
                  format={format}
                  onClick={() => setActiveSlot("B")}
                  onRemove={(id) => removeFromSide("B", id)}
                  sideLabel={sideBLabel}
                  onSideLabelChange={setSideBLabel}
                />
              </div>

              {/* Optional title */}
              <div className="px-5 pb-4">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Rivalry title (optional — leave blank to use wrestler names)"
                  className="bg-background border-border text-sm"
                />
              </div>

              {/* Tag mode side selector */}
              {format === "tag" && (
                <div className="px-5 pb-3 flex items-center gap-2">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mr-1">Adding to:</div>
                  {(["A", "B"] as const).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActiveSlot(s)}
                      className={cn(
                        "px-4 py-1.5 rounded text-[11px] font-bold tracking-widest uppercase border transition-colors",
                        activeSlot === s
                          ? "border-foreground bg-foreground text-background"
                          : "border-border text-muted-foreground hover:border-foreground/40"
                      )}
                    >
                      Side {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Brand filter + search */}
              <div className="px-5 pb-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setBrandFilter(null)}
                  className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-colors",
                    brandFilter === null
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40"
                  )}
                >ALL</button>
                {brands.map(b => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBrandFilter(prev => prev === b ? null : b)}
                    className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-colors",
                      brandFilter === b
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40"
                    )}
                  >{BRAND_LABELS[b] ?? b}</button>
                ))}
                <div className="relative flex-1 min-w-[140px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground text-foreground placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Roster grid */}
              <div className="px-5 pb-5 grid grid-cols-5 gap-2.5">
                {filteredRoster.map(w => {
                  const inA = sideAIds.includes(w.id);
                  const inB = sideBIds.includes(w.id);
                  const taken = inA || inB;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => pickWrestler(w.id)}
                      className={cn(
                        "flex flex-col rounded-lg overflow-hidden border-2 transition-all text-left",
                        taken
                          ? "border-foreground/50 opacity-75"
                          : "border-border hover:border-foreground/60"
                      )}
                    >
                      <div className="relative w-full overflow-hidden bg-muted/20" style={{ aspectRatio: "3/4" }}>
                        {w.imageUrl ? (
                          <img
                            src={w.imageUrl}
                            alt={w.name}
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-8 h-8 text-muted-foreground/30" />
                          </div>
                        )}
                        {taken && (
                          <div className="absolute inset-0 flex items-end justify-end p-1.5" style={{ background: "rgba(0,0,0,0.35)" }}>
                            <span
                              className="text-[10px] font-bold tracking-widest px-1.5 py-0.5 rounded"
                              style={{ background: BRAND_RED, color: "#fff" }}
                            >
                              {inA ? "A" : "B"}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="px-1.5 py-1.5 bg-muted/10">
                        <div className="text-[9px] font-bold uppercase tracking-wider text-foreground leading-tight line-clamp-2">
                          {w.name}
                        </div>
                        {w.brand && (
                          <div className="text-[8px] uppercase tracking-wider text-muted-foreground mt-0.5">
                            {BRAND_LABELS[w.brand] ?? w.brand}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <div className="col-span-5 py-12 text-center text-muted-foreground text-sm">
                    No wrestlers match your filter.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-between shrink-0 bg-muted/5">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>CANCEL</Button>
              <Button
                onClick={handleSave}
                disabled={!canSave}
                className="bg-foreground text-background hover:bg-foreground/90 uppercase tracking-widest text-xs"
              >
                Create Rivalry
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MatchupSlot({
  label,
  wrestlers,
  isActive,
  format,
  onClick,
  onRemove,
  sideLabel,
  onSideLabelChange,
}: {
  label: string;
  wrestlers: Wrestler[];
  isActive: boolean;
  format: MatchFormat;
  onClick: () => void;
  onRemove: (id: string) => void;
  sideLabel: string;
  onSideLabelChange: (s: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 min-h-[160px] rounded-xl border-2 transition-all flex flex-col overflow-hidden",
        isActive ? "border-foreground/80" : "border-border hover:border-foreground/30"
      )}
      style={isActive ? { boxShadow: `0 0 0 1px ${BRAND_RED}40, 0 0 20px ${BRAND_RED}15` } : undefined}
    >
      {wrestlers.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 bg-muted/10">
          <div
            className="w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-colors"
            style={{ borderColor: isActive ? BRAND_RED : "var(--border)" }}
          >
            <Plus className="w-5 h-5 transition-colors" style={{ color: isActive ? BRAND_RED : "var(--muted-foreground)" }} />
          </div>
          <div
            className="text-[10px] font-bold tracking-widest uppercase transition-colors"
            style={{ color: isActive ? BRAND_RED : "var(--muted-foreground)" }}
          >
            {label}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 overflow-hidden bg-muted/20" style={{ minHeight: "120px" }}>
            {format === "1v1" && wrestlers[0] ? (
              <>
                {wrestlers[0].imageUrl ? (
                  <img
                    src={wrestlers[0].imageUrl}
                    alt={wrestlers[0].name}
                    className="w-full h-full object-cover object-top absolute inset-0"
                    style={{ pointerEvents: "none" }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="w-12 h-12 text-muted-foreground/30" />
                  </div>
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 60%)" }}
                />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-white leading-tight">
                    {wrestlers[0].name}
                  </div>
                </div>
                {isActive && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRemove(wrestlers[0].id); }}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black/90 transition-colors"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5 p-2">
                {wrestlers.map(w => (
                  <div key={w.id} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border/60 shrink-0">
                    {w.imageUrl ? (
                      <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-muted/40">
                        <User className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                    )}
                    {isActive && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onRemove(w.id); }}
                        className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    )}
                  </div>
                ))}
                {isActive && (
                  <div
                    className="w-14 h-14 rounded-lg border-2 border-dashed flex items-center justify-center shrink-0"
                    style={{ borderColor: BRAND_RED + "60" }}
                  >
                    <Plus className="w-4 h-4" style={{ color: BRAND_RED + "80" }} />
                  </div>
                )}
              </div>
            )}
          </div>
          {format === "tag" && wrestlers.length > 1 && (
            <div className="px-3 py-2 shrink-0 border-t border-border/40" onClick={(e) => e.stopPropagation()}>
              <input
                value={sideLabel}
                onChange={(e) => onSideLabelChange(e.target.value)}
                placeholder={`${label} team name`}
                className="w-full text-[10px] uppercase tracking-wider font-bold bg-transparent border-b border-border focus:outline-none focus:border-foreground text-foreground placeholder:text-muted-foreground/40 py-0.5"
              />
            </div>
          )}
        </div>
      )}
    </button>
  );
}

interface FileToRivalryDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  entry: RivalryEntry;
  suggestedHint?: SuggestedRivalryHint;
  /**
   * "default" — the entry already exists in history; we just link it to a rivalry.
   * "issue-cover" — the magazine entry is constructed on the fly; we insert it
   * into history before linking, and we surface it as a "FILE COVER STORY?" prompt.
   */
  mode?: "default" | "issue-cover";
}

/**
 * Score how well a hint matchup string ("CODY RHODES vs ROMAN REIGNS") matches
 * a rivalry's wrestler set. Returns the number of side names from the hint
 * that appear in the rivalry's wrestler list. Case-insensitive, ignores "vs".
 */
function scoreHintMatch(
  hintMatchup: string,
  rivalry: Rivalry,
  roster: Wrestler[],
): number {
  const tokens = hintMatchup
    .split(/\s+vs\s+|\s+v\.?s\.?\s+|&|,|\//i)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) return 0;
  const wrestlers = lookupWrestlers(allWrestlerIds(rivalry), roster);
  const names = wrestlers.map((w) => w.name.toLowerCase());
  const labels = rivalry.sides
    .map((s) => s.label?.toLowerCase().trim())
    .filter((s): s is string => Boolean(s));
  let hits = 0;
  for (const tok of tokens) {
    const inNames = names.some((n) => n.includes(tok) || tok.includes(n));
    const inLabels = labels.some((l) => l.includes(tok) || tok.includes(l));
    if (inNames || inLabels) hits++;
  }
  return hits;
}

export function FileToRivalryDialog({
  open,
  onOpenChange,
  entry,
  suggestedHint,
  mode = "default",
}: FileToRivalryDialogProps) {
  const [rivalries, setRivalries] = useRivalries();
  const [roster] = useRoster();
  const [universeDate] = useUniverseDate();
  const [, setHistory] = useHistory();
  const [createOpen, setCreateOpen] = useState(false);
  const isCoverMode = mode === "issue-cover";

  // For "issue-cover" mode, the magazine entry doesn't live in history yet.
  // Persist it before linking, but only the first time (idempotent on entry.id).
  const ensureEntryInHistory = () => {
    if (mode !== "issue-cover") return;
    setHistory((prev) => (prev.some((e) => e.id === entry.id) ? prev : [entry, ...prev]));
  };

  const active = useMemo(
    () => rivalries.filter((r) => r.status === "ACTIVE"),
    [rivalries],
  );

  const suggestedRivalryId = useMemo(() => {
    if (!suggestedHint) return null;
    if (suggestedHint.confidence === "low") return null;
    const guess = suggestedHint.matchupGuess?.trim();
    if (!guess) return null;
    let bestId: string | null = null;
    let bestScore = 0;
    for (const r of active) {
      const score = scoreHintMatch(guess, r, roster);
      if (score >= 2 && score > bestScore) {
        bestScore = score;
        bestId = r.id;
      }
    }
    return bestId;
  }, [active, roster, suggestedHint]);

  const noActiveMatch = suggestedHint && !suggestedRivalryId;

  const fileTo = (rivalryId: string) => {
    ensureEntryInHistory();
    setRivalries(
      rivalries.map((r) => {
        if (r.id !== rivalryId) return r;
        if (r.historyEntryIds.includes(entry.id)) return r;
        return {
          ...r,
          historyEntryIds: [...r.historyEntryIds, entry.id],
          lastActivityDate: entry.universeDate ?? universeDate,
        };
      }),
    );
    onOpenChange(false);
    toast.success(isCoverMode ? "Cover story filed" : "Filed to rivalry");
  };

  const prefill = useMemo(() => {
    const ids = resolveNamesToIds(entryParticipantNames(entry), roster);
    const [a, b] = splitIntoSides(ids);
    return { a, b };
  }, [entry, roster]);

  const initialTitle =
    entry.kind === "storyline"
      ? entry.data.feud
      : entry.kind === "show"
        ? entry.data.showName
        : entry.kind === "magazine"
          ? entry.data.coverHeadline
          : "";

  const sortedActive = useMemo(() => {
    if (!suggestedRivalryId) return active;
    const top = active.find((r) => r.id === suggestedRivalryId);
    if (!top) return active;
    return [top, ...active.filter((r) => r.id !== suggestedRivalryId)];
  }, [active, suggestedRivalryId]);

  return (
    <>
      <Dialog open={open && !createOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-widest text-foreground">
              {isCoverMode ? "File Cover Story?" : "File to Rivalry"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {isCoverMode && entry.kind === "magazine" && (
              <div className="rounded border border-border bg-muted/20 px-3 py-2">
                <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
                  Issue #{entry.data.issueNumber} cover
                </div>
                <div className="font-display text-sm uppercase tracking-wider text-foreground leading-tight">
                  {entry.data.coverHeadline}
                </div>
              </div>
            )}

            {noActiveMatch && (
              <div className="flex items-start gap-2 px-3 py-2 rounded border border-border bg-muted/20">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                <div className="text-[11px] leading-snug text-muted-foreground">
                  No active rivalry matches this. Start a new one below.
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                File to existing
              </label>
              {active.length === 0 ? (
                <p className="text-sm text-muted-foreground italic px-1">
                  No active rivalries yet. Create your first one below.
                </p>
              ) : (
                <div className="max-h-[40vh] overflow-y-auto rounded border border-border bg-popover">
                  {sortedActive.map((r) => {
                    const isSuggested = r.id === suggestedRivalryId;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => fileTo(r.id)}
                        disabled={r.historyEntryIds.includes(entry.id)}
                        className={cn(
                          "w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors border-b border-border last:border-b-0 disabled:opacity-50 disabled:pointer-events-none",
                          isSuggested && "bg-muted/30",
                        )}
                        style={isSuggested ? { borderLeft: `2px solid ${BRAND_RED}` } : undefined}
                      >
                        {isSuggested && (
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3 h-3" style={{ color: BRAND_RED }} />
                            <span
                              className="text-[9px] font-bold tracking-widest uppercase"
                              style={{ color: BRAND_RED }}
                            >
                              AI suggested this rivalry
                            </span>
                          </div>
                        )}
                        <div className="font-display text-sm uppercase tracking-wider text-foreground truncate">
                          {rivalryDisplayTitle(r, roster)}
                        </div>
                        {r.title && (
                          <div className="text-[11px] uppercase tracking-wider text-muted-foreground truncate mt-0.5">
                            {rivalryMatchupPlain(r, roster)}
                          </div>
                        )}
                        {r.historyEntryIds.includes(entry.id) && (
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                            Already filed
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="h-px bg-border w-full" />

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className={cn(
                "w-full bg-transparent border text-foreground py-3 rounded text-xs font-bold tracking-widest uppercase transition-colors flex items-center justify-center gap-2",
                noActiveMatch
                  ? "border-foreground/60 hover:border-foreground"
                  : "border-border hover:border-foreground/40",
              )}
            >
              <BookOpen className="w-4 h-4" />
              Create new rivalry from this
            </button>
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              CANCEL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateRivalryDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
          if (!v) onOpenChange(false);
        }}
        initialTitle={initialTitle}
        initialSideA={prefill.a}
        initialSideB={prefill.b}
        onCreated={(r) => {
          ensureEntryInHistory();
          // After creation, file this entry to the new rivalry.
          setRivalries((curr) =>
            curr.map((x) =>
              x.id === r.id
                ? {
                    ...x,
                    historyEntryIds: [entry.id],
                    lastActivityDate: entry.universeDate ?? universeDate,
                  }
                : x,
            ),
          );
          toast.success(isCoverMode ? "Cover story filed to new rivalry" : "Filed to new rivalry");
        }}
      />
    </>
  );
}

interface ChatToRivalryDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  text: string;
}

export function ChatToRivalryDialog({
  open,
  onOpenChange,
  text,
}: ChatToRivalryDialogProps) {
  const [rivalries, setRivalries] = useRivalries();
  const [roster] = useRoster();
  const [universeDate] = useUniverseDate();
  const [, setHistory] = useHistory();
  const [createOpen, setCreateOpen] = useState(false);
  const [logText, setLogText] = useState("");
  const [chapter, setChapter] = useState<ChapterType | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLogText(text.trim());
    setChapter(null);
  }, [open, text]);

  // Auto-resize textarea whenever logText changes
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [logText]);

  const active = useMemo(
    () => rivalries.filter((r) => r.status === "ACTIVE"),
    [rivalries],
  );

  const buildEntry = (): Extract<RivalryEntry, { kind: "log" }> => ({
    kind: "log",
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    universeDate,
    text: logText.trim(),
    ...(chapter ? { chapter } : {}),
  });

  const fileLogTo = (rivalryId: string) => {
    const trimmed = logText.trim();
    if (!trimmed) {
      toast.error("Write a log entry first.");
      return;
    }
    const entry = buildEntry();
    setHistory((prev) => [entry, ...prev]);
    setRivalries((prev) =>
      prev.map((r) => {
        if (r.id !== rivalryId) return r;
        if (r.historyEntryIds.includes(entry.id)) return r;
        return {
          ...r,
          historyEntryIds: [...r.historyEntryIds, entry.id],
          lastActivityDate: universeDate,
        };
      }),
    );
    onOpenChange(false);
    toast.success("Saved to rivalry history");
  };

  const CHAPTER_LABELS: ChapterType[] = [
    "BEGINNING",
    "ESCALATION",
    "TURNING POINT",
    "FALLOUT",
    "BLOWOFF",
  ];

  return (
    <>
      <Dialog open={open && !createOpen} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-[540px] p-0 gap-0 overflow-hidden flex flex-col max-h-[90vh]">

          {/* ── Header ── */}
          <div className="shrink-0 px-5 pt-5 pb-4 border-b border-border bg-muted/10">
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-1">
              Creative Desk / Rivalry
            </div>
            <DialogTitle className="font-display text-xl uppercase tracking-widest text-foreground leading-tight">
              Save to History
            </DialogTitle>
            <DialogDescription className="sr-only">
              Save a chat beat as a log entry in a rivalry's history, with an optional chapter tag.
            </DialogDescription>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* The Beat */}
            <div className="border-b border-border">
              {/* Section label */}
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-[3px] h-5 rounded-sm shrink-0" style={{ background: BRAND_RED }} />
                  <span className="font-display text-base uppercase tracking-widest text-foreground">
                    The Beat
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">
                  Edit before filing
                </span>
              </div>
              {/* Textarea card */}
              <div className="mx-5 mb-5 rounded border border-border overflow-hidden bg-background">
                <textarea
                  ref={textareaRef}
                  value={logText}
                  onChange={(e) => setLogText(e.target.value)}
                  style={{ minHeight: "100px", height: "auto", overflow: "hidden" }}
                  className="w-full bg-transparent px-4 py-3.5 text-sm leading-loose focus:outline-none resize-none text-foreground placeholder:text-muted-foreground/30"
                  placeholder="The key story moment — trim the AI's reply to the one beat worth keeping."
                />
                <div className="px-4 py-2 border-t border-border/60 flex items-center justify-between bg-muted/10">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                    Creative Note
                  </span>
                  <span
                    className="text-[9px] uppercase tracking-widest"
                    style={{ color: logText.length > 600 ? BRAND_RED : "var(--muted-foreground)" }}
                  >
                    {logText.length} chars
                  </span>
                </div>
              </div>
            </div>

            {/* Chapter Tag */}
            <div className="px-5 pt-4 pb-4 border-b border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-[3px] h-3.5 rounded-full shrink-0 bg-muted-foreground/30" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    Chapter Tag
                  </span>
                </div>
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground/50">
                  Optional
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {CHAPTER_LABELS.map((c) => {
                  const isSelected = chapter === c;
                  const lines = c === "TURNING POINT" ? ["TURNING", "POINT"] : [c];
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChapter((prev) => (prev === c ? null : c))}
                      className={cn(
                        "py-2.5 px-1 rounded border transition-all flex flex-col items-center justify-center gap-0.5",
                        isSelected
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-muted/10 text-muted-foreground hover:border-foreground/50 hover:text-foreground hover:bg-muted/20",
                      )}
                    >
                      {lines.map((line) => (
                        <span
                          key={line}
                          className="text-[8px] font-bold tracking-widest uppercase leading-tight"
                        >
                          {line}
                        </span>
                      ))}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rivalry picker */}
            <div className="px-5 pt-4 pb-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-[3px] h-3.5 rounded-full shrink-0 bg-muted-foreground/30" />
                  <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    File to Rivalry
                  </span>
                </div>
                {active.length > 0 && (
                  <span className="text-[10px] tracking-widest uppercase text-muted-foreground/50">
                    {active.length} active
                  </span>
                )}
              </div>

              {active.length === 0 ? (
                <div className="rounded border border-border bg-muted/10 px-4 py-6 text-center space-y-1">
                  <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/60">
                    No active rivalries
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                    Create one below to get started
                  </div>
                </div>
              ) : (
                <div className="rounded border border-border overflow-hidden divide-y divide-border bg-popover">
                  {active.map((r) => {
                    const sideAImg = lookupWrestlers(r.sides[0]?.wrestlerIds ?? [], roster)[0]?.imageUrl;
                    const sideBImg = lookupWrestlers(r.sides[1]?.wrestlerIds ?? [], roster)[0]?.imageUrl;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => fileLogTo(r.id)}
                        disabled={!logText.trim()}
                        className="group w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      >
                        {/* Wrestler portrait thumbnails */}
                        <div className="flex shrink-0 items-center">
                          {[
                            { img: sideAImg, z: 2 },
                            { img: sideBImg, z: 1 },
                          ].map(({ img, z }, i) => (
                            <div
                              key={i}
                              className="w-8 h-11 rounded overflow-hidden border border-border bg-muted/30 shrink-0"
                              style={{ marginLeft: i === 0 ? 0 : "-7px", zIndex: z, position: "relative" }}
                            >
                              {img ? (
                                <img
                                  src={img}
                                  alt=""
                                  className="w-full h-full object-cover object-top"
                                  style={{ filter: "brightness(0.9) contrast(1.05)" }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <User className="w-3 h-3 text-muted-foreground/30" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Name */}
                        <div className="flex-1 min-w-0">
                          <div className="font-display text-sm uppercase tracking-widest text-foreground truncate leading-tight">
                            {rivalryDisplayTitle(r, roster)}
                          </div>
                          {r.title && (
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 truncate mt-0.5">
                              {rivalryMatchupPlain(r, roster)}
                            </div>
                          )}
                        </div>

                        {/* File CTA */}
                        <span
                          className="text-[9px] font-bold tracking-widest uppercase shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ color: BRAND_RED }}
                        >
                          FILE →
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded border border-dashed border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors text-[10px] font-bold tracking-widest uppercase"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Create new rivalry first
              </button>
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="shrink-0 px-5 py-3 border-t border-border bg-muted/5 flex justify-end">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-xs uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
          </div>

        </DialogContent>
      </Dialog>

      <CreateRivalryDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v);
        }}
        onCreated={(r) => {
          const trimmed = logText.trim();
          if (trimmed) {
            const entry = buildEntry();
            setHistory((prev) => [entry, ...prev]);
            setRivalries((prev) =>
              prev.map((x) =>
                x.id === r.id
                  ? {
                      ...x,
                      historyEntryIds: [entry.id],
                      lastActivityDate: universeDate,
                    }
                  : x,
              ),
            );
            toast.success("Saved to new rivalry history");
          }
          onOpenChange(false);
        }}
      />
    </>
  );
}

/** Re-export for convenience */
export { cn };
