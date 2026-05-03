import { useMemo, useState, useRef, useCallback } from "react";
import { useGenerateIssue, useGenerateRumor } from "@workspace/api-client-react";
import type { Wrestler } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Loader2, Newspaper, Megaphone, ChevronRight, ImagePlus } from "lucide-react";
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
  useUniverseBible,
  useSeasonChronicles,
  buildBookerContext,
} from "@/lib/storage";
import { useTokenLog, recordTokenUsage } from "@/lib/tokens";
import { useIssues, useRumors, resolveWrestlerIdByName } from "@/lib/news";
import type { Issue, Rumor, IssueFeature } from "@/lib/news";
import { CHAIRMEN } from "@/lib/chairmen";
import { formatDate } from "@/lib/calendar";
import { MagazineCover } from "./MagazineCover";
import { IssueView } from "./IssueView";
import { RumorView } from "./RumorView";
import { cn } from "@/lib/utils";
import { describeApiError } from "@/lib/api-errors";

function findWrestlerById(roster: Wrestler[], id: string | undefined): Wrestler | undefined {
  if (!id) return undefined;
  return roster.find((w) => w.id === id);
}

function findWrestlerInText(text: string, roster: Wrestler[]): Wrestler | undefined {
  const lower = text.toLowerCase();
  return roster.find((w) => w.imageUrl && lower.includes(w.name.toLowerCase()));
}

const NEWS_PHOTO_OVERRIDES_KEY = "umc.newsPhotoOverrides";

