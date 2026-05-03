import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useHistory,
  useRivalries,
  useRoster,
  useChapters,
  useChampionLookup,
  useFeuArcMilestones,
  type RivalryEntry,
  type ChapterType,
} from "@/lib/storage";
import {
  ARC_MILESTONES, ACT_META, ACTS, deriveCurrentAct, actProgress,
} from "@/lib/feudArc";
import { cn } from "@/lib/utils";
import { useIssues } from "@/lib/news";
import { IssueView } from "./IssueView";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";
import {
  rivalryDisplayTitle,
  rivalryMatchupPlain,
  lookupWrestlers,
  allWrestlerIds,
  compareDate,
  entryParticipantNames,
  resolveNamesToIds,
  splitIntoSides,
  type Rivalry,
} from "@/lib/rivalry";
import {
  Trash2,
  Plus,
  User,
  ChevronRight,
  BookOpen,
  Zap,
  Archive,
  Search,
  ExternalLink,
  Monitor,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CreateRivalryDialog, FileToRivalryDialog } from "./RivalryDialogs";
import { RivalryDetail } from "./RivalryDetail";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AppTab } from "@/components/AppHeader";

const BRAND_RED = "#dc1e1e";

type PageTab = "FEUDS" | "HISTORY";

type LegacyFilter =
  | "ALL"
  | "STORYLINE"
  | "SHOW"
  | "SURPRISE"
  | "PROMO"
  | "NIGHT NOTE"
  | "MAGAZINE"
  | "RESULTS";

const FILTER_LABELS: { key: LegacyFilter; kind?: string }[] = [
  { key: "ALL" },
  { key: "RESULTS", kind: "results" },
  { key: "STORYLINE", kind: "storyline" },
  { key: "SHOW", kind: "show" },
  { key: "SURPRISE", kind: "surprise" },
  { key: "PROMO", kind: "promo" },
  { key: "NIGHT NOTE", kind: "log" },
  { key: "MAGAZINE", kind: "magazine" },
];

