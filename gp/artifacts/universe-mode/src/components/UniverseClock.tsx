import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Undo2, Star, Tv, ClipboardList } from "lucide-react";
import { toast } from "sonner";
import { useGenerateIssue } from "@workspace/api-client-react";
import {
  useUniverseDate,
  useEvents,
  useShows,
  useLastUniverseDate,
  useRoster,
  useChairman,
  useHistory,
  useRivalries,
  useMemories,
  useChampionships,
  useStables,
  useMatchResults,
  useAutoMagazine,
  buildBookerContext,
  useTitleReigns,
  useShowDrafts,
} from "@/lib/storage";
import { ShowDraftLogger } from "./ShowDraftLogger";
import {
  useInboxGenerated,
  useInboxLastFire,
  generateInboxMessagesOnAdvance,
} from "@/lib/inbox";
import { INBOX_TEMPLATES } from "@/lib/inbox-templates";
import { useTokenLog, recordTokenUsage } from "@/lib/tokens";
import { useIssues, resolveWrestlerIdByName, type Issue } from "@/lib/news";
import { CHAIRMEN } from "@/lib/chairmen";
import {
  advanceToNextShow,
  upcomingEvents as sortUpcoming,
  weeksUntil,
  archivePastEvents,
  nightToDay,
  weekKey,
  MONTH_LABELS,
  type UniverseDate,
  type PremiumEvent,
} from "@/lib/calendar";
import { EventsDialog } from "./EventsDialog";
import type { Show } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const UNDO_WINDOW_MS = 8000;

// Display order: MON, TUE, WED, THU, FRI, SAT, SUN.
// Internal storage uses Sunday=0, Monday=1, ..., Saturday=6.
const WEEK_DAY_ORDER: number[] = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT: Record<number, string> = {
  0: "SUN",
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
};