function useNewsPhotoOverrides(): [Record<string, string>, (id: string, dataUrl: string) => void] {
  const [overrides, setOverrides] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(NEWS_PHOTO_OVERRIDES_KEY) || "{}");
    } catch {
      return {};
    }
  });
  const setOverride = useCallback((id: string, dataUrl: string) => {
    setOverrides((prev) => {
      const next = { ...prev, [id]: dataUrl };
      try { localStorage.setItem(NEWS_PHOTO_OVERRIDES_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);
  return [overrides, setOverride];
}

function PhotoEditButton({
  wrestlerId,
  onUpload,
}: {
  wrestlerId: string;
  onUpload: (id: string, dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="photo-edit-overlay">
      <button
        type="button"
        className="photo-edit-btn"
        title="Change photo"
        onClick={(e) => {
          e.stopPropagation();
          inputRef.current?.click();
        }}
      >
        <ImagePlus className="h-3 w-3" />
        <span>Change photo</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === "string") {
              onUpload(wrestlerId, reader.result);
            }
          };
          reader.readAsDataURL(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function News() {
  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [universeBible] = useUniverseBible();
  const [seasonChronicles] = useSeasonChronicles();

  const [issues, setIssues] = useIssues();
  const [rumors, setRumors] = useRumors();

  const [activeIssue, setActiveIssue] = useState<Issue | null>(null);
  const [activeRumor, setActiveRumor] = useState<Rumor | null>(null);
  const [photoOverrides, setPhotoOverride] = useNewsPhotoOverrides();

  const issueMutation = useGenerateIssue();
  const rumorMutation = useGenerateRumor();
  const [tokenLog, setTokenLog] = useTokenLog();

  const currentChairman = chairman || CHAIRMEN[0];
  const [newsSearch, setNewsSearch] = useState("");

  const sortedIssues = useMemo(
    () => [...issues].sort((a, b) => b.issueNumber - a.issueNumber),
    [issues],
  );
  const sortedRumors = useMemo(
    () => [...rumors].sort((a, b) => b.createdAt - a.createdAt),
    [rumors],
  );

  const searchLower = newsSearch.trim().toLowerCase();
  const displayedIssues = useMemo(() => {
    if (!searchLower) return sortedIssues;
    return sortedIssues.filter(i =>
      i.cover.primaryHeadline?.toLowerCase().includes(searchLower) ||
      i.features.some(f => f.headline?.toLowerCase().includes(searchLower))
    );
  }, [sortedIssues, searchLower]);
  const displayedRumors = useMemo(() => {
    if (!searchLower) return sortedRumors;
    return sortedRumors.filter(r =>
      r.headline?.toLowerCase().includes(searchLower) ||
      r.body?.toLowerCase().includes(searchLower)
    );
  }, [sortedRumors, searchLower]);

  const latestIssue = displayedIssues[0] ?? null;
  const pastIssues = displayedIssues.slice(1);
  const nextIssueNumber = (sortedIssues[0]?.issueNumber ?? 0) + 1;

  const handleGenerateIssue = () => {
    if (roster.length < 2) {
      toast.error("Need a roster", {
        description: "Add at least two superstars before printing an issue.",
      });
      return;
    }
    const ctx = buildBookerContext(
      roster,
      currentChairman,
      history,
      shows,
      universeDate,
      events,
      rivalries,
      memories,
      issues,
      championships,
      stables,
      undefined,
      universeBible,
      seasonChronicles,
    );
    issueMutation.mutate(
      { data: { ...ctx, issueNumber: nextIssueNumber } },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "issue", data._usage, universeDate ?? undefined);
          if ((data as any)?.error) {
            toast.error("Printing delayed", { description: (data as any).error });
            return;
          }
          const featuredId = resolveWrestlerIdByName(
            data.cover.featuredWrestlerName,
            roster,
          );
          const issue: Issue = {
            id: crypto.randomUUID(),
            issueNumber: nextIssueNumber,
            universeDate,
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
              featuredWrestlerId: resolveWrestlerIdByName(
                f.featuredWrestlerName,
                roster,
              ),
            })),
            read: false,
          };
          setIssues((prev) => [issue, ...prev]);
          setActiveIssue(issue);
          toast.success("HOT OFF THE PRESS", {
            description: `Issue #${issue.issueNumber} just hit the stands.`,
          });
        },
        onError: (error) => {
          toast.error("Printing delayed", {
            description: describeApiError(error),
          });
        },
      },
    );
  };

  const handleSpillRumor = () => {
    if (roster.length < 1) {
      toast.error("Need a roster first.");
      return;
    }
    const ctx = buildBookerContext(
      roster,
      currentChairman,
      history,
      shows,
      universeDate,
      events,
      rivalries,
      memories,
      issues,
      championships,
      stables,
      undefined,
      universeBible,
      seasonChronicles,
    );
    rumorMutation.mutate(
      { data: ctx },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "rumor", data._usage, universeDate ?? undefined);
          if ((data as any)?.error) {
            toast.error("Sources went quiet", { description: (data as any).error });
            return;
          }
          const rumor: Rumor = {
            id: crypto.randomUUID(),
            universeDate,
            createdAt: Date.now(),
            headline: data.headline,
            body: data.body,
            fakeSource: data.fakeSource,
          };
          setRumors((prev) => [rumor, ...prev]);
          setActiveRumor(rumor);
        },
        onError: (error) => {
          toast.error("Sources went quiet", {
            description: describeApiError(error),
          });
        },
      },
    );
  };

  const handleMarkIssueRead = (id: string) => {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, read: true } : i)));
    setActiveIssue((prev) => (prev && prev.id === id ? { ...prev, read: true } : prev));
  };

  const isEmpty = sortedIssues.length === 0 && sortedRumors.length === 0;

  return (
    <div className="news-tab min-h-full">

      {/* ── Row 1: WWE.com-style top navigation bar ── */}
      <div className="news-topnav-bar">
        <div className="news-topnav-inner max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="news-topnav-list">
            {(["TV Shows", "Results", "Superstars", "Schedules", "Community", "Shop", "Universe Mode"] as const).map((label) => (
              <span key={label} className="news-topnav-link">{label}</span>
            ))}
          </nav>
          <span className="news-topnav-link news-topnav-link--active">News</span>
        </div>
      </div>

      {/* ── Row 2: Main header band — logo + site name + search ── */}
      <div className="news-header-band">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-full w-full">
          <div className="news-scratch-logo">
            <img
              src="/news/scratch-logo.png"
              alt="Gorilla Position News"
              className="news-scratch-logo-img"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div className="news-site-title min-w-0">
            <p className="news-site-name">Gorilla Position</p>
            <p className="news-site-tagline">Universe Mode &middot; News &amp; Rumors</p>
          </div>
          <div className="news-site-search hidden sm:flex">
            <input
              type="text"
              placeholder="Search news..."
              value={newsSearch}
              onChange={e => setNewsSearch(e.target.value)}
              className="news-search-input"
            />
            <button type="button" onClick={() => setNewsSearch("")} className="news-search-go">
              {newsSearch ? "✕" : "GO"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Row 3: Press Room action desk ── */}
      <div className="news-pressroom">
        <div className="news-pressroom-inner max-w-6xl mx-auto px-4 sm:px-6">
          <div className="pressroom-eyebrow">Press Room</div>
          <div className="pressroom-cards">
            <button
              onClick={handleGenerateIssue}
              disabled={issueMutation.isPending}
              className="pressroom-card"
              data-testid="button-generate-issue"
            >
              <span className="pressroom-card-icon">
                {issueMutation.isPending
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Newspaper className="h-6 w-6" />}
              </span>
              <span className="pressroom-card-body">
                <span className="pressroom-card-title">
                  {issueMutation.isPending ? "Sending To Print..." : "Run The Front Page"}
                </span>
                <span className="pressroom-card-desc">
                  {issueMutation.isPending
                    ? "Presses are warming up — issue incoming."
                    : "Publish this week's issue based on your universe."}
                </span>
              </span>
            </button>
            <button
              onClick={handleSpillRumor}
              disabled={rumorMutation.isPending}
              className="pressroom-card"
              data-testid="button-spill-rumor"
            >
              <span className="pressroom-card-icon">
                {rumorMutation.isPending
                  ? <Loader2 className="h-6 w-6 animate-spin" />
                  : <Megaphone className="h-6 w-6" />}
              </span>
              <span className="pressroom-card-body">
                <span className="pressroom-card-title">
                  {rumorMutation.isPending ? "Calling Backstage Sources..." : "Leak To The Dirt Sheet"}
                </span>
                <span className="pressroom-card-desc">
                  {rumorMutation.isPending
                    ? "Sources going quiet — checking the wire."
                    : "Feed the backstage rumor mill with a fresh leak."}
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      <div className="news-backdrop">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">

          {/* Empty state */}
          {isEmpty && (
            <EmptyNewsstand
              onPrintIssue={handleGenerateIssue}
              isPending={issueMutation.isPending}
            />
          )}

          {/* New issue(s) notification strip */}
          {sortedIssues.some((i) => !i.read) && (
            <div
              className="flex items-center justify-between gap-3 px-4 py-2 mb-4 rounded border border-border bg-muted/40"
              data-testid="news-notification-strip"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  aria-hidden
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: "#dc1e1e" }}
                />
                <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase text-foreground truncate">
                  New Issue{sortedIssues.filter((i) => !i.read).length > 1 ? "s" : ""} On The Stand
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setIssues((prev) => prev.map((i) => (i.read ? i : { ...i, read: true })))
                }
                className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground px-2 py-1 shrink-0"
                data-testid="button-dismiss-new-issues"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Search results count */}
          {searchLower && (
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-4">
              {displayedIssues.length + displayedRumors.length === 0
                ? `No results for "${newsSearch}"`
                : `${displayedIssues.length + displayedRumors.length} result${displayedIssues.length + displayedRumors.length === 1 ? "" : "s"} for "${newsSearch}"`
              }
            </div>
          )}

          {/* 2. Hero panel + 3. Headlines sidebar */}
          {!isEmpty && (
            <div className="news-main-grid mb-6">
              <HeroPanel
                issue={latestIssue}
                roster={roster}
                universeDate={universeDate}
                onReadIssue={() => latestIssue && setActiveIssue(latestIssue)}
                onPrintIssue={handleGenerateIssue}
                isPendingIssue={issueMutation.isPending}
                photoOverrides={photoOverrides}
                onPhotoUpload={setPhotoOverride}
              />
              <HeadlinesSidebar
                rumors={displayedRumors.slice(0, 5)}
                roster={roster}
                onRumorClick={setActiveRumor}
                onSpillRumor={handleSpillRumor}
                isPendingRumor={rumorMutation.isPending}
              />
            </div>
          )}

          {/* 4. Story panels */}
          {latestIssue && latestIssue.features.length > 0 && (
            <StoryPanelsRow
              features={latestIssue.features}
              roster={roster}
              onOpenIssue={() => setActiveIssue(latestIssue)}
              photoOverrides={photoOverrides}
              onPhotoUpload={setPhotoOverride}
            />
          )}

          {/* 5. Back issues strip */}
          {displayedIssues.length >= 2 && (
            <BackIssuesStrip
              issues={pastIssues}
              onIssueClick={setActiveIssue}
            />
          )}

        </div>
      </div>

      <IssueView
        issue={activeIssue}
        open={!!activeIssue}
        onOpenChange={(o) => !o && setActiveIssue(null)}
        onMarkRead={handleMarkIssueRead}
      />
      <RumorView
        rumor={activeRumor}
        open={!!activeRumor}
        onOpenChange={(o) => !o && setActiveRumor(null)}
      />
    </div>
  );
}

