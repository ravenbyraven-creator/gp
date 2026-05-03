import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Issue, IssueFeature } from "@/lib/news";
import { useRoster, useUniverseDate, useEvents, type RivalryEntry } from "@/lib/storage";
import { upcomingEvents as sortUpcoming, weeksUntil, formatDate } from "@/lib/calendar";
import { MagazineCover } from "./MagazineCover";
import { FileToRivalryDialog } from "./RivalryDialogs";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface IssueViewProps {
  issue: Issue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkRead: (issueId: string) => void;
}

export function IssueView({ issue, open, onOpenChange, onMarkRead }: IssueViewProps) {
  if (!issue) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[100vw] sm:max-w-[820px] w-full p-0 overflow-hidden",
          "bg-[#f4ecd8] text-black border-0 rounded-none",
          "max-h-[100dvh] sm:max-h-[92vh]",
        )}
        style={{ backgroundImage: "url('/news/paper.svg')", backgroundSize: "400px 400px" }}
      >
        <DialogTitle className="sr-only">
          Issue #{issue.issueNumber} — {issue.cover.primaryHeadline}
        </DialogTitle>
        <DialogDescription className="sr-only">{issue.cover.masthead}</DialogDescription>
        <div className="overflow-y-auto max-h-[100dvh] sm:max-h-[92vh]">
          <IssueBody issue={issue} onMarkRead={onMarkRead} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IssueBody({ issue, onMarkRead }: { issue: Issue; onMarkRead: (id: string) => void }) {
  const lead = issue.features.find((f) => f.kind === "lead");
  const midFeatures = issue.features.filter((f) => f.kind === "feature");
  const dirtsheet = issue.features.find((f) => f.kind === "dirtsheet");
  const whatsnext = issue.features.find((f) => f.kind === "whatsnext");
  const [fileCoverOpen, setFileCoverOpen] = useState(false);

  // Stable per-issue magazine entry. Same issue → same entry.id, so re-filing is idempotent.
  const coverEntry = useMemo<RivalryEntry>(
    () => ({
      kind: "magazine",
      id: `magazine-${issue.id}`,
      createdAt: issue.createdAt,
      universeDate: issue.universeDate,
      data: {
        issueId: issue.id,
        issueNumber: issue.issueNumber,
        coverHeadline: issue.cover.primaryHeadline,
        coverFeaturedWrestlerId: issue.cover.featuredWrestlerId,
      },
    }),
    [issue],
  );

  return (
    <div className="space-y-10 sm:space-y-14 pb-12">
      {/* Spread 1 — the cover */}
      <section className="px-4 pt-6 sm:pt-10">
        <MagazineCover issue={issue} size="feature" />
      </section>

      {/* Spread 2 — lead */}
      {lead && (
        <FeatureSpread
          feature={lead}
          variant="lead"
          issueNumber={issue.issueNumber}
        />
      )}

      {/* Spreads 3-5 — mid-card features */}
      {midFeatures.map((f, i) => (
        <FeatureSpread
          key={`feat-${i}`}
          feature={f}
          variant="feature"
          issueNumber={issue.issueNumber}
          accent={["#dc1e1e", "#1e4ebf", "#3ecf6b"][i % 3]}
        />
      ))}

      {/* Spread 6 — dirt sheet sidebar */}
      {dirtsheet && <DirtSheetSpread feature={dirtsheet} />}

      {/* Spread 7 — what's next */}
      {whatsnext && <WhatsNextSpread feature={whatsnext} issue={issue} />}

      {/* Footer */}
      <section className="px-6 sm:px-10 pt-4 border-t-2 border-black/30 mt-6">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <button
            onClick={() => onMarkRead(issue.id)}
            className={cn(
              "font-display uppercase tracking-wider text-xs px-4 py-2 border-2 border-black",
              issue.read ? "bg-[#3ecf6b] text-black" : "bg-black text-[#f4c41a] hover:bg-[#dc1e1e] hover:text-white",
            )}
            data-testid="button-mark-issue-read"
          >
            {issue.read ? "Marked as Read" : "Mark as Read"}
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setFileCoverOpen(true)}
              className="font-display uppercase tracking-wider text-xs px-4 py-2 border-2 border-black bg-white text-black hover:bg-black hover:text-[#f4c41a] inline-flex items-center gap-1.5"
              data-testid="button-file-cover-story"
            >
              <BookOpen className="w-3.5 h-3.5" />
              File Cover Story
            </button>
            <button
              disabled
              className="font-display uppercase tracking-wider text-xs px-4 py-2 border-2 border-black/30 text-black/40 cursor-not-allowed"
              title="TODO — coming in a later update"
            >
              Download as Image
            </button>
          </div>
        </div>
      </section>

      <FileToRivalryDialog
        open={fileCoverOpen}
        onOpenChange={setFileCoverOpen}
        entry={coverEntry}
        suggestedHint={issue.cover.suggestedRivalryHint}
        mode="issue-cover"
      />
    </div>
  );
}

