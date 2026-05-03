import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Loader2,
  Swords,
  Trophy,
  Users,
  Zap,
  Edit2,
  Calendar,
  NotebookPen,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useRoster,
  useChairman,
  useHistory,
  useShows,
  useUniverseDate,
  useEvents,
  useRivalries,
  useMemories,
  useChampionships,
  useStables,
  buildBookerContext,
  useUniverseBible,
  useSeasonChronicles,
  type RivalryEntry,
} from "@/lib/storage";
import { useIssues } from "@/lib/news";
import { useGenerateStoryline } from "@workspace/api-client-react";
import {
  weeksUntil,
  upcomingEvents as sortUpcoming,
  formatDate,
} from "@/lib/calendar";
import { rivalryDisplayTitle, sideLabel, compareDate } from "@/lib/rivalry";
import { CaptureCanonDialog } from "@/components/CaptureCanonDialog";
import { EventsDialog } from "@/components/EventsDialog";
import type { AppTab } from "@/components/AppHeader";
import { CHAIRMEN } from "@/lib/chairmen";
import { describeApiError } from "@/lib/api-errors";
import type { Wrestler } from "@workspace/api-client-react";

const BRAND_RED = "#dc1e1e";

interface RoadToPLEProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onNavigate?: (tab: AppTab) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground shrink-0">
        {children}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "warn" | "ok";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded border text-[9px] font-bold tracking-widest uppercase shrink-0",
        tone === "ok" && "border-white/20 text-white/60 bg-white/5",
        tone === "warn" && "border-white/15 text-white/40 bg-white/4",
        tone === "neutral" && "border-border text-muted-foreground bg-background/40"
      )}
    >
      {children}
    </span>
  );
}