function HeroPanel({
  issue,
  roster,
  universeDate,
  onReadIssue,
  onPrintIssue,
  isPendingIssue,
  photoOverrides,
  onPhotoUpload,
}: {
  issue: Issue | null;
  roster: Wrestler[];
  universeDate: ReturnType<typeof useUniverseDate>[0];
  onReadIssue: () => void;
  onPrintIssue: () => void;
  isPendingIssue: boolean;
  photoOverrides: Record<string, string>;
  onPhotoUpload: (id: string, dataUrl: string) => void;
}) {
  const featuredWrestler = useMemo(
    () => findWrestlerById(roster, issue?.cover.featuredWrestlerId),
    [roster, issue],
  );

  if (!issue) {
    return (
      <div className="hero-panel hero-panel--empty">
        <div className="hero-overlay" />
        <div className="hero-content flex flex-col items-center justify-center text-center gap-4 p-8">
          <img
            src="/news/scratch-logo.png"
            alt="Gorilla Position News"
            className="w-44 h-auto opacity-50 object-contain"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#9a9a9a]">
            No issues on the stand. Print the first one.
          </p>
          <button
            onClick={onPrintIssue}
            disabled={isPendingIssue}
            className={cn("chrome-button mt-2", isPendingIssue && "opacity-60 cursor-not-allowed")}
          >
            {isPendingIssue ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
            {isPendingIssue ? "Sending To Print..." : "Run The Front Page"}
          </button>
        </div>
      </div>
    );
  }

  const headline = issue.cover.primaryHeadline;
  const isLongHeadline = headline.split(/\s+/).length > 4;
  const heroInitials = featuredWrestler
    ? featuredWrestler.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : null;

  if (issue.cover.featuredWrestlerId && !featuredWrestler) {
    console.warn(
      "[Gorilla Position] Hero: featuredWrestlerId not found in current roster:",
      issue.cover.featuredWrestlerId,
    );
  }

  const photoSrc = featuredWrestler
    ? (photoOverrides[featuredWrestler.id] ?? featuredWrestler.imageUrl ?? null)
    : null;

  return (
    <div className="hero-panel">
      {/* Background photo */}
      {photoSrc ? (
        <div
          className="hero-bg-photo"
          style={{ backgroundImage: `url(${photoSrc})` }}
        />
      ) : featuredWrestler && heroInitials ? (
        <div className="hero-bg-photo hero-bg-initials">
          <span className="hero-initials-text">{heroInitials}</span>
        </div>
      ) : (
        <div className="hero-bg-photo hero-bg-photo--empty" />
      )}
      {/* Photo edit overlay — only shown when there's a wrestler to attach to */}
      {featuredWrestler && (
        <PhotoEditButton
          wrestlerId={featuredWrestler.id}
          onUpload={onPhotoUpload}
        />
      )}
      {/* Vignette + gradient overlay */}
      <div className="hero-overlay" />
      {/* Content */}
      <div className="hero-content">
        <div className="hero-caption">
          This Week&apos;s Issue &mdash; Issue #{issue.issueNumber} &mdash; {formatDate(issue.universeDate)}
        </div>
        <h2
          className={cn("hero-headline", isLongHeadline && "hero-headline--long")}
        >
          {headline}
        </h2>
        {issue.cover.primarySubhead && (
          <p className="hero-subhead">{issue.cover.primarySubhead}</p>
        )}
        <div className="hero-footer">
          <button
            onClick={onReadIssue}
            className="chrome-button chrome-button--primary"
          >
            <ChevronRight className="h-3.5 w-3.5" />
            Read Issue
          </button>
        </div>
      </div>
    </div>
  );
}

function HeadlinesSidebar({
  rumors,
  roster,
  onRumorClick,
  onSpillRumor,
  isPendingRumor,
}: {
  rumors: Rumor[];
  roster: Wrestler[];
  onRumorClick: (rumor: Rumor) => void;
  onSpillRumor: () => void;
  isPendingRumor: boolean;
}) {
  return (
    <div className="headlines-sidebar">
      <div className="headlines-sidebar-header">
        <img src="/news/scratch-accent-divider.svg" alt="" aria-hidden className="headlines-divider-img" />
        <span className="headlines-sidebar-title">Headlines</span>
      </div>

      {rumors.length === 0 ? (
        <div className="headlines-empty">
          <p className="font-mono text-[11px] uppercase tracking-widest text-[#9a9a9a] text-center px-4 py-6">
            No dirt yet. Spill a rumor to start the buzz.
          </p>
        </div>
      ) : (
        <div className="headlines-list">
          {rumors.map((rumor, i) => (
            <HeadlinesCard
              key={rumor.id}
              rumor={rumor}
              roster={roster}
              isLast={i === rumors.length - 1}
              onClick={() => onRumorClick(rumor)}
            />
          ))}
        </div>
      )}

      {rumors.length >= 1 && (
        <div className="headlines-sidebar-footer">
          <button
            onClick={onSpillRumor}
            disabled={isPendingRumor}
            className={cn("chrome-button chrome-button--ghost w-full justify-center text-xs", isPendingRumor && "opacity-60 cursor-not-allowed")}
          >
            {isPendingRumor ? <Loader2 className="h-3 w-3 animate-spin" /> : <Megaphone className="h-3 w-3" />}
            + Feed Another Leak
          </button>
        </div>
      )}
    </div>
  );
}

function HeadlinesCard({
  rumor,
  roster,
  isLast,
  onClick,
}: {
  rumor: Rumor;
  roster: Wrestler[];
  isLast: boolean;
  onClick: () => void;
}) {
  const thumbnailWrestler = useMemo(
    () => findWrestlerInText(rumor.headline + " " + rumor.body, roster),
    [rumor, roster],
  );
  const excerpt = rumor.body.length > 80 ? rumor.body.slice(0, 80).trimEnd() + "..." : rumor.body;

  return (
    <>
      <button
        onClick={onClick}
        className="headlines-card group"
        data-testid={`rumor-card-${rumor.id}`}
      >
        {/* Thumbnail */}
        <div className="headlines-thumb">
          {thumbnailWrestler?.imageUrl ? (
            <img
              src={thumbnailWrestler.imageUrl}
              alt={thumbnailWrestler.name}
              className="headlines-thumb-img"
            />
          ) : (
            <div className="headlines-thumb-placeholder">
              <span>DIRT</span>
            </div>
          )}
        </div>
        {/* Text */}
        <div className="headlines-card-text">
          <p className="headlines-card-headline">{rumor.headline}</p>
          <p className="headlines-card-excerpt">{excerpt}</p>
        </div>
      </button>
      {!isLast && <div className="headlines-rule" />}
    </>
  );
}

function StoryPanelsRow({
  features,
  roster,
  onOpenIssue,
  photoOverrides,
  onPhotoUpload,
}: {
  features: IssueFeature[];
  roster: Wrestler[];
  onOpenIssue: () => void;
  photoOverrides: Record<string, string>;
  onPhotoUpload: (id: string, dataUrl: string) => void;
}) {
  const displayFeatures = features.slice(0, 4);
  const placeholderCount = Math.max(0, 3 - displayFeatures.length);

  return (
    <section className="story-panels-section mb-6">
      <div className="news-section-label">
        <img src="/news/scratch-accent-divider.svg" alt="" aria-hidden className="section-divider-img" />
        <span>Inside This Issue</span>
      </div>
      <div className="story-panels-grid">
        {displayFeatures.map((feature, i) => (
          <StoryPanel
            key={i}
            feature={feature}
            roster={roster}
            onClick={onOpenIssue}
            photoOverrides={photoOverrides}
            onPhotoUpload={onPhotoUpload}
          />
        ))}
        {Array.from({ length: placeholderCount }).map((_, i) => (
          <div key={`placeholder-${i}`} className="story-panel story-panel--placeholder">
            <div className="story-panel-content">
              <span className="story-panel-placeholder-text">More Coming Soon</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function StoryPanel({
  feature,
  roster,
  onClick,
  photoOverrides,
  onPhotoUpload,
}: {
  feature: IssueFeature;
  roster: Wrestler[];
  onClick: () => void;
  photoOverrides: Record<string, string>;
  onPhotoUpload: (id: string, dataUrl: string) => void;
}) {
  const wrestler = useMemo(
    () => findWrestlerById(roster, feature.featuredWrestlerId),
    [roster, feature.featuredWrestlerId],
  );

  const initials = wrestler
    ? wrestler.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : null;

  if (feature.featuredWrestlerId && !wrestler) {
    console.warn(
      "[Gorilla Position] StoryPanel: featuredWrestlerId not found in roster:",
      feature.featuredWrestlerId,
    );
  }

  const photoSrc = wrestler
    ? (photoOverrides[wrestler.id] ?? wrestler.imageUrl ?? null)
    : null;

  return (
    <button onClick={onClick} className="story-panel group">
      {photoSrc ? (
        <div
          className="story-panel-bg"
          style={{ backgroundImage: `url(${photoSrc})` }}
        />
      ) : wrestler && initials ? (
        <div className="story-panel-bg story-panel-initials">
          <span className="story-initials-text">{initials}</span>
        </div>
      ) : null}
      {wrestler && (
        <PhotoEditButton
          wrestlerId={wrestler.id}
          onUpload={onPhotoUpload}
        />
      )}
      <div className="story-panel-overlay" />
      <div className="story-panel-content">
        <p className="story-panel-kind">{feature.kind.replace(/_/g, " ")}</p>
        <h3 className="story-panel-headline">{feature.headline}</h3>
      </div>
    </button>
  );
}

function BackIssuesStrip({
  issues,
  onIssueClick,
}: {
  issues: Issue[];
  onIssueClick: (issue: Issue) => void;
}) {
  return (
    <section className="back-issues-section mb-8">
      <div className="news-section-label">
        <img src="/news/scratch-accent-divider.svg" alt="" aria-hidden className="section-divider-img" />
        <span>On The Rack</span>
      </div>
      <div className="back-issues-strip">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className="back-issue-thumb relative shrink-0 cursor-pointer"
            onClick={() => onIssueClick(issue)}
          >
            <MagazineCover issue={issue} size="thumb" />
            {!issue.read && (
              <div className="back-issue-new-badge">New</div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function EmptyNewsstand({
  onPrintIssue,
  isPending,
}: {
  onPrintIssue: () => void;
  isPending: boolean;
}) {
  return (
    <div className="empty-newsstand">
      <img
    src="/news/scratch-logo.png"
    alt="Gorilla Position News"
    className="empty-newsstand-logo"
    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
  />
      <h2 className="empty-newsstand-heading">The Newsstand Is Empty</h2>
      <p className="empty-newsstand-subhead">
        Save canon moments and night notes first, then print a weekly issue that reacts to your universe.
      </p>
      <button
        onClick={onPrintIssue}
        disabled={isPending}
        className={cn("chrome-button chrome-button--primary", isPending && "opacity-60 cursor-not-allowed")}
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
        {isPending ? "Sending To Print..." : "Run The Front Page"}
      </button>
    </div>
  );
}