function FeatureSpread({
  feature,
  variant,
  issueNumber,
  accent,
}: {
  feature: IssueFeature;
  variant: "lead" | "feature";
  issueNumber: number;
  accent?: string;
}) {
  const [roster] = useRoster();
  const inset = useMemo(() => {
    if (!feature.featuredWrestlerId) return null;
    return roster.find((w) => w.id === feature.featuredWrestlerId) ?? null;
  }, [roster, feature.featuredWrestlerId]);
  const accentColor = accent ?? "#dc1e1e";

  const paragraphs = feature.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  const pullQuoteIndex = Math.max(1, Math.floor(paragraphs.length * 0.25));

  return (
    <article className="px-5 sm:px-10">
      <div
        className="text-[10px] uppercase tracking-[0.25em] font-display mb-2"
        style={{ color: accentColor }}
      >
        {variant === "lead" ? "Cover Story" : "Feature"} · Issue #{issueNumber}
      </div>
      <h2
        className={cn(
          "font-display uppercase font-extrabold leading-[0.9] tracking-tight text-black",
          variant === "lead" ? "text-4xl sm:text-6xl" : "text-3xl sm:text-5xl",
        )}
        style={{ textShadow: `3px 3px 0 ${accentColor}` }}
      >
        {feature.headline}
      </h2>
      {feature.dek && (
        <p className="mt-3 font-serif italic text-base sm:text-lg text-black/80">
          {feature.dek}
        </p>
      )}
      {feature.byline && (
        <p className="mt-3 font-display uppercase tracking-widest text-[10px] text-black/60">
          By {feature.byline}
        </p>
      )}

      <div className="mt-5 sm:grid sm:grid-cols-3 sm:gap-6">
        <div className="sm:col-span-2 space-y-4 font-serif text-[15px] leading-[1.7] text-black">
          {paragraphs.map((p, i) => (
            <PullQuoteOrParagraph
              key={i}
              text={p}
              isFirst={i === 0}
              showQuoteAfter={i === pullQuoteIndex - 1}
              pullQuote={feature.pullQuote}
              accent={accentColor}
            />
          ))}
        </div>

        {/* Inset photo */}
        {inset && (
          <aside className="hidden sm:block">
            <div
              className="relative aspect-[3/4] magazine-photo border-4 border-black overflow-hidden"
              style={{ transform: "rotate(1.5deg)" }}
            >
              {inset.imageUrl ? (
                <img
                  src={inset.imageUrl}
                  alt={inset.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-black flex items-center justify-center">
                  <span className="font-display text-white/30 text-6xl">
                    {inset.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                </div>
              )}
              <div
                className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-20"
                style={{ backgroundImage: "url('/news/halftone.svg')", backgroundSize: "6px 6px" }}
              />
            </div>
            <div
              className="mt-2 font-display uppercase text-[10px] tracking-widest text-black/70 text-center"
              style={{ borderTop: `2px solid ${accentColor}`, paddingTop: 4 }}
            >
              {inset.name}
            </div>
          </aside>
        )}
      </div>
    </article>
  );
}

function PullQuoteOrParagraph({
  text,
  isFirst,
  showQuoteAfter,
  pullQuote,
  accent,
}: {
  text: string;
  isFirst: boolean;
  showQuoteAfter: boolean;
  pullQuote?: string;
  accent: string;
}) {
  const dropCap = isFirst ? text.charAt(0) : "";
  const rest = isFirst ? text.slice(1) : text;
  return (
    <>
      <p>
        {isFirst && (
          <span
            className="float-left font-display font-extrabold leading-[0.85] mr-2 mt-1"
            style={{ fontSize: 64, color: accent }}
          >
            {dropCap}
          </span>
        )}
        {rest}
      </p>
      {showQuoteAfter && pullQuote && (
        <blockquote
          className="my-6 px-4 py-3 border-y-4 border-black"
          style={{ borderColor: accent }}
        >
          <span
            className="font-display text-3xl sm:text-4xl leading-none align-top mr-2"
            style={{ color: accent, fontFamily: "'Oblata Display', serif" }}
          >
            “
          </span>
          <span
            className="italic"
            style={{ fontFamily: "'Oblata Display', serif", fontSize: 22, lineHeight: 1.25 }}
          >
            {pullQuote}
          </span>
          <span
            className="font-display text-3xl sm:text-4xl leading-none ml-2"
            style={{ color: accent, fontFamily: "'Oblata Display', serif" }}
          >
            ”
          </span>
        </blockquote>
      )}
    </>
  );
}

function DirtSheetSpread({ feature }: { feature: IssueFeature }) {
  // Body is expected to have lines starting with "- ".
  const lines = feature.body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const items: string[] = [];
  let buffer = "";
  for (const line of lines) {
    if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* ")) {
      if (buffer) items.push(buffer);
      buffer = line.replace(/^[-•*]\s+/, "");
    } else {
      buffer = buffer ? buffer + " " + line : line;
    }
  }
  if (buffer) items.push(buffer);

  return (
    <article className="mx-3 sm:mx-10">
      <div
        className="border-y-4 border-black p-5 sm:p-7"
        style={{ background: "#f7f0d4", boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.15)" }}
      >
        <div className="flex items-baseline justify-between gap-3 border-b-2 border-black pb-2 mb-4">
          <h3
            className="font-display uppercase font-extrabold tracking-tight"
            style={{ fontSize: 28, color: "#0a0a0a" }}
          >
            {feature.headline || "BACKSTAGE WHISPERS"}
          </h3>
          <span
            className="font-mono text-[10px] uppercase tracking-widest"
            style={{ color: "#dc1e1e" }}
          >
            DIRT SHEET
          </span>
        </div>
        <ul className="space-y-3 font-mono text-[13px] leading-[1.65] text-black">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span style={{ color: "#dc1e1e" }} className="font-bold">▣</span>
              <span>{it}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 pt-3 border-t border-black/40 font-mono text-[11px] italic text-black/70">
          {feature.pullQuote ?? feature.dek ?? "Tensions running high in the locker room."}
        </div>
      </div>
    </article>
  );
}

function WhatsNextSpread({ feature, issue }: { feature: IssueFeature; issue: Issue }) {
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const next = useMemo(() => {
    const list = sortUpcoming(events, universeDate);
    return list[0] ?? null;
  }, [events, universeDate]);
  const weeksOut = next ? weeksUntil(next, universeDate) : null;

  const paragraphs = feature.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <article className="px-5 sm:px-10">
      <div
        className="text-[10px] uppercase tracking-[0.25em] font-display mb-2"
        style={{ color: "#1e4ebf" }}
      >
        On the Horizon · Closing the Issue
      </div>
      <h2
        className="font-display uppercase font-extrabold leading-[0.9] tracking-tight text-black text-3xl sm:text-5xl"
        style={{ textShadow: "3px 3px 0 #1e4ebf" }}
      >
        {feature.headline}
      </h2>
      <div className="mt-5 sm:grid sm:grid-cols-3 sm:gap-6">
        <div className="sm:col-span-2 space-y-4 font-serif text-[15px] leading-[1.7] text-black">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <aside>
          <div
            className="border-4 border-black p-4 text-center"
            style={{ background: "#f4c41a" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-widest text-black/70">
              Countdown
            </div>
            {next ? (
              <>
                <div className="font-display uppercase text-2xl font-extrabold leading-tight mt-1 text-black">
                  {next.name}
                </div>
                <div className="mt-2 font-display text-5xl font-black leading-none" style={{ color: "#dc1e1e" }}>
                  {weeksOut === 0 ? "NOW" : weeksOut}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-black/70 mt-1">
                  {weeksOut === 0
                    ? "This week"
                    : weeksOut === 1
                    ? "1 week out"
                    : `${weeksOut} weeks out`}
                </div>
                <div className="mt-3 pt-2 border-t border-black/30 font-mono text-[10px] uppercase tracking-widest text-black/60">
                  {formatDate(next)}
                </div>
              </>
            ) : (
              <div className="mt-3 font-display uppercase text-sm text-black/70">
                No PPV scheduled. Book one in Settings.
              </div>
            )}
          </div>
          <div
            className="mt-4 font-mono text-[11px] uppercase tracking-widest text-black/70 text-center italic"
          >
            Subscribe — Issue #{issue.issueNumber + 1} hits the stand next universe week
          </div>
        </aside>
      </div>
    </article>
  );
}