export function RoadToPLE({ open, onOpenChange, onNavigate }: RoadToPLEProps) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);

  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history, setHistory] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();
  const [events, setEvents] = useEvents();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [universeBible] = useUniverseBible();
  const [seasonChronicles] = useSeasonChronicles();
  const [issues] = useIssues();

  const storylineMutation = useGenerateStoryline();
  const currentChairman = chairman || CHAIRMEN[0];

  const rosterMap = useMemo(
    () => new Map(roster.map((w) => [w.id, w])),
    [roster]
  );

  const sortedEvents = useMemo(
    () => sortUpcoming(events, universeDate),
    [events, universeDate]
  );
  const nextEvent = sortedEvents[0] ?? null;
  const weeksOut = nextEvent ? weeksUntil(nextEvent, universeDate) : null;

  const activeRivalries = useMemo(
    () =>
      rivalries
        .filter((r) => r.status === "ACTIVE")
        .slice()
        .sort((a, b) => compareDate(b.lastActivityDate, a.lastActivityDate)),
    [rivalries]
  );

  const rivalryMemoriesMap = useMemo(() => {
    const map = new Map<string, typeof memories>();
    for (const m of memories) {
      if (!map.has(m.rivalryId)) map.set(m.rivalryId, []);
      map.get(m.rivalryId)!.push(m);
    }
    return map;
  }, [memories]);

  const activeChampionships = useMemo(
    () => championships.filter((c) => c.active !== false),
    [championships]
  );

  const vacantChampionships = useMemo(
    () =>
      activeChampionships.filter(
        (c) => !c.currentChampionIds || c.currentChampionIds.length === 0
      ),
    [activeChampionships]
  );

  const championIdsInRivalries = useMemo(() => {
    const ids = new Set<string>();
    for (const r of activeRivalries) {
      for (const s of r.sides) {
        for (const id of s.wrestlerIds) ids.add(id);
      }
    }
    return ids;
  }, [activeRivalries]);

  const activeStables = useMemo(
    () => stables.filter((s) => s.status !== "DISBANDED" && s.status !== "INACTIVE"),
    [stables]
  );

  const noCanonRivalries = useMemo(
    () => activeRivalries.filter((r) => (rivalryMemoriesMap.get(r.id) ?? []).length === 0),
    [activeRivalries, rivalryMemoriesMap]
  );

  function championName(ids: string[]): string {
    if (!ids || ids.length === 0) return "VACANT";
    return ids.map((id) => rosterMap.get(id)?.name ?? "Unknown").join(" & ").toUpperCase();
  }

  const focusBeats = useMemo(() => {
    const beats: string[] = [];

    if (nextEvent && weeksOut !== null) {
      if (weeksOut === 0) {
        beats.push(`${nextEvent.name} is this week — finalize your top program and deliver a marquee moment.`);
      } else if (weeksOut === 1) {
        beats.push(`${nextEvent.name} is one week away — escalate the main event and lock in every title match.`);
      } else if (weeksOut <= 4) {
        beats.push(`${weeksOut} weeks to ${nextEvent.name} — the window to build heat is closing. Elevate your top feuds.`);
      }
    }

    for (const r of noCanonRivalries.slice(0, 2)) {
      beats.push(`Log a canon moment for ${rivalryDisplayTitle(r, roster)} — no story beats on the books yet.`);
    }

    for (const c of vacantChampionships.slice(0, 2)) {
      beats.push(`${c.name} is vacant — crown a champion${nextEvent ? ` before ${nextEvent.name}` : ""}.`);
    }

    const champNoDirection = activeChampionships.filter(
      (c) => c.currentChampionIds?.length && !c.currentChampionIds.some((id) => championIdsInRivalries.has(id))
    );
    for (const c of champNoDirection.slice(0, 1)) {
      beats.push(`${championName(c.currentChampionIds ?? [])} holds the ${c.name} with no challenger in sight${nextEvent ? ` heading into ${nextEvent.name}` : ""}.`);
    }

    for (const s of activeStables.filter((s) => s.notes).slice(0, 1)) {
      beats.push(`${s.name}: ${s.notes}`);
    }

    if (beats.length < 3) {
      beats.push("Generate a storyline beat in Creative Desk to keep the story moving.");
    }

    return beats.slice(0, 5);
  }, [nextEvent, weeksOut, noCanonRivalries, roster, vacantChampionships, activeChampionships, championIdsInRivalries, activeStables]);

  const handleAskAI = () => {
    if (roster.length < 2) {
      toast.error("Roster too small", { description: "Add more superstars in the Roster tab first." });
      return;
    }
    const ctx = buildBookerContext(roster, currentChairman, history, shows, universeDate, events, rivalries, memories, issues, championships, stables, undefined, universeBible, seasonChronicles);
    storylineMutation.mutate(
      { data: ctx },
      {
        onSuccess: (data) => {
          const entry: RivalryEntry = { kind: "storyline", id: crypto.randomUUID(), createdAt: Date.now(), universeDate, data };
          setHistory((prev) => [entry, ...prev]);
          toast.success("PLE build angle saved to history", {
            description: "Saved to Creative Desk history. Open Chat for a deeper PLE build conversation.",
          });
        },
        onError: (err) => toast.error("Creative Overruled", { description: describeApiError(err) }),
      }
    );
  };

  const handleNavigate = (tab: AppTab) => {
    onOpenChange(false);
    onNavigate?.(tab);
  };

  const weeksOutLabel =
    weeksOut === null ? null
    : weeksOut === 0 ? "THIS WEEK"
    : weeksOut === 1 ? "1 WEEK OUT"
    : `${weeksOut} WEEKS OUT`;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border text-foreground sm:max-w-3xl max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogTitle className="sr-only">
            {nextEvent ? `Road To ${nextEvent.name}` : "Road To The PLE"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            PLE build sheet — stories, title picture, factions, and focus beats heading into the next premium event.
          </DialogDescription>

          {/* Red accent bar */}
          <div className="h-[3px] w-full shrink-0" style={{ background: BRAND_RED }} />

          {/* Panel header */}
          <div className="px-6 py-4 border-b border-border bg-muted/10 shrink-0">
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
              Creative Desk
            </div>
            <div className="font-display text-xl uppercase tracking-widest text-foreground">
              {nextEvent ? `Road To ${nextEvent.name}` : "Road To The PLE"}
            </div>
          </div>

          {/* Body: left sidebar + right scrollable */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

            {/* ── Left: Event destination sidebar ── */}
            <div className="md:w-56 shrink-0 bg-muted/10 border-b md:border-b-0 md:border-r border-border flex flex-col gap-0 overflow-y-auto">

              {nextEvent ? (
                <>
                  {/* Countdown hero */}
                  <div className="px-5 pt-5 pb-4 border-b border-border">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      Next Premium Event
                    </div>
                    <div className="font-display text-base font-bold uppercase tracking-wider text-foreground leading-snug mb-1">
                      {nextEvent.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground tracking-wide mb-3">
                      {formatDate(nextEvent)}
                    </div>

                    {weeksOut !== null && (
                      <div className="flex flex-col items-start gap-0.5 mb-3">
                        <div
                          className="font-display font-bold tabular-nums leading-none"
                          style={{ fontSize: "3rem", lineHeight: 1, color: weeksOut <= 2 ? BRAND_RED : undefined }}
                        >
                          {weeksOut === 0 ? "NOW" : weeksOut}
                        </div>
                        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                          {weeksOut === 0 ? "THIS WEEK" : weeksOut === 1 ? "WEEK OUT" : "WEEKS OUT"}
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setEventsOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors w-full justify-center"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit Event
                    </button>
                  </div>

                  {/* Notes */}
                  <div className="px-5 py-4 border-b border-border">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      Event Notes
                    </div>
                    {nextEvent.notes ? (
                      <p className="text-xs text-muted-foreground/80 leading-relaxed">
                        {nextEvent.notes}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEventsOpen(true)}
                        className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors text-left leading-relaxed"
                      >
                        No notes — add the hook for this event.
                      </button>
                    )}
                  </div>

                  {/* At-a-glance stats */}
                  <div className="px-5 py-4 flex flex-col gap-2.5">
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
                      At A Glance
                    </div>
                    <StatRow
                      label="Active feuds"
                      value={activeRivalries.length === 0 ? "None" : `${activeRivalries.length}`}
                      warn={activeRivalries.length === 0}
                    />
                    <StatRow
                      label="Vacant titles"
                      value={vacantChampionships.length === 0 ? "Clear" : `${vacantChampionships.length}`}
                      warn={vacantChampionships.length > 0}
                    />
                    <StatRow
                      label="No canon logged"
                      value={noCanonRivalries.length === 0 ? "Clear" : `${noCanonRivalries.length}`}
                      warn={noCanonRivalries.length > 0}
                    />
                    <StatRow
                      label="Active stables"
                      value={activeStables.length === 0 ? "None" : `${activeStables.length}`}
                      warn={false}
                    />
                  </div>
                </>
              ) : (
                <div className="px-5 py-6 flex flex-col gap-3">
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                    No Event Scheduled
                  </div>
                  <p className="text-xs text-muted-foreground/60 leading-relaxed">
                    Add a premium event to unlock the Road To PLE build sheet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setEventsOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded border border-border text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                  >
                    <Calendar className="w-3 h-3" />
                    Add Event
                  </button>
                </div>
              )}
            </div>

            {/* ── Right: Scrollable build sheet ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-7">

              {/* 1. Stories Building */}
              <section>
                <SectionLabel>Stories Building</SectionLabel>
                {activeRivalries.length === 0 ? (
                  <EmptyBlock>No active rivalries — open Rivalries to build the next feud.</EmptyBlock>
                ) : (
                  <div className="space-y-1.5">
                    {activeRivalries.slice(0, 6).map((r) => {
                      const mems = (rivalryMemoriesMap.get(r.id) ?? [])
                        .slice()
                        .sort((a, b) => compareDate(b.date, a.date));
                      const lastMem = mems[0];
                      const [sideA, sideB] = r.sides;
                      const hasCanon = mems.length > 0;
                      return (
                        <div
                          key={r.id}
                          className="border border-border rounded-md bg-background/30"
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <div className="text-xs font-bold tracking-wider uppercase text-foreground truncate">
                                {rivalryDisplayTitle(r, roster)}
                              </div>
                              <div className="text-[10px] text-muted-foreground tracking-wide mt-0.5">
                                {sideA ? sideLabel(sideA, roster) : "—"}
                                <span className="text-muted-foreground/30 mx-1">vs</span>
                                {sideB ? sideLabel(sideB, roster) : "—"}
                              </div>
                            </div>
                            <StatusBadge tone={hasCanon ? "ok" : "warn"}>
                              {hasCanon ? `${mems.length} moment${mems.length > 1 ? "s" : ""}` : "No canon"}
                            </StatusBadge>
                          </div>
                          {lastMem && (
                            <div className="px-4 pb-2.5 text-[10px] text-muted-foreground/55 border-t border-border/40 pt-2 line-clamp-2">
                              {lastMem.text}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 2. Title Picture */}
              <section>
                <SectionLabel>Title Picture</SectionLabel>
                {activeChampionships.length === 0 ? (
                  <EmptyBlock>No titles configured — set up championships in Legacy.</EmptyBlock>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {activeChampionships.map((c) => {
                      const isVacant = !c.currentChampionIds || c.currentChampionIds.length === 0;
                      const hasDirection = c.currentChampionIds?.some((id) => championIdsInRivalries.has(id));
                      const champW = (c.currentChampionIds ?? [])
                        .map((id) => rosterMap.get(id)?.name ?? "")
                        .filter(Boolean);
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-3 border border-border rounded-md bg-background/30 px-3 py-2.5"
                        >
                          {c.imageUrl ? (
                            <img src={c.imageUrl} alt={c.name} className="w-7 h-7 object-contain shrink-0 opacity-75" />
                          ) : (
                            <div className="w-7 h-7 rounded border border-white/8 bg-white/4 flex items-center justify-center shrink-0">
                              <Trophy className="w-3 h-3 text-yellow-500/40" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground truncate">
                              {c.name}
                            </div>
                            <div className={cn("text-xs font-bold tracking-wide uppercase truncate mt-0.5", isVacant ? "text-muted-foreground/50" : "text-foreground")}>
                              {isVacant ? "Vacant" : champW.join(" & ")}
                            </div>
                            {!isVacant && (
                              <div className="text-[9px] font-bold tracking-widest uppercase mt-0.5 text-muted-foreground/50">
                                {hasDirection ? "Active feud" : "No direction"}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 3. Faction Watch */}
              <section>
                <SectionLabel>Faction Watch</SectionLabel>
                {activeStables.length === 0 ? (
                  <EmptyBlock>No active stables — factions add depth to the roster.</EmptyBlock>
                ) : (
                  <div className="space-y-1.5">
                    {activeStables.slice(0, 5).map((s) => {
                      const members = (s.memberIds ?? [])
                        .map((id) => rosterMap.get(id))
                        .filter((w): w is Wrestler => Boolean(w));
                      return (
                        <div
                          key={s.id}
                          className="border border-border rounded-md bg-background/30"
                        >
                          <div className="flex items-center justify-between gap-3 px-4 py-2.5">
                            <div className="min-w-0">
                              <div className="text-xs font-bold tracking-wider uppercase text-foreground truncate">
                                {s.name}
                              </div>
                              {members.length > 0 && (
                                <div className="text-[10px] text-muted-foreground tracking-wide mt-0.5 truncate">
                                  {members.map((w) => w.name).join(", ")}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {s.alignment && (
                                <StatusBadge>{s.alignment}</StatusBadge>
                              )}
                              {s.brand && (
                                <StatusBadge>{s.brand}</StatusBadge>
                              )}
                            </div>
                          </div>
                          {s.notes && (
                            <div className="px-4 pb-2.5 text-[10px] text-muted-foreground/55 border-t border-border/40 pt-2 line-clamp-2">
                              {s.notes}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* 4. This Week's Focus */}
              <section>
                <SectionLabel>This Week's Focus</SectionLabel>
                <div className="space-y-1.5">
                  {focusBeats.map((beat, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 border border-border rounded-md bg-background/30 px-4 py-3"
                    >
                      <span className="text-muted-foreground/30 font-bold text-xs shrink-0 mt-0.5 tabular-nums w-4">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <p className="text-sm text-foreground/80 leading-relaxed">{beat}</p>
                    </div>
                  ))}
                </div>
              </section>

            </div>
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-border flex flex-wrap items-center gap-2 shrink-0 bg-muted/5">
            <button
              type="button"
              onClick={handleAskAI}
              disabled={storylineMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-bold tracking-widest uppercase bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
            >
              {storylineMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              {storylineMutation.isPending ? "Generating..." : "Ask AI For PLE Build"}
            </button>
            <button
              type="button"
              onClick={() => setCaptureOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 bg-card transition-colors"
            >
              <NotebookPen className="w-3.5 h-3.5" />
              Capture Canon
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("rivalries")}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 bg-card transition-colors"
            >
              <Swords className="w-3.5 h-3.5" />
              Rivalries
            </button>
            <button
              type="button"
              onClick={() => handleNavigate("legacy")}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-[11px] font-bold tracking-widest uppercase border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40 bg-card transition-colors"
            >
              <Trophy className="w-3.5 h-3.5" />
              Legacy
            </button>
            <div className="ml-auto">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CaptureCanonDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <EventsDialog
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        events={events}
        setEvents={setEvents}
        currentDate={universeDate}
      />
    </>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground tracking-wide">{label}</span>
      <span className={cn("font-bold tracking-wider uppercase tabular-nums", warn ? "text-foreground/50" : "text-foreground/80")}>
        {value}
      </span>
    </div>
  );
}

function EmptyBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-border rounded-md px-4 py-5 text-center text-[11px] text-muted-foreground/40 tracking-wider uppercase">
      {children}
    </div>
  );
}