export function UniverseClock({ onOpenRoadToPLE }: { onOpenRoadToPLE?: () => void }) {
  const [date, setDate] = useUniverseDate();
  const [events, setEvents] = useEvents();
  const [shows] = useShows();
  const [lastDate, setLastDate] = useLastUniverseDate();
  const [eventsOpen, setEventsOpen] = useState(false);
  const [draftLoggerOpen, setDraftLoggerOpen] = useState(false);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const [showDrafts] = useShowDrafts();

  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history] = useHistory();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [matchResults] = useMatchResults();
  const [issues, setIssues] = useIssues();
  const [titleReigns] = useTitleReigns();
  const issueMutation = useGenerateIssue();
  const [autoMagazine] = useAutoMagazine();
  const [tokenLog, setTokenLog] = useTokenLog();
  const [inboxGenerated, setInboxGenerated] = useInboxGenerated();
  const [inboxLastFire, setInboxLastFire] = useInboxLastFire();
  const currentChairman = chairman || CHAIRMEN[0];

  // Fire-and-forget weekly issue auto-generation when crossing into a new week,
  // but only if night-notes were logged for the prior week and no issue exists
  // for it yet. The issue is dated to the prior week (the one being recapped).
  const maybeAutoGenerateWeeklyIssue = (prior: UniverseDate, next: UniverseDate) => {
    const priorKey = weekKey(prior);
    if (priorKey === weekKey(next)) return;
    if (!autoMagazine) return;
    if (roster.length < 2) return;
    if (issueMutation.isPending) return;

    const hasLogsThisWeek = history.some(
      (h) => h.kind === "log" && h.universeDate && weekKey(h.universeDate) === priorKey,
    );
    if (!hasLogsThisWeek) return;

    const alreadyHasIssue = issues.some((i) => weekKey(i.universeDate) === priorKey);
    if (alreadyHasIssue) return;

    const nextIssueNumber =
      [...issues].sort((a, b) => b.issueNumber - a.issueNumber)[0]?.issueNumber ?? 0;
    const ctx = buildBookerContext(
      roster,
      currentChairman,
      history,
      shows,
      prior,
      events,
      rivalries,
      memories,
      issues,
      championships,
      stables,
    );

    issueMutation.mutate(
      { data: { ...ctx, issueNumber: nextIssueNumber + 1 } },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "issue", data._usage, prior);
          if ((data as any)?.error) return;
          const featuredId = resolveWrestlerIdByName(
            data.cover.featuredWrestlerName,
            roster,
          );
          const issue: Issue = {
            id: crypto.randomUUID(),
            issueNumber: nextIssueNumber + 1,
            universeDate: prior,
            createdAt: Date.now(),
            cover: {
              masthead: data.cover.masthead,
              primaryHeadline: data.cover.primaryHeadline,
              primarySubhead: data.cover.primarySubhead,
              featuredWrestlerId: featuredId,
              teasers: data.cover.teasers.map((t) => ({
                headline: t.headline,
                dek: t.dek,
                featureIndex: t.featureIndex,
              })),
              burstSticker: data.cover.burstSticker,
              coverColor: data.cover.coverColor,
              suggestedRivalryHint: data.cover.suggestedRivalryHint,
            },
            features: data.features.map((f) => ({
              kind: f.kind,
              headline: f.headline,
              dek: f.dek,
              byline: f.byline,
              body: f.body,
              pullQuote: f.pullQuote,
              featuredWrestlerId: resolveWrestlerIdByName(f.featuredWrestlerName, roster),
            })),
            read: false,
          };
          setIssues((prev) => [issue, ...prev]);
          toast.success("HOT OFF THE PRESS", {
            description: `Issue #${issue.issueNumber} just hit the stands.`,
          });
        },
        // Silent failure — the user can still print manually from the News tab.
        onError: () => {},
      },
    );
  };

  // Auto-clear the undo affordance after 8 seconds.
  useEffect(() => {
    if (!lastDate) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => {
      setLastDate(null);
    }, UNDO_WINDOW_MS);
    return () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, [lastDate, setLastDate]);

  const sortedEvents = sortUpcoming(events, date);
  const nextEvent = sortedEvents[0];

  const handleAdvance = () => {
    const next = advanceToNextShow(date, shows, events);
    if (!next) {
      toast.error("Nothing scheduled", {
        description: "Add a show night or a premium event to advance time.",
      });
      return;
    }
    const surviving = archivePastEvents(events, date, next);
    if (surviving.length !== events.length) {
      setEvents(surviving);
    }
    setLastDate(date);
    setDate(next);

    const { newMessages, nextLastFire } = generateInboxMessagesOnAdvance({
      roster,
      championships,
      history,
      events,
      prior: date,
      next,
      lastFire: inboxLastFire,
      templates: INBOX_TEMPLATES,
      titleReigns,
    });
    if (newMessages.length > 0) {
      setInboxGenerated((prev) => {
        const combined = [...newMessages, ...prev];
        return combined.slice(0, 300);
      });
      setInboxLastFire(nextLastFire);
    }

    maybeAutoGenerateWeeklyIssue(date, next);

    const priorShow = shows.find((s) => nightToDay(s.night) === date.day);
    if (priorShow) {
      const hasResults = matchResults.some(
        (r) =>
          r.date.year === date.year &&
          r.date.month === date.month &&
          r.date.week === date.week &&
          r.date.day === date.day,
      );
      if (!hasResults) {
        toast("Match results not logged", {
          description: `No results recorded for ${priorShow.name}.`,
        });
      }
    }
  };

  const handleUndo = () => {
    if (!lastDate) return;
    setDate(lastDate);
    setLastDate(null);
    toast.success("Time rewound");
  };

  // Group shows by day-of-week so we can paint each cell.
  const showsByDay: Record<number, Show[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const show of shows) {
    const d = nightToDay(show.night);
    if (d !== null) showsByDay[d].push(show);
  }

  // Find any premium events that land in the *current* week.
  const eventsThisWeek: Record<number, PremiumEvent[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
  for (const ev of events) {
    if (ev.month === date.month && ev.week === date.week) {
      eventsThisWeek[ev.day].push(ev);
    }
  }

  return (
    <div className="w-full bg-card border border-border rounded-xl mb-6 overflow-hidden">
      {/* === Weekly schedule strip === */}
      <div className="px-4 pt-3 pb-3 border-b border-border bg-gradient-to-b from-background/40 to-transparent">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-primary rounded-sm" />
            <h3 className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              Weekly Schedule
            </h3>
          </div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            {MONTH_LABELS[date.month - 1]} · WEEK {date.week} · YEAR {date.year + 1}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEK_DAY_ORDER.map((dayIdx) => {
            const dayShows = showsByDay[dayIdx];
            const dayEvents = eventsThisWeek[dayIdx];
            const isCurrent = dayIdx === date.day;
            const primaryShow = dayShows[0];

            return (
              <button
                key={dayIdx}
                type="button"
                onClick={dayEvents.length > 0 ? () => setEventsOpen(true) : undefined}
                className={cn(
                  "relative aspect-[5/4] rounded-md overflow-hidden border-2 group text-left transition-all",
                  isCurrent
                    ? "border-emerald-400 shadow-[0_0_0_2px_rgba(52,211,153,0.15)]"
                    : "border-border hover:border-foreground/40",
                  dayEvents.length > 0 && "cursor-pointer",
                )}
                title={
                  primaryShow
                    ? `${DAY_SHORT[dayIdx]} · ${primaryShow.name}${dayEvents.length > 0 ? ` · ${dayEvents.map((e) => e.name).join(", ")}` : ""}`
                    : `${DAY_SHORT[dayIdx]}${dayEvents.length > 0 ? ` · ${dayEvents.map((e) => e.name).join(", ")}` : ""}`
                }
              >
                {/* Show image backdrop */}
                {primaryShow?.imageUrl ? (
                  <div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${primaryShow.imageUrl})` }}
                  />
                ) : (
                  <div className="absolute inset-0 bg-muted/20" />
                )}
                {/* Dark overlay so text stays readable */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/70" />

                {/* PLE marker top-right */}
                {dayEvents.length > 0 && (
                  <div className="absolute top-1 right-1 z-20 flex items-center gap-1 px-1 py-0.5 rounded bg-amber-500/90 text-black">
                    <Star className="w-2.5 h-2.5 fill-current" />
                    <span className="text-[8px] font-bold tracking-wider uppercase truncate max-w-[60px]">
                      PLE
                    </span>
                  </div>
                )}

                {/* Top-left: day label */}
                <div className="relative z-10 p-1.5 flex flex-col h-full">
                  <div className="flex items-baseline gap-1">
                    <span
                      className={cn(
                        "text-[10px] font-bold tracking-widest",
                        isCurrent ? "text-emerald-300" : "text-foreground/90",
                      )}
                    >
                      {DAY_SHORT[dayIdx]}
                    </span>
                    {isCurrent && (
                      <span className="text-[8px] font-bold tracking-wider uppercase text-emerald-400">
                        · TODAY
                      </span>
                    )}
                  </div>

                  {/* Bottom: show name (or empty) */}
                  <div className="mt-auto min-w-0">
                    {primaryShow ? (
                      <div className="font-display font-bold uppercase tracking-wider text-[11px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        {primaryShow.name}
                      </div>
                    ) : dayEvents.length > 0 ? (
                      <div className="font-display font-bold uppercase tracking-wider text-[10px] leading-tight text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                        {dayEvents[0].name}
                      </div>
                    ) : (
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1">
                        <Tv className="w-2.5 h-2.5" />
                        Dark
                      </div>
                    )}
                    {dayShows.length > 1 && (
                      <div className="text-[8px] uppercase tracking-wider text-white/70 truncate">
                        +{dayShows.length - 1} more
                      </div>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* === Pending draft banner === */}
      {(() => {
        const pending = showDrafts.filter((d) => d.status === "pending");
        if (pending.length === 0) return null;
        const newest = pending[0];
        return (
          <div className="px-4 py-2 border-b border-border bg-amber-500/5">
            <button
              type="button"
              onClick={() => {
                setSelectedDraftId(newest.id);
                setDraftLoggerOpen(true);
              }}
              className="w-full flex items-center gap-2 text-left group"
            >
              <ClipboardList className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400 flex-1">
                {pending.length === 1
                  ? `1 show draft pending — ${newest.showName}`
                  : `${pending.length} show drafts pending — tap to log`}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400/60 group-hover:text-amber-400 transition-colors shrink-0" />
            </button>
          </div>
        );
      })()}

      {/* === Bottom row: next PLE + advance/undo === */}
      <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        {/* Left: next premium event — opens Road To PLE if available, else events dialog */}
        <button
          type="button"
          onClick={() => onOpenRoadToPLE ? onOpenRoadToPLE() : setEventsOpen(true)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left group"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              Next Premium Event
            </div>
            {nextEvent ? (
              <NextEventLine
                date={date}
                eventName={nextEvent.name}
                weeksOut={weeksUntil(nextEvent, date)}
              />
            ) : (
              <div className="text-sm text-muted-foreground italic group-hover:text-foreground transition-colors truncate">
                None scheduled. Tap to add.
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </button>

        {/* Right: advance + undo */}
        <div className="flex items-center gap-2 shrink-0">
          <AnimatePresence>
            {lastDate && (
              <motion.button
                key="undo"
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                onClick={handleUndo}
                className="px-3 py-2 rounded-md text-[10px] font-bold tracking-wider uppercase text-muted-foreground hover:text-foreground border border-transparent hover:border-border flex items-center gap-1.5"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={handleAdvance}
            className="px-4 py-2 rounded-md text-[11px] font-bold tracking-wider uppercase border border-border bg-background hover:bg-foreground hover:text-background hover:border-foreground transition-colors"
          >
            Advance
          </button>
        </div>
      </div>

      <EventsDialog
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        events={events}
        setEvents={setEvents}
        currentDate={date}
      />

      <ShowDraftLogger
        draftId={selectedDraftId}
        open={draftLoggerOpen}
        onOpenChange={setDraftLoggerOpen}
      />
    </div>
  );
}

function NextEventLine({
  date,
  eventName,
  weeksOut,
}: {
  date: UniverseDate;
  eventName: string;
  weeksOut: number;
}) {
  const out =
    weeksOut === 0 ? "THIS WEEK" : weeksOut === 1 ? "1 WEEK OUT" : `${weeksOut} WEEKS OUT`;
  // Use date param to satisfy type (currently unused but kept for future relative formatting).
  void date;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="font-display font-bold uppercase tracking-wider text-sm text-foreground truncate">
        {eventName}
      </span>
      <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 border border-border rounded bg-muted/30 text-muted-foreground shrink-0">
        {out}
      </span>
    </div>
  );
}