export function Rivalries({ onNavigate }: { onNavigate?: (tab: AppTab) => void } = {}) {
  const [rivalries, setRivalries] = useRivalries();
  const [history, setHistory] = useHistory();
  const [roster] = useRoster();
  const [chapters] = useChapters();

  const [pageTab, setPageTab] = useState<PageTab>("FEUDS");
  const [createOpen, setCreateOpen] = useState(false);
  const [openRivalryId, setOpenRivalryId] = useState<string | null>(null);

  useEffect(() => {
    if (rivalries.length > 0) setPageTab("FEUDS");
    else if (history.length > 0) setPageTab("HISTORY");
  }, []);

  const sorted = useMemo(() => {
    const sortByDate = (a: Rivalry, b: Rivalry) =>
      compareDate(b.lastActivityDate, a.lastActivityDate);
    return {
      active: rivalries.filter((r) => r.status === "ACTIVE").sort(sortByDate),
      past: rivalries.filter((r) => r.status === "CONCLUDED").sort(sortByDate),
    };
  }, [rivalries]);

  const hasRivalries = sorted.active.length > 0 || sorted.past.length > 0;

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col pb-16">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-4xl font-display font-bold uppercase tracking-widest text-foreground"
            style={{ letterSpacing: "0.12em" }}
          >
            Rivalries
          </h1>
          <p className="text-muted-foreground text-sm mt-1 uppercase tracking-widest">
            {rivalries.length} feud{rivalries.length !== 1 ? "s" : ""} in your universe
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-foreground text-background hover:bg-foreground/90 text-xs uppercase tracking-widest px-5"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          New Rivalry
        </Button>
      </div>

      {/* Tab Row */}
      <div className="flex gap-1 mb-6 bg-muted/30 rounded-lg p-1 w-fit">
        {(["FEUDS", "HISTORY"] as PageTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setPageTab(t)}
            className={`px-5 py-1.5 rounded text-[11px] font-bold tracking-widest uppercase transition-colors ${
              pageTab === t
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "FEUDS" ? `Feuds${hasRivalries ? ` (${rivalries.length})` : ""}` : `History${history.length > 0 ? ` (${history.length})` : ""}`}
          </button>
        ))}
      </div>

      {/* FEUDS TAB */}
      {pageTab === "FEUDS" && (
        <div className="space-y-10 flex-1">
          {!hasRivalries ? (
            <FeudsEmptyState
              hasHistory={history.length > 0}
              onCreate={() => setCreateOpen(true)}
              onGoHistory={() => setPageTab("HISTORY")}
            />
          ) : (
            <>
              {sorted.active.length > 0 && (
                <section>
                  <SectionLabel
                    icon={<Zap className="w-3.5 h-3.5" style={{ color: BRAND_RED }} />}
                    label="Active Feuds"
                    count={sorted.active.length}
                    accent
                  />
                  <div className="space-y-3 mt-4">
                    {sorted.active.map((r, i) => (
                      <RivalryCard
                        key={r.id}
                        rivalry={r}
                        roster={roster}
                        chapters={chapters.filter((c) => c.rivalryId === r.id)}
                        entries={history.filter((h) => r.historyEntryIds.includes(h.id))}
                        index={i}
                        active
                        onOpen={() => setOpenRivalryId(r.id)}
                      />
                    ))}
                  </div>
                </section>
              )}

              {sorted.past.length > 0 && (
                <section>
                  <SectionLabel
                    icon={<Archive className="w-3.5 h-3.5 text-muted-foreground" />}
                    label="Concluded"
                    count={sorted.past.length}
                  />
                  <div className="space-y-2 mt-4">
                    {sorted.past.map((r, i) => (
                      <RivalryCard
                        key={r.id}
                        rivalry={r}
                        roster={roster}
                        chapters={chapters.filter((c) => c.rivalryId === r.id)}
                        entries={history.filter((h) => r.historyEntryIds.includes(h.id))}
                        index={i}
                        active={false}
                        onOpen={() => setOpenRivalryId(r.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {pageTab === "HISTORY" && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="mb-4">
            <h2 className="text-xl font-display font-bold uppercase tracking-widest text-foreground">
              Creative History
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Everything saved from Creative Desk. File rows to feuds so stories stay organized.
            </p>
          </div>
          {history.length === 0 ? (
            <HistoryEmptyState onNavigate={onNavigate} />
          ) : (
            <FeedView
              history={history}
              setHistory={setHistory}
              rivalries={rivalries}
              setRivalries={setRivalries}
              onNavigate={onNavigate}
            />
          )}
        </div>
      )}

      <CreateRivalryDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(r) => setOpenRivalryId(r.id)}
      />
      <RivalryDetail
        rivalryId={openRivalryId}
        onClose={() => setOpenRivalryId(null)}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Section Label
───────────────────────────────────────────── */
function SectionLabel({
  icon,
  label,
  count,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span
        className={`text-[11px] font-bold uppercase tracking-widest ${
          accent ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      <div
        className="flex-1 h-px ml-2"
        style={{
          background: accent
            ? `linear-gradient(to right, ${BRAND_RED}60, transparent)`
            : "var(--border)",
        }}
      />
      <span className="text-[10px] font-bold text-muted-foreground/60 tabular-nums">
        {count}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Rivalry Card
───────────────────────────────────────────── */
function RivalryCard({
  rivalry,
  roster,
  chapters,
  entries,
  index,
  active,
  onOpen,
}: {
  rivalry: Rivalry;
  roster: ReturnType<typeof useRoster>[0];
  chapters: import("@/lib/rivalry").Chapter[];
  entries: RivalryEntry[];
  index: number;
  active: boolean;
  onOpen: () => void;
}) {
  const wrestlers = useMemo(
    () => lookupWrestlers(allWrestlerIds(rivalry), roster),
    [rivalry, roster],
  );
  const title = rivalryDisplayTitle(rivalry, roster);
  const matchup = rivalryMatchupPlain(rivalry, roster);
  const usingTitle = Boolean(rivalry.title?.trim());

  const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
  const latestChapter = sortedChapters[sortedChapters.length - 1];

  const display = wrestlers.slice(0, 5);
  const overflow = wrestlers.length - display.length;

  const showNoCanonHint = active && entries.length === 0;

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileHover={{ x: 2 }}
      onClick={onOpen}
      className={`
        w-full text-left relative overflow-hidden
        bg-card border rounded-xl
        transition-all duration-200 group
        ${
          active
            ? "border-border hover:border-foreground/30 shadow-sm"
            : "border-border/50 hover:border-border opacity-70 hover:opacity-90"
        }
      `}
    >
      {/* Left accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{
          background: active
            ? BRAND_RED
            : "hsl(var(--muted-foreground) / 0.3)",
        }}
      />

      <div className="pl-5 pr-4 py-4 flex items-center gap-4">
        {/* Portraits */}
        <div className="flex -space-x-3 shrink-0">
          {display.map((w) => (
            <Portrait key={w.id} imageUrl={w.imageUrl} name={w.name} wrestlerId={w.id} />
          ))}
          {overflow > 0 && (
            <div className="w-12 h-12 rounded-full border-2 border-card bg-muted/60 text-foreground/80 text-[10px] font-bold flex items-center justify-center shrink-0">
              +{overflow}
            </div>
          )}
          {display.length === 0 && (
            <div className="w-12 h-12 rounded-full border-2 border-card bg-muted/60 flex items-center justify-center shrink-0">
              <User className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div
            className="font-display font-bold uppercase tracking-widest text-foreground text-xl leading-tight truncate"
            style={{ letterSpacing: "0.08em" }}
          >
            {title}
          </div>

          {usingTitle && (
            <div
              className="text-[11px] font-bold uppercase tracking-widest mt-0.5 truncate"
              style={{
                color: active ? BRAND_RED : "hsl(var(--muted-foreground))",
              }}
            >
              {matchup}
            </div>
          )}

          {/* Canon entry count subtitle */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
              Canon: {entries.length} {entries.length === 1 ? "entry" : "entries"} filed
            </span>
          </div>

          {/* No canon hint */}
          {showNoCanonHint && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <AlertTriangle className="w-3 h-3 text-amber-500/70 shrink-0" />
              <span className="text-[10px] text-amber-500/80 font-medium">
                No canon filed yet — use History or Creative Desk to link beats.
              </span>
            </div>
          )}

          {/* Chapter breadcrumb */}
          {latestChapter && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60 border border-border/60 rounded px-1.5 py-0.5">
                Ch. {sortedChapters.length}
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {latestChapter.title}
              </span>
            </div>
          )}

          {/* Arc stage badge */}
          <ArcCardBadge rivalryId={rivalry.id} entries={entries} />
        </div>

        {/* Right meta */}
        <div className="flex items-center gap-4 shrink-0">
          {sortedChapters.length > 0 && (
            <div className="text-right hidden sm:block">
              <div className="text-lg font-display font-bold text-foreground tabular-nums">
                {sortedChapters.length}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-muted-foreground/60 font-bold">
                {sortedChapters.length === 1 ? "chapter" : "chapters"}
              </div>
            </div>
          )}
          <div
            className={`
              w-8 h-8 rounded-full flex items-center justify-center
              transition-all duration-200
              ${
                active
                  ? "bg-foreground/5 group-hover:bg-foreground group-hover:text-background text-foreground/40"
                  : "bg-muted/30 text-muted-foreground/40"
              }
            `}
          >
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────
   Portrait circle
───────────────────────────────────────────── */
function Portrait({
  imageUrl,
  name,
  wrestlerId,
}: {
  imageUrl?: string;
  name: string;
  wrestlerId?: string;
}) {
  const champLookup = useChampionLookup();
  const championships = wrestlerId ? (champLookup.get(wrestlerId) ?? []) : [];
  return (
    <div className="relative shrink-0" title={name}>
      <div className="w-12 h-12 rounded-full border-2 border-card overflow-hidden bg-muted/40">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover object-top"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <User className="w-5 h-5 text-muted-foreground/50" />
          </div>
        )}
      </div>
      <ChampionBeltOverlay championships={championships} size="sm" />
    </div>
  );
}

/* ─────────────────────────────────────────────
   Empty States
───────────────────────────────────────────── */
function FeudsEmptyState({
  hasHistory,
  onCreate,
  onGoHistory,
}: {
  hasHistory: boolean;
  onCreate: () => void;
  onGoHistory: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-16 h-16 rounded-full border-2 flex items-center justify-center mb-6"
        style={{ borderColor: `${BRAND_RED}40` }}
      >
        <Zap className="w-7 h-7" style={{ color: BRAND_RED }} />
      </div>
      <h3 className="text-2xl font-display font-bold uppercase tracking-widest text-foreground mb-2">
        No Feuds Running
      </h3>
      <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
        Start a feud manually, or save a canon moment in Creative Desk and file
        it here so future AI ideas remember the story.
      </p>
      <div className="flex flex-col gap-3 items-center">
        <Button
          onClick={onCreate}
          className="bg-foreground text-background hover:bg-foreground/90 text-xs uppercase tracking-widest px-6"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create a Feud
        </Button>
        {hasHistory && (
          <button
            onClick={onGoHistory}
            className="text-xs text-muted-foreground hover:text-foreground uppercase tracking-widest transition-colors"
          >
            Go to History to file Creative Desk saves
          </button>
        )}
      </div>
    </motion.div>
  );
}

function HistoryEmptyState({
  onNavigate,
}: {
  onNavigate?: (tab: AppTab) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex-1 flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center mb-6"
      >
        <BookOpen className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-2xl font-display font-bold uppercase tracking-widest text-foreground mb-2">
        No History Yet
      </h3>
      <p className="text-muted-foreground max-w-sm mb-8 text-sm leading-relaxed">
        Storylines, shows, surprises, promos, and night notes all save here
        automatically. Use Creative Desk to generate your first piece of
        content.
      </p>
      {onNavigate && (
        <Button
          onClick={() => onNavigate("desk")}
          className="bg-foreground text-background hover:bg-foreground/90 text-xs uppercase tracking-widest px-6"
        >
          Open Creative Desk
        </Button>
      )}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────
   Feed View
───────────────────────────────────────────── */
function FeedView({
  history,
  setHistory,
  rivalries,
  setRivalries,
  onNavigate,
}: {
  history: RivalryEntry[];
  setHistory: (h: RivalryEntry[] | ((prev: RivalryEntry[]) => RivalryEntry[])) => void;
  rivalries: Rivalry[];
  setRivalries: (r: Rivalry[] | ((prev: Rivalry[]) => Rivalry[])) => void;
  onNavigate?: (tab: AppTab) => void;
}) {
  const [filter, setFilter] = useState<LegacyFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [issues] = useIssues();
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null);
  const [viewEntry, setViewEntry] = useState<RivalryEntry | null>(null);
  const [fileEntry, setFileEntry] = useState<RivalryEntry | null>(null);

  const activeIssue = activeIssueId
    ? (issues.find((i) => i.id === activeIssueId) ?? null)
    : null;

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of FILTER_LABELS) {
      if (!f.kind) { c["ALL"] = history.length; continue; }
      c[f.key] = history.filter((h) => h.kind === f.kind).length;
    }
    return c;
  }, [history]);

  const filtered = useMemo(() => {
    let result = history.filter((h) => {
      if (filter !== "ALL") {
        const match = FILTER_LABELS.find((f) => f.key === filter);
        if (match?.kind && h.kind !== match.kind) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const haystack = [
          h.kind === "storyline"
            ? `${h.data.feud} ${h.data.participants.join(" ")}`
            : "",
          h.kind === "show" ? h.data.showName : "",
          h.kind === "surprise" ? h.data.headline : "",
          h.kind === "promo" ? `${h.data.headline} ${h.data.wrestlerName}` : "",
          h.kind === "log" ? h.text : "",
          h.kind === "magazine" ? h.data.coverHeadline : "",
          h.kind === "results"
            ? `${h.data.showName ?? ""} ${h.data.matches.map((m) => m.sides.map((s) => s.label).join(" ")).join(" ")}`
            : "",
          rivalries
            .filter((r) => r.historyEntryIds.includes(h.id))
            .map((r) => r.title ?? "")
            .join(" "),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      const diff = b.createdAt - a.createdAt;
      return sort === "newest" ? diff : -diff;
    });

    return result;
  }, [history, filter, search, sort, rivalries]);

  function linkedTitlesFor(entryId: string): string[] {
    return rivalries
      .filter((r) => r.historyEntryIds.includes(entryId))
      .map((r) => r.title?.trim() || "Unnamed Feud");
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this entry?")) return;
    setHistory((prev) => prev.filter((h) => h.id !== id));
    setRivalries((prev) =>
      prev.map((r) => ({
        ...r,
        historyEntryIds: r.historyEntryIds.filter((hid) => hid !== id),
      })),
    );
    toast.success("Entry deleted");
  };

  const handleView = (entry: RivalryEntry) => {
    if (entry.kind === "magazine") {
      setActiveIssueId((entry as any).data.issueId);
    } else {
      setViewEntry(entry);
    }
  };

  const handleCreativeDesk = (entryId: string) => {
    sessionStorage.setItem("creativeDesk.focusEntryId", entryId);
    onNavigate?.("desk");
  };

  return (
    <>
      {/* Search + Sort row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, participant, feud name..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/40 transition-colors"
          />
        </div>
        <div className="relative shrink-0">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
            className="appearance-none bg-card border border-border text-muted-foreground text-[11px] font-bold uppercase tracking-widest rounded px-3 py-2 pr-7 focus:outline-none focus:border-foreground/40 cursor-pointer hover:text-foreground transition-colors"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Filter chips with counts */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {FILTER_LABELS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold tracking-widest uppercase whitespace-nowrap transition-colors border ${
              filter === f.key
                ? "bg-foreground text-background border-foreground"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
            }`}
          >
            {f.key}
            <span
              className={`text-[9px] font-bold tabular-nums ${
                filter === f.key ? "text-background/60" : "text-muted-foreground/50"
              }`}
            >
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic text-center py-8">
          {search ? "No entries match your search." : "No entries of this type."}
        </p>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((entry) => (
              <FeedCard
                key={entry.id}
                entry={entry}
                linkedTitles={linkedTitlesFor(entry.id)}
                onView={() => handleView(entry)}
                onFileToFeud={
                  entry.kind === "magazine" || entry.kind === "results"
                    ? undefined
                    : () => setFileEntry(entry)
                }
                onCreativeDesk={() => handleCreativeDesk(entry.id)}
                onDelete={(e) => handleDelete(entry.id, e)}
                onOpenMagazine={
                  entry.kind === "magazine"
                    ? () => setActiveIssueId((entry as any).data.issueId)
                    : undefined
                }
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <IssueView
        issue={activeIssue}
        open={!!activeIssue}
        onOpenChange={(o) => {
          if (!o) setActiveIssueId(null);
        }}
        onMarkRead={() => {}}
      />

      {/* Entry view dialog */}
      <EntryDetailDialog
        entry={viewEntry}
        onClose={() => setViewEntry(null)}
        onFileToFeud={
          viewEntry && viewEntry.kind !== "magazine" && viewEntry.kind !== "results"
            ? () => {
                setFileEntry(viewEntry);
                setViewEntry(null);
              }
            : undefined
        }
      />

      {/* File to feud dialog */}
      {fileEntry && (
        <FileToRivalryDialog
          open={!!fileEntry}
          onOpenChange={(o) => {
            if (!o) setFileEntry(null);
          }}
          entry={fileEntry}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────
   Feed Card
───────────────────────────────────────────── */
function FeedCard({
  entry,
  linkedTitles,
  onView,
  onFileToFeud,
  onCreativeDesk,
  onDelete,
  onOpenMagazine,
}: {
  entry: RivalryEntry;
  linkedTitles: string[];
  onView: () => void;
  onFileToFeud?: () => void;
  onCreativeDesk: () => void;
  onDelete: (e: React.MouseEvent) => void;
  onOpenMagazine?: () => void;
}) {
  const timeStr = formatDistanceToNow(entry.createdAt, { addSuffix: true });
  const isMagazine = entry.kind === "magazine";
  const isResults = entry.kind === "results";

  let title = "";
  let sub = "";
  let typeLabel = "";

  if (entry.kind === "log") {
    typeLabel = "NIGHT NOTE";
    title = (entry.text ?? "").slice(0, 80) + ((entry.text?.length ?? 0) > 80 ? "..." : "");
    sub = "";
  } else if (entry.kind === "storyline") {
    title = entry.data.feud;
    sub = entry.data.participants.join(" vs ");
    typeLabel = "STORYLINE";
  } else if (entry.kind === "show") {
    title = entry.data.showName;
    sub = `${entry.data.matches.length} Matches`;
    typeLabel = "SHOW";
  } else if (entry.kind === "surprise") {
    title = entry.data.headline;
    sub = entry.data.stamp;
    typeLabel = "SURPRISE";
  } else if (entry.kind === "promo") {
    title = entry.data.headline;
    sub = `${entry.data.wrestlerName} · ${entry.data.tone}`;
    typeLabel = "PROMO";
  } else if (entry.kind === "magazine") {
    title = entry.data.coverHeadline;
    sub = `Issue #${entry.data.issueNumber} cover`;
    typeLabel = "MAGAZINE";
  } else if (entry.kind === "results") {
    title = entry.data.showName ?? "Show Results";
    sub = `${entry.data.matches.length} match${entry.data.matches.length !== 1 ? "es" : ""} logged`;
    typeLabel = "RESULTS";
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:border-foreground/20 transition-colors group"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[9px] px-2 py-0.5 rounded font-bold tracking-widest uppercase border border-foreground/20 text-foreground/50 bg-muted/30 shrink-0">
                {typeLabel}
              </span>
              <span className="text-xs text-muted-foreground shrink-0">{timeStr}</span>
            </div>
            <h3 className="font-display text-base uppercase tracking-widest text-foreground font-bold truncate">
              {title}
            </h3>
            {sub && (
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5 truncate">
                {sub}
              </p>
            )}
          </div>
          <button
            onClick={onDelete}
            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-muted/50 rounded opacity-0 group-hover:opacity-100 transition-all shrink-0 mt-0.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filing strip */}
        <div className="mb-3">
          {linkedTitles.length > 0 ? (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
                Filed to:
              </span>
              {linkedTitles.map((t, i) => (
                <span
                  key={i}
                  className="text-[10px] font-bold px-2 py-0.5 rounded border border-foreground/20 text-foreground/70 bg-muted/20 uppercase tracking-wide max-w-[160px] truncate"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground/50 italic">
                Not filed to any feud
              </span>
              {!isMagazine && onFileToFeud && (
                <button
                  type="button"
                  onClick={onFileToFeud}
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-foreground/20 text-foreground/60 hover:text-foreground hover:border-foreground/50 transition-colors"
                >
                  File to feud
                </button>
              )}
              {isMagazine && (
                <span className="text-[10px] text-muted-foreground/40 italic">
                  Magazine issues live in News. File feuds from story beats instead.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quick actions row */}
        <div className="flex items-center gap-1 pt-2 border-t border-border/50">
          <ActionBtn
            label="View"
            icon={<Monitor className="w-3 h-3" />}
            onClick={onView}
          />
          {!isMagazine && !isResults && (
            <ActionBtn
              label="Creative Desk"
              icon={<ExternalLink className="w-3 h-3" />}
              onClick={onCreativeDesk}
            />
          )}
          {!isMagazine && !isResults && onFileToFeud && (
            <ActionBtn
              label="File to feud"
              icon={<BookOpen className="w-3 h-3" />}
              onClick={onFileToFeud}
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ActionBtn({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
    >
      {icon}
      {label}
    </button>
  );
}

/* ─────────────────────────────────────────────
   Entry Detail Dialog (View)
───────────────────────────────────────────── */
function EntryDetailDialog({
  entry,
  onClose,
  onFileToFeud,
}: {
  entry: RivalryEntry | null;
  onClose: () => void;
  onFileToFeud?: () => void;
}) {
  if (!entry) return null;

  let dialogTitle = "";
  if (entry.kind === "log") dialogTitle = "Night Note";
  else if (entry.kind === "storyline") dialogTitle = entry.data.feud || "Storyline";
  else if (entry.kind === "show") dialogTitle = entry.data.showName || "Show";
  else if (entry.kind === "surprise") dialogTitle = entry.data.headline || "Surprise";
  else if (entry.kind === "promo") dialogTitle = entry.data.headline || "Promo";
  else if (entry.kind === "magazine") dialogTitle = entry.data.coverHeadline || "Magazine";
  else if (entry.kind === "results") dialogTitle = entry.data.showName || "Show Results";

  return (
    <Dialog open={!!entry} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[680px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] px-2 py-0.5 rounded font-bold tracking-widest uppercase border border-foreground/20 text-foreground/50 bg-muted/30">
              {entry.kind === "log" ? "NIGHT NOTE" : entry.kind.toUpperCase()}
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

          {entry.kind === "results" && (
            <div className="space-y-3">
              {entry.data.matches.map((m, i) => {
                const winnerSide = m.winnerSideId
                  ? m.sides.find((s) => s.id === m.winnerSideId)
                  : null;
                const isDraw = m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
                return (
                  <div key={m.id ?? i} className="bg-card p-3 rounded border border-border">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] font-bold text-foreground/60 uppercase tracking-widest">
                        {m.slot ?? `Match ${i + 1}`}
                        {m.stipulation ? ` · ${m.stipulation}` : ""}
                      </span>
                      {m.stars && m.stars > 0 ? (
                        <span className="text-[9px] font-bold text-amber-400/80 tracking-widest uppercase">
                          {"★".repeat(m.stars)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm font-bold text-foreground uppercase tracking-wide mb-1.5">
                      {m.sides.map((s) => s.label).join(" vs ")}
                    </p>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {!isDraw && winnerSide && (
                        <p>
                          <strong className="text-emerald-400/80">WINNER:</strong>{" "}
                          {winnerSide.label}
                          {m.finish ? ` · ${m.finish}` : ""}
                        </p>
                      )}
                      {isDraw && (
                        <p className="text-muted-foreground/70 italic">
                          {m.outcome === "DRAW" ? "Draw" : "No Contest"}
                        </p>
                      )}
                      {m.notes && (
                        <p className="italic text-muted-foreground/60">{m.notes}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {onFileToFeud && entry.kind !== "results" && (
          <div className="pt-4 border-t border-border mt-4">
            <button
              type="button"
              onClick={onFileToFeud}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground border border-border hover:border-foreground/40 px-4 py-2 rounded transition-colors"
            >
              <BookOpen className="w-3.5 h-3.5" />
              File to feud
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Arc Card Badge ─────────────────────────────────────────────────────────

function ArcCardBadge({
  rivalryId,
  entries,
}: {
  rivalryId: string;
  entries: RivalryEntry[];
}) {
  const [allMilestones] = useFeuArcMilestones();

  const checkedSet = useMemo(() => {
    const ids = allMilestones[rivalryId] ?? [];
    return new Set<string>(ids);
  }, [allMilestones, rivalryId]);

  const chapterTypesSeen = useMemo(() => {
    const s = new Set<ChapterType>();
    for (const e of entries) if (e.chapter) s.add(e.chapter as ChapterType);
    return s;
  }, [entries]);

  const currentAct = deriveCurrentAct(chapterTypesSeen);
  const meta = ACT_META[currentAct];
  const done = ARC_MILESTONES.filter((m) => m.act === currentAct && checkedSet.has(m.id)).length;
  const total = ARC_MILESTONES.filter((m) => m.act === currentAct).length;

  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: meta.color }}
      />
      <span
        className="text-[9px] font-bold uppercase tracking-widest"
        style={{ color: meta.color }}
      >
        {meta.shortLabel}
      </span>
      <span className="text-[9px] text-muted-foreground/50 tabular-nums">
        · {done}/{total}
      </span>
    </div>
  );
}
