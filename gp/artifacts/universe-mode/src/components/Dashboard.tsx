import { useMemo, useState } from "react";
import {
  useRoster,
  useChampionships,
  useStables,
  useRivalries,
  useHistory,
  useMemories,
  useUniverseDate,
  useEvents,
  useShows,
  useMatchResults,
  useFeuArcMilestones,
  type ChapterType,
} from "@/lib/storage";
import { ARC_MILESTONES, ACT_META, deriveCurrentAct } from "@/lib/feudArc";
import { deriveWrestlerStats } from "@/lib/matches";
import { MatchLogger } from "@/components/MatchLogger";
import { QuickLog } from "@/components/QuickLog";
import { TapLog } from "@/components/TapLog";
import { ContenderBoard } from "@/components/ContenderBoard";
import type { AppTab } from "@/components/AppHeader";
import { useInboxUnreadCount, useInboxReadIds, buildMessages } from "@/components/WrestlerInbox";
import { useInboxGenerated, useInboxArchivedIds, useInboxDeletedIds } from "@/lib/inbox";
import { rivalryDisplayTitle, sideLabel, compareDate } from "@/lib/rivalry";
import { formatDate, weeksUntil, upcomingEvents as sortUpcoming, nightToDay } from "@/lib/calendar";
import type { Wrestler } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Swords,
  Users,
  Inbox,
  AlertTriangle,
  Zap,
  ChevronRight,
  Activity,
  NotebookPen,
  Flag,
  ArrowRight,
  TrendingUp,
  ClipboardList,
  BarChart2,
} from "lucide-react";
import { CaptureCanonDialog } from "@/components/CaptureCanonDialog";

interface DashboardProps {
  onNavigate: (tab: AppTab) => void;
}

function SectionLabel({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-white/30 shrink-0" />
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/30">{label}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-md border border-white/10 bg-black/60 backdrop-blur-sm p-5", className)}>
      {children}
    </div>
  );
}

