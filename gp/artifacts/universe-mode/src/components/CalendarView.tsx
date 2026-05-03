import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Star, Tv } from "lucide-react";
import { toast } from "sonner";
import { useUniverseDate, useEvents, useShows } from "@/lib/storage";
import {
  MONTH_LABELS,
  nightToDay,
  type PremiumEvent,
} from "@/lib/calendar";
import { EventsDialog } from "./EventsDialog";
import { cn } from "@/lib/utils";

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

interface ContextMenu {
  x: number;
  y: number;
  week: number;
  day: number;
  existingEvent: PremiumEvent | null;
}

export function CalendarView() {
  const [date] = useUniverseDate();
  const [events, setEvents] = useEvents();
  const [shows] = useShows();

  const [viewMonth, setViewMonth] = useState(date.month);
  const [viewYear, setViewYear] = useState(date.year);
  const followingDate = useRef(true);

  useEffect(() => {
    if (followingDate.current) {
      setViewMonth(date.month);
      setViewYear(date.year);
    }
  }, [date.month, date.year]);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [eventsDialogOpen, setEventsDialogOpen] = useState(false);
  const [externalEditing, setExternalEditing] = useState<PremiumEvent | null | undefined>(
    undefined,
  );
  const [prefillDate, setPrefillDate] = useState<
    { month: number; week: number; day: number } | undefined
  >();

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [contextMenu]);

  const showsByDay: Record<number, (typeof shows)[0] | undefined> = {};
  for (const show of shows) {
    const d = nightToDay(show.night);
    if (d !== null && !showsByDay[d]) showsByDay[d] = show;
  }

  const eventsByKey: Record<string, PremiumEvent> = {};
  for (const ev of events) {
    if (ev.month === viewMonth) {
      eventsByKey[`${ev.week}-${ev.day}`] = ev;
    }
  }

  const canGoPrev = !(viewYear === 0 && viewMonth === 1);
  const canGoNext =
    viewYear < date.year || (viewYear === date.year && viewMonth < date.month);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    followingDate.current = false;
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    followingDate.current = false;
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const isViewingCurrentMonth = viewMonth === date.month && viewYear === date.year;

  const handleGoToToday = () => {
    followingDate.current = true;
    setViewMonth(date.month);
    setViewYear(date.year);
  };

  const handleCellRightClick = (e: React.MouseEvent, week: number, day: number) => {
    e.preventDefault();
    e.stopPropagation();
    const existing = eventsByKey[`${week}-${day}`] ?? null;
    setContextMenu({ x: e.clientX, y: e.clientY, week, day, existingEvent: existing });
  };

  const openAddEvent = () => {
    if (!contextMenu) return;
    setPrefillDate({ month: viewMonth, week: contextMenu.week, day: contextMenu.day });
    setExternalEditing(undefined);
    setEventsDialogOpen(true);
    setContextMenu(null);
  };

  const openEditEvent = () => {
    if (!contextMenu?.existingEvent) return;
    setExternalEditing(contextMenu.existingEvent);
    setPrefillDate(undefined);
    setEventsDialogOpen(true);
    setContextMenu(null);
  };

  const handleRemoveEvent = () => {
    if (!contextMenu?.existingEvent) return;
    setEvents((prev) => prev.filter((e) => e.id !== contextMenu.existingEvent!.id));
    toast.success("Event removed");
    setContextMenu(null);
  };

  const handleCloseDialog = (open: boolean) => {
    setEventsDialogOpen(open);
    if (!open) {
      setExternalEditing(undefined);
      setPrefillDate(undefined);
    }
  };

  const seasonLabel = `Season ${viewYear + 1}`;
  const monthLabel = MONTH_LABELS[viewMonth - 1];

  return (
    <div className="w-full" onClick={() => setContextMenu(null)}>
      {/* ── Month header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">
            {seasonLabel}
          </div>
          <h2 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground leading-none">
            {monthLabel}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {!isViewingCurrentMonth && (
            <button
              type="button"
              onClick={handleGoToToday}
              className="px-2.5 py-1.5 text-[10px] font-bold tracking-widest uppercase rounded-md border border-emerald-400/50 text-emerald-400 hover:bg-emerald-400/10 transition-colors"
            >
              Today
            </button>
          )}
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            aria-label="Previous month"
            className={cn(
              "p-2 rounded-md border border-border transition-colors",
              canGoPrev
                ? "hover:bg-foreground hover:text-background hover:border-foreground"
                : "opacity-30 cursor-not-allowed",
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
            className={cn(
              "p-2 rounded-md border border-border transition-colors",
              canGoNext
                ? "hover:bg-foreground hover:text-background hover:border-foreground"
                : "opacity-30 cursor-not-allowed",
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Day-of-week headers ── */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEK_DAY_ORDER.map((dayIdx) => (
          <div
            key={dayIdx}
            className="text-center text-[10px] font-bold tracking-widest uppercase text-muted-foreground py-1"
          >
            {DAY_SHORT[dayIdx]}
          </div>
        ))}
      </div>

      {/* ── 4-week grid ── */}
      <div className="grid grid-rows-4 gap-2">
        {([1, 2, 3, 4] as const).map((week) => (
          <div key={week} className="grid grid-cols-7 gap-2">
            {WEEK_DAY_ORDER.map((dayIdx) => {
              const show = showsByDay[dayIdx];
              const pleEvent = eventsByKey[`${week}-${dayIdx}`];
              const isToday =
                viewMonth === date.month &&
                viewYear === date.year &&
                week === date.week &&
                dayIdx === date.day;

              return (
                <button
                  key={dayIdx}
                  type="button"
                  onContextMenu={(e) => handleCellRightClick(e, week, dayIdx)}
                  className={cn(
                    "relative rounded-lg overflow-hidden border-2 text-left transition-all group",
                    "aspect-[4/3]",
                    isToday
                      ? "border-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.15)]"
                      : pleEvent && !show
                        ? "border-amber-500/40 hover:border-amber-400/70"
                        : "border-border hover:border-foreground/40",
                  )}
                  title={[
                    `${DAY_SHORT[dayIdx]} · Week ${week}`,
                    show?.name,
                    pleEvent?.name,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                >
                  {/* Backdrop */}
                  {show?.imageUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.03]"
                      style={{ backgroundImage: `url(${show.imageUrl})` }}
                    />
                  ) : pleEvent?.imageUrl ? (
                    <div
                      className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-[1.03]"
                      style={{ backgroundImage: `url(${pleEvent.imageUrl})` }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-muted/20" />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/5 to-black/75" />

                  {/* PLE star badge */}
                  {pleEvent && (
                    <div className="absolute top-1 right-1 z-20 flex items-center gap-0.5 px-1 py-0.5 rounded bg-amber-500/90 text-black">
                      <Star className="w-2.5 h-2.5 fill-current shrink-0" />
                      <span className="text-[8px] font-bold tracking-wider uppercase truncate max-w-[52px]">
                        PLE
                      </span>
                    </div>
                  )}

                  {/* TODAY badge */}
                  {isToday && (
                    <div className="absolute top-1 left-1 z-20">
                      <span className="text-[8px] font-bold tracking-wider uppercase px-1 py-0.5 rounded bg-emerald-400 text-black">
                        NOW
                      </span>
                    </div>
                  )}

                  {/* Bottom label */}
                  <div className="relative z-10 p-1.5 flex flex-col h-full">
                    <div className="mt-auto min-w-0">
                      {show ? (
                        <div className="font-display font-bold uppercase tracking-wider text-[11px] leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          {show.name}
                        </div>
                      ) : pleEvent ? (
                        <div className="font-display font-bold uppercase tracking-wider text-[10px] leading-tight text-amber-200 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] truncate">
                          {pleEvent.name}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground/50">
                          <Tv className="w-2.5 h-2.5" />
                          Dark
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Right-click context menu ── */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[176px] bg-card border border-border rounded-md shadow-xl py-1"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 140),
            left: Math.min(contextMenu.x, window.innerWidth - 200),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground border-b border-border mb-1">
            {DAY_SHORT[contextMenu.day]} · Week {contextMenu.week}
          </div>

          {contextMenu.existingEvent ? (
            <>
              <div className="px-3 py-1 text-xs text-foreground/60 italic truncate">
                {contextMenu.existingEvent.name}
              </div>
              <button
                type="button"
                onClick={openEditEvent}
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-foreground"
              >
                Edit Event
              </button>
              <button
                type="button"
                onClick={handleRemoveEvent}
                className="w-full text-left px-3 py-2 text-sm hover:bg-destructive/10 hover:text-destructive transition-colors text-foreground"
              >
                Remove Event
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={openAddEvent}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors text-foreground"
            >
              Add Premium Event
            </button>
          )}
        </div>
      )}

      {/* ── Events dialog (shared with Creative Desk) ── */}
      <EventsDialog
        open={eventsDialogOpen}
        onOpenChange={handleCloseDialog}
        events={events}
        setEvents={setEvents}
        currentDate={date}
        externalEditing={externalEditing}
        prefillDate={prefillDate}
      />
    </div>
  );
}