function ClickableCard({ onClick, children, className }: { onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded border border-white/8 bg-white/4 hover:bg-white/8 hover:border-white/16 transition-colors px-4 py-3 group",
        className
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-6 text-muted-foreground/40 text-xs font-medium tracking-wider uppercase">
      {message}
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [captureOpen, setCaptureOpen] = useState(false);
  const [matchLoggerOpen, setMatchLoggerOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const [tapLogOpen, setTapLogOpen] = useState(false);
  const [roster] = useRoster();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [rivalries] = useRivalries();
  const [history] = useHistory();
  const [memories] = useMemories();
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const [shows] = useShows();
  const [matchResults] = useMatchResults();
  const [feudArcMilestones] = useFeuArcMilestones();
  const inboxUnread = useInboxUnreadCount();

  const rosterMap = useMemo(() => new Map(roster.map((w) => [w.id, w])), [roster]);
  const rosterNameMap = useMemo(() => new Map(roster.map((w) => [w.name.toLowerCase(), w])), [roster]);

  const [readIds] = useInboxReadIds();
  const [inboxGenerated] = useInboxGenerated();
  const [inboxArchivedIds] = useInboxArchivedIds();
  const [inboxDeletedIds] = useInboxDeletedIds();
  const readSet = useMemo(() => new Set(readIds), [readIds]);

  const recentMessages = useMemo(() => {
    const archivedSet = new Set(inboxArchivedIds);
    const deletedSet = new Set(inboxDeletedIds);

    const historyMsgs = buildMessages(history, rosterNameMap).filter(
      (m) => !archivedSet.has(m.id) && !deletedSet.has(m.id)
    );

    const generatedMsgs = inboxGenerated
      .filter((g) => !archivedSet.has(g.id) && !deletedSet.has(g.id))
      .map((g) => {
        const w = g.fromWrestlerId
          ? roster.find((r) => r.id === g.fromWrestlerId)
          : undefined;
        return {
          id: g.id,
          from: g.fromName,
          subject: g.subject,
          body: g.body,
          date: new Date(g.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          location: w?.brand ?? g.senderType,
          imageUrl: w?.imageUrl,
          wrestlerId: g.fromWrestlerId,
          _timestamp: g.generatedAt,
        };
      });

    const combined = [...historyMsgs, ...generatedMsgs];
    combined.sort((a, b) => (b._timestamp ?? 0) - (a._timestamp ?? 0));
    return combined.slice(0, 5);
  }, [history, rosterNameMap, inboxGenerated, inboxArchivedIds, inboxDeletedIds, roster]);

  const activeChampionships = useMemo(
    () => championships.filter((c) => c.active !== false),
    [championships]
  );

  const activeRivalries = useMemo(
    () =>
      rivalries
        .filter((r) => r.status === "ACTIVE")
        .slice()
        .sort((a, b) => compareDate(b.lastActivityDate, a.lastActivityDate)),
    [rivalries]
  );

  const activeStables = useMemo(
    () => stables.filter((s) => s.status !== "DISBANDED" && s.status !== "INACTIVE"),
    [stables]
  );


  const rivalryMemoriesMap = useMemo(() => {
    const map = new Map<string, typeof memories>();
    for (const m of memories) {
      if (!map.has(m.rivalryId)) map.set(m.rivalryId, []);
      map.get(m.rivalryId)!.push(m);
    }
    return map;
  }, [memories]);

  const looseThreadRivalries = useMemo(
    () =>
      activeRivalries.filter((r) => {
        const mems = rivalryMemoriesMap.get(r.id) ?? [];
        return mems.length === 0;
      }),
    [activeRivalries, rivalryMemoriesMap]
  );

  const vacantTitles = useMemo(
    () =>
      activeChampionships.filter(
        (c) => !c.currentChampionIds || c.currentChampionIds.length === 0
      ),
    [activeChampionships]
  );

  const briefPoints = useMemo(() => {
    const pts: string[] = [];
    if (activeRivalries.length === 0) pts.push("No active rivalries on the books — time to ignite a new feud.");
    else pts.push(`${activeRivalries.length} active ${activeRivalries.length === 1 ? "rivalry" : "rivalries"} in progress.`);
    if (vacantTitles.length > 0)
      pts.push(`${vacantTitles.length} vacant ${vacantTitles.length === 1 ? "title" : "titles"} — championship picture needs attention.`);
    if (inboxUnread > 0)
      pts.push(`${inboxUnread} unread talent ${inboxUnread === 1 ? "message" : "messages"} in your inbox.`);
    if (looseThreadRivalries.length > 0)
      pts.push(`${looseThreadRivalries.length} active ${looseThreadRivalries.length === 1 ? "rivalry has" : "rivalries have"} no canon moments logged yet.`);
    if (activeStables.length === 0 && roster.length > 5)
      pts.push("No stables active — consider forming factions to deepen the roster landscape.");
    if (pts.length < 3 && roster.length === 0)
      pts.push("Roster is empty — import or add superstars to get started.");
    if (pts.length < 3)
      pts.push("Head into Creative Desk to generate your next show or storyline beat.");
    return pts.slice(0, 5);
  }, [activeRivalries, vacantTitles, inboxUnread, looseThreadRivalries, activeStables, roster]);

  const todayShow = useMemo(() => {
    if (!universeDate || shows.length === 0) return null;
    return shows.find((s) => nightToDay(s.night) === universeDate.day) ?? null;
  }, [shows, universeDate]);

  const hottestStreaks = useMemo(() => {
    if (matchResults.length === 0 || roster.length === 0) return [];
    return roster
      .map((w) => ({ wrestler: w, stats: deriveWrestlerStats(w.id, matchResults) }))
      .filter(({ stats }) => stats.currentStreak.length >= 2 && stats.currentStreak.kind !== "N")
      .sort((a, b) => b.stats.currentStreak.length - a.stats.currentStreak.length)
      .slice(0, 5);
  }, [roster, matchResults]);

  const dateLabel = useMemo(() => {
    if (!universeDate || (universeDate.year === 0 && universeDate.month === 1 && universeDate.week === 1 && universeDate.day === 1))
      return null;
    return formatDate(universeDate);
  }, [universeDate]);

  const nextEvent = useMemo(() => {
    if (!universeDate || events.length === 0) return null;
    const sorted = [...events].sort((a, b) => {
      const diffMonth = a.month - b.month;
      if (diffMonth !== 0) return diffMonth;
      return a.week - b.week;
    });
    return sorted.find(
      (e) =>
        e.month > universeDate.month ||
        (e.month === universeDate.month && e.week >= universeDate.week)
    ) ?? sorted[0];
  }, [events, universeDate]);

  function championName(ids: string[]): string {
    if (!ids || ids.length === 0) return "VACANT";
    return ids
      .map((id) => rosterMap.get(id)?.name ?? "Unknown")
      .join(" & ")
      .toUpperCase();
  }

  const seasonRatings = useMemo(() => {
    if (!universeDate) return [];
    return history
      .filter((h): h is Extract<typeof h, { kind: "results" }> => h.kind === "results")
      .filter((h) => h.universeDate?.year === universeDate.year && h.universeDate?.month === universeDate.month)
      .filter((h) => (h.data as { matchStars?: number; crowdStars?: number }).matchStars || (h.data as { matchStars?: number; crowdStars?: number }).crowdStars)
      .map((h) => {
        const d = h.data as { showName?: string; matchStars?: number; crowdStars?: number };
        const ms = d.matchStars ?? 0;
        const cs = d.crowdStars ?? 0;
        const overall = ms > 0 && cs > 0 ? (ms + cs) / 2 : ms || cs;
        return {
          id: h.id,
          showName: d.showName ?? "House Show",
          matchStars: ms,
          crowdStars: cs,
          overall,
          week: h.universeDate?.week ?? 0,
        };
      })
      .sort((a, b) => a.week - b.week);
  }, [history, universeDate]);

  const seasonAvg = useMemo(() => {
    if (seasonRatings.length === 0) return null;
    return seasonRatings.reduce((sum, r) => sum + r.overall, 0) / seasonRatings.length;
  }, [seasonRatings]);

  const suggestedBeats = useMemo(() => {
    const beats: { label: string; detail: string; tab: AppTab }[] = [];
    if (activeRivalries.length === 0)
      beats.push({ label: "Start a new rivalry", detail: "No active feuds — open Rivalries to build the next story.", tab: "rivalries" });
    else
      beats.push({ label: "Log a canon moment", detail: "Document what happened last week in an active rivalry.", tab: "rivalries" });
    if (vacantTitles.length > 0)
      beats.push({ label: "Crown a new champion", detail: `${vacantTitles[0].name} is vacant — assign a titleholder.`, tab: "roster" });
    beats.push({ label: "Generate a storyline beat", detail: "Use Creative Desk to produce the next chapter of a feud.", tab: "desk" });
    if (inboxUnread > 0)
      beats.push({ label: "Check your inbox", detail: `${inboxUnread} talent message${inboxUnread > 1 ? "s" : ""} waiting for your attention.`, tab: "inbox" });
    return beats.slice(0, 4);
  }, [activeRivalries, vacantTitles, inboxUnread]);

  return (
    <div className="relative min-h-full">
      <div
        className="fixed inset-0 bg-center bg-cover pointer-events-none z-0"
        style={{ backgroundImage: "url('/gorilla-bg.png')" }}
      />
      <div className="fixed inset-0 bg-black/82 pointer-events-none z-0" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">

        <div className="border-b border-white/10 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#dc1e1e] mb-1">Command Center</div>
              <h1 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-wider text-white">
                Gorilla Position
              </h1>
              <p className="text-xs text-muted-foreground mt-1 tracking-wide">
                Everything you need before the show goes live.
              </p>
            </div>
            <div className="flex flex-col items-start sm:items-end gap-2 text-right">
              {dateLabel && (
                <div className="text-xs font-bold tracking-widest uppercase text-foreground/70">{dateLabel}</div>
              )}
              {nextEvent && (
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Next: <span className="text-foreground/70 font-bold">{nextEvent.name}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-[10px] tracking-widest uppercase text-muted-foreground/60">
                <span>{roster.length} superstars</span>
                <span>{activeRivalries.length} feuds</span>
                <span>{activeChampionships.length} titles</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {todayShow && (
                  <button
                    type="button"
                    onClick={() => setTapLogOpen(true)}
                    className="flex items-center gap-1.5 mt-1 px-4 py-2 rounded border border-[#dc1e1e]/70 bg-[#dc1e1e]/20 hover:bg-[#dc1e1e]/30 hover:border-[#dc1e1e] transition-colors text-[11px] font-bold tracking-[0.18em] uppercase text-[#dc1e1e] shadow-sm"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    File Show
                  </button>
                )}
                {todayShow && (
                  <button
                    type="button"
                    onClick={() => setQuickLogOpen(true)}
                    className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded border border-white/15 bg-white/6 hover:bg-white/10 hover:border-white/25 transition-colors text-[10px] font-bold tracking-[0.18em] uppercase text-foreground/50 hover:text-foreground"
                  >
                    <ClipboardList className="w-3 h-3" />
                    Detailed
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCaptureOpen(true)}
                  className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded border border-white/15 bg-white/6 hover:bg-white/10 hover:border-white/25 transition-colors text-[10px] font-bold tracking-[0.18em] uppercase text-foreground/70 hover:text-foreground"
                >
                  <NotebookPen className="w-3 h-3" />
                  Capture Canon
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          <div className="md:col-span-2 space-y-6">

            <Panel>
              <SectionLabel icon={Activity} label="Tonight's Creative Brief" />
              <ul className="space-y-2">
                {briefPoints.map((pt, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="text-white/25 font-bold text-xs shrink-0 mt-0.5">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm text-foreground/80 leading-relaxed">{pt}</span>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel>
              <SectionLabel icon={Swords} label="Top Stories" />
              {activeRivalries.length === 0 ? (
                <EmptyState message="No active rivalries — head to Rivalries to build the next feud." />
              ) : (
                <div className="space-y-2">
                  {activeRivalries.slice(0, 5).map((r) => {
                    const mems = (rivalryMemoriesMap.get(r.id) ?? [])
                      .slice()
                      .sort((a, b) => compareDate(b.date, a.date));
                    const lastMem = mems[0];
                    const [sideA, sideB] = r.sides;

                    // Arc stage badge
                    const rivalryEntries = history.filter((h) => r.historyEntryIds.includes(h.id));
                    const chapterTypesSeen = new Set<ChapterType>(
                      rivalryEntries.map((e) => e.chapter).filter(Boolean) as ChapterType[]
                    );
                    const currentAct = deriveCurrentAct(chapterTypesSeen);
                    const arcMeta = ACT_META[currentAct];
                    const checkedIds = new Set<string>(feudArcMilestones[r.id] ?? []);
                    const arcDone = ARC_MILESTONES.filter((m) => m.act === currentAct && checkedIds.has(m.id)).length;
                    const arcTotal = ARC_MILESTONES.filter((m) => m.act === currentAct).length;

                    return (
                      <ClickableCard key={r.id} onClick={() => onNavigate("rivalries")}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold tracking-wider uppercase text-foreground truncate">
                              {rivalryDisplayTitle(r, roster)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 tracking-wide">
                              {sideA ? sideLabel(sideA, roster) : "—"} <span className="text-white/25">VS</span> {sideB ? sideLabel(sideB, roster) : "—"}
                            </div>
                            {lastMem && (
                              <div className="text-[10px] text-muted-foreground/50 mt-1 line-clamp-1">
                                {lastMem.text}
                              </div>
                            )}
                            {/* Arc stage pill */}
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <div
                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                style={{ background: arcMeta.color }}
                              />
                              <span
                                className="text-[9px] font-bold uppercase tracking-widest"
                                style={{ color: arcMeta.color }}
                              >
                                {arcMeta.shortLabel}
                              </span>
                              <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                                · {arcDone}/{arcTotal}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={cn(
                              "text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border",
                              mems.length > 0
                                ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                                : "text-amber-400 border-amber-400/30 bg-amber-400/10"
                            )}>
                              {mems.length > 0 ? `${mems.length} moment${mems.length > 1 ? "s" : ""}` : "No canon"}
                            </span>
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                          </div>
                        </div>
                      </ClickableCard>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel>
              <SectionLabel icon={AlertTriangle} label="Loose Threads" />
              {looseThreadRivalries.length === 0 && vacantTitles.length === 0 ? (
                <EmptyState message="No loose threads — the books are clean." />
              ) : (
                <div className="space-y-2">
                  {vacantTitles.map((c) => (
                    <ClickableCard key={c.id} onClick={() => onNavigate("roster")}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold tracking-wider uppercase text-amber-400">{c.name}</div>
                          <div className="text-[10px] text-muted-foreground tracking-wide mt-0.5">Title is vacant — no champion assigned.</div>
                        </div>
                        <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border text-amber-400 border-amber-400/30 bg-amber-400/10 shrink-0">Vacant</span>
                      </div>
                    </ClickableCard>
                  ))}
                  {looseThreadRivalries.slice(0, 4).map((r) => (
                    <ClickableCard key={r.id} onClick={() => onNavigate("rivalries")}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold tracking-wider uppercase text-foreground">{rivalryDisplayTitle(r, roster)}</div>
                          <div className="text-[10px] text-muted-foreground tracking-wide mt-0.5">Active rivalry with no canon moments logged.</div>
                        </div>
                        <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </div>
                    </ClickableCard>
                  ))}
                </div>
              )}
            </Panel>

            <Panel>
              <SectionLabel icon={Zap} label="Suggested Next Beats" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggestedBeats.map((b, i) => (
                  <ClickableCard key={i} onClick={() => onNavigate(b.tab)}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold tracking-wider uppercase text-foreground/80">{b.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{b.detail}</div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-white/50 transition-colors shrink-0 mt-0.5" />
                    </div>
                  </ClickableCard>
                ))}
              </div>
            </Panel>
          </div>

          <div className="space-y-6">

            {/* Road To PLE preview card */}
            {nextEvent && (() => {
              const wo = weeksUntil(nextEvent, universeDate);
              const storiesCount = activeRivalries.length;
              const woLabel = wo === 0 ? "This week" : wo === 1 ? "1 week out" : `${wo} weeks out`;
              return (
                <Panel className="border-white/15 bg-black/70">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <Flag className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground/50">
                        Road To The PLE
                      </span>
                    </div>
                  </div>
                  <div className="font-display font-bold uppercase tracking-widest text-base text-foreground leading-tight mb-1">
                    {nextEvent.name}
                  </div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-3">
                    {woLabel}
                  </div>
                  <div className="space-y-1.5 mb-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Active stories</span>
                      <span className={cn("font-bold tracking-wide", storiesCount === 0 ? "text-amber-400" : "text-foreground")}>
                        {storiesCount === 0 ? "None" : storiesCount}
                      </span>
                    </div>
                    {vacantTitles.length > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Vacant titles</span>
                        <span className="font-bold tracking-wide text-amber-400">{vacantTitles.length}</span>
                      </div>
                    )}
                    {looseThreadRivalries.length > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">No canon logged</span>
                        <span className="font-bold tracking-wide text-amber-400">{looseThreadRivalries.length}</span>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate("desk")}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/25 transition-colors text-[10px] font-bold tracking-[0.18em] uppercase text-foreground/60 hover:text-foreground"
                  >
                    Open Creative Desk
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </Panel>
              );
            })()}

            <Panel>
              <SectionLabel icon={Trophy} label="Championship Picture" />
              <ContenderBoard />
            </Panel>

            {(seasonRatings.length > 0 || matchResults.length > 0) && (
              <Panel>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel icon={BarChart2} label="Season Tracker" />
                  {seasonAvg !== null && (
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Avg</span>
                      <span className="text-xs font-black text-amber-400">{seasonAvg.toFixed(1)}★</span>
                    </div>
                  )}
                </div>
                {seasonRatings.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest text-center py-3">
                    No rated shows this month — rate a show after Quick Log to see your season trend.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Bar chart */}
                    <div className="flex items-end gap-1.5 h-12 mb-3">
                      {seasonRatings.map((r) => (
                        <div key={r.id} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className="w-full rounded-t transition-all"
                            style={{
                              height: `${(r.overall / 5) * 100}%`,
                              background: r.overall >= 4 ? "#fbbf24" : r.overall >= 3 ? "#60a5fa" : r.overall >= 2 ? "#94a3b8" : "#f87171",
                              opacity: 0.85,
                            }}
                          />
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border rounded px-1.5 py-0.5 text-[8px] font-bold whitespace-nowrap z-10">
                            {r.showName} · {r.overall.toFixed(1)}★
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Row list */}
                    {seasonRatings.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-border/20 last:border-0">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate">{r.showName}</div>
                          <div className="text-[9px] text-muted-foreground/50 uppercase tracking-widest">Week {r.week}</div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-[9px] font-bold uppercase tracking-widest">
                          {r.matchStars > 0 && (
                            <span className="text-amber-400/80">Matches {r.matchStars}★</span>
                          )}
                          {r.crowdStars > 0 && (
                            <span className="text-orange-400/80">Crowd {r.crowdStars}★</span>
                          )}
                          <span className={cn(
                            "font-black text-xs",
                            r.overall >= 4 ? "text-amber-400" :
                            r.overall >= 3 ? "text-blue-400" :
                            r.overall >= 2 ? "text-foreground/60" : "text-rose-400/70"
                          )}>
                            {r.overall.toFixed(1)}★
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            )}

            <Panel>
              <SectionLabel icon={Users} label="Faction Watch" />
              {activeStables.length === 0 ? (
                <EmptyState message="No active stables — factions add depth to the roster." />
              ) : (
                <div className="space-y-2">
                  {activeStables.slice(0, 6).map((s) => {
                    const members = (s.memberIds ?? [])
                      .map((id) => rosterMap.get(id))
                      .filter((w): w is Wrestler => Boolean(w));
                    return (
                      <ClickableCard key={s.id} onClick={() => onNavigate("roster")}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold tracking-wider uppercase text-foreground truncate">{s.name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {members.length > 0
                                ? members.map((w) => w.name).join(", ")
                                : "No members assigned"}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            {s.alignment && (
                              <span className={cn(
                                "text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border",
                                s.alignment === "HEEL"
                                  ? "text-rose-400/50 border-rose-400/15 bg-rose-400/6"
                                  : s.alignment === "FACE"
                                  ? "text-blue-400 border-blue-400/30 bg-blue-400/10"
                                  : "text-muted-foreground border-white/10 bg-white/5"
                              )}>
                                {s.alignment}
                              </span>
                            )}
                            {s.brand && (
                              <span className="text-[9px] tracking-widest uppercase text-muted-foreground/40">{s.brand}</span>
                            )}
                          </div>
                        </div>
                      </ClickableCard>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel>
              <SectionLabel icon={Inbox} label="Talent Noise" />
              {recentMessages.length === 0 ? (
                <EmptyState message="No messages yet — talent reacts when you book storylines, shows, and promos." />
              ) : (
                <div className="space-y-2">
                  {recentMessages.map((msg) => {
                    const isUnread = !readSet.has(msg.id);
                    return (
                      <ClickableCard key={msg.id} onClick={() => onNavigate("inbox")}>
                        <div className="flex items-center gap-3">
                          {msg.imageUrl ? (
                            <img src={msg.imageUrl} alt={msg.from} className="w-8 h-8 rounded-full object-cover object-top shrink-0 opacity-90" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-white/8 border border-white/10 flex items-center justify-center shrink-0">
                              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase">{msg.from.charAt(0)}</span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-bold tracking-wide uppercase truncate", isUnread ? "text-foreground" : "text-muted-foreground")}>
                                {msg.from}
                              </span>
                              {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{msg.subject}</div>
                            <div className="text-[9px] text-muted-foreground/40 mt-0.5 tracking-widest uppercase">{msg.location} · {msg.date}</div>
                          </div>
                          <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                      </ClickableCard>
                    );
                  })}
                  {inboxUnread > 0 && (
                    <button
                      type="button"
                      onClick={() => onNavigate("inbox")}
                      className="w-full text-center text-[10px] font-bold tracking-widest uppercase text-foreground/35 hover:text-foreground/55 transition-colors mt-1 py-1"
                    >
                      {inboxUnread} unread — Open Inbox
                    </button>
                  )}
                </div>
              )}
            </Panel>

          </div>
        </div>
      </div>

      {hottestStreaks.length > 0 && (
        <div className="mx-auto max-w-5xl px-4 pb-6">
          <div className="rounded-xl border border-border bg-card px-5 py-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-3.5 h-3.5 text-[#dc1e1e]" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">Hottest Streaks</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {hottestStreaks.map(({ wrestler, stats }) => (
                <div key={wrestler.id} className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-muted/10 text-xs">
                  <span className="font-bold tracking-wide uppercase text-foreground/80">{wrestler.name}</span>
                  <span className={stats.currentStreak.kind === "W" ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                    {stats.currentStreak.kind === "W" ? "W" : "L"}{stats.currentStreak.length}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <CaptureCanonDialog open={captureOpen} onOpenChange={setCaptureOpen} />
      <MatchLogger open={matchLoggerOpen} onOpenChange={setMatchLoggerOpen} date={universeDate} />
      <QuickLog open={quickLogOpen} onOpenChange={setQuickLogOpen} defaultShow={todayShow} />
      <TapLog open={tapLogOpen} onOpenChange={setTapLogOpen} />
    </div>
  );
}
