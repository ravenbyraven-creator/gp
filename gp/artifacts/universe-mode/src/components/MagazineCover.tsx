import { useMemo } from "react";
import type { Issue } from "@/lib/news";
import { COVER_HEX, COVER_IS_DARK } from "@/lib/news";
import { useRoster } from "@/lib/storage";
import { formatDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface MagazineCoverProps {
  issue: Issue;
  /** Visual scale: "stack" = newsstand thumbnail-friendly, "feature" = the big lead cover, "thumb" = small past-issue tile. */
  size?: "stack" | "feature" | "thumb";
  className?: string;
  onClick?: () => void;
}

export function MagazineCover({ issue, size = "stack", className, onClick }: MagazineCoverProps) {
  const [roster] = useRoster();
  const featuredWrestler = useMemo(
    () => roster.find((w) => w.id === issue.cover.featuredWrestlerId),
    [roster, issue.cover.featuredWrestlerId],
  );

  const bg = COVER_HEX[issue.cover.coverColor];
  const isDark = COVER_IS_DARK[issue.cover.coverColor];

  // Stable per-issue rotation for the slight off-axis "this is paper" effect.
  const tiltDeg = useMemo(() => {
    let h = 0;
    for (let i = 0; i < issue.id.length; i++) h = (h * 31 + issue.id.charCodeAt(i)) >>> 0;
    return ((h % 200) / 100 - 1) * 1.4; // -1.4 .. +1.4
  }, [issue.id]);

  const sizing =
    size === "feature"
      ? "w-full max-w-[600px] mx-auto"
      : size === "thumb"
      ? "w-[140px] shrink-0"
      : "w-full max-w-[420px] mx-auto";

  // Headline color rules — yellow on blue, white-with-red on red, black on yellow, yellow on black.
  const headlineColor =
    issue.cover.coverColor === "BLUE"
      ? "#f4c41a"
      : issue.cover.coverColor === "YELLOW"
      ? "#0a0a0a"
      : issue.cover.coverColor === "BLACK"
      ? "#f4c41a"
      : "#ffffff";
  const headlineStrokeColor =
    issue.cover.coverColor === "YELLOW"
      ? "#dc1e1e"
      : issue.cover.coverColor === "RED"
      ? "#0a0a0a"
      : "#000000";

  const teasers = issue.cover.teasers.slice(0, 3);
  const initials = featuredWrestler
    ? featuredWrestler.name
        .split(/\s+/)
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "GP";

  return (
    <div
      className={cn(
        "magazine-cover relative aspect-[3/4] overflow-hidden cursor-pointer select-none",
        "shadow-[0_18px_40px_rgba(0,0,0,0.55),0_4px_10px_rgba(0,0,0,0.45)]",
        sizing,
        className,
      )}
      style={{
        backgroundColor: bg,
        transform: `rotate(${tiltDeg}deg)`,
      }}
      onClick={onClick}
      data-testid={`magazine-cover-issue-${issue.issueNumber}`}
    >
      {/* Featured wrestler photo, full-bleed, magazine-treated */}
      <div className="absolute inset-0 magazine-photo">
        {featuredWrestler?.imageUrl ? (
          <img
            src={featuredWrestler.imageUrl}
            alt={featuredWrestler.name}
            className="w-full h-full object-cover object-top"
            draggable={false}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{
              background: `linear-gradient(180deg, ${bg} 0%, ${isDark ? "#000" : "#444"} 120%)`,
            }}
          >
            <span
              className="font-display font-bold tracking-tight leading-none"
              style={{
                fontSize: size === "thumb" ? 56 : size === "feature" ? 220 : 160,
                color: isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.18)",
              }}
            >
              {initials}
            </span>
          </div>
        )}
      </div>

      {/* Halftone + grain overlays */}
      <div
        className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-25"
        style={{ backgroundImage: "url('/news/halftone.svg')", backgroundSize: "6px 6px" }}
      />
      <div
        className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-50"
        style={{ backgroundImage: "url('/news/grain.svg')", backgroundSize: "200px 200px" }}
      />

      {/* Top gradient for legibility */}
      <div
        className="absolute inset-x-0 top-0 h-1/3 pointer-events-none"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.2) 60%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* Masthead */}
      <div className="absolute top-2 left-3 right-3 flex items-start justify-between gap-2 z-10">
        <h1
          className="font-display uppercase leading-[0.78] tracking-tight italic"
          style={{
            fontSize: size === "thumb" ? 22 : size === "feature" ? 72 : 56,
            color: "#ffffff",
            textShadow: "0 2px 0 #dc1e1e, 0 0 12px rgba(0,0,0,0.6)",
            WebkitTextStroke: size === "thumb" ? "1px #dc1e1e" : "2px #dc1e1e",
            transform: "skew(-6deg, 0deg)",
          }}
        >
          {issue.cover.masthead}
        </h1>
        {/* Issue strip + barcode + price */}
        <div
          className={cn(
            "shrink-0 text-right uppercase",
            size === "thumb" ? "text-[6px] leading-[1.1]" : "text-[10px] leading-tight",
          )}
          style={{ color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
        >
          <div className="font-display tracking-wider">ISSUE #{issue.issueNumber}</div>
          <div className="opacity-90">{formatDate(issue.universeDate)}</div>
          {size !== "thumb" && (
            <div className="mt-1 inline-flex items-end gap-[1px] bg-white/95 p-1">
              {Array.from({ length: 18 }).map((_, i) => (
                <span
                  key={i}
                  className="block bg-black"
                  style={{ width: (i % 3) + 1, height: 18 }}
                />
              ))}
            </div>
          )}
          <div className="mt-1 font-mono opacity-95">$5.99 US</div>
        </div>
      </div>

      {/* Secondary teasers — left-side stack, vertically centered-ish */}
      <div
        className={cn(
          "absolute left-3 z-10 flex flex-col",
          size === "thumb" ? "top-12 gap-1" : "top-[28%] gap-3",
        )}
        style={{ maxWidth: size === "thumb" ? "55%" : "44%" }}
      >
        {teasers.map((t, i) => {
          const accent = ["#dc1e1e", "#f4c41a", "#3ecf6b"][i % 3];
          const tilt = (i % 2 === 0 ? -1 : 1) * 0.6;
          return (
            <div
              key={i}
              className="bg-black/45 backdrop-blur-[1px] px-2 py-1"
              style={{ transform: `rotate(${tilt}deg)`, borderLeft: `3px solid ${accent}` }}
            >
              <div
                className="font-display uppercase font-bold leading-tight"
                style={{
                  color: "#fff",
                  fontSize: size === "thumb" ? 9 : 16,
                  textShadow: "0 1px 0 rgba(0,0,0,0.9)",
                }}
              >
                {t.headline}
              </div>
              {size !== "thumb" && (
                <div
                  className="font-sans text-[10px] uppercase tracking-wide"
                  style={{ color: accent }}
                >
                  {t.dek}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Burst sticker */}
      {issue.cover.burstSticker && size !== "thumb" && (
        <div
          className="absolute z-20"
          style={{
            right: "8%",
            top: "32%",
            transform: "rotate(-12deg)",
          }}
        >
          <div
            className="rounded-full flex items-center justify-center text-center font-display uppercase font-extrabold leading-tight"
            style={{
              width: size === "feature" ? 130 : 100,
              height: size === "feature" ? 130 : 100,
              background: "#f4c41a",
              border: "4px solid #3ecf6b",
              color: "#dc1e1e",
              fontSize: size === "feature" ? 13 : 11,
              padding: "10px",
              boxShadow: "0 6px 14px rgba(0,0,0,0.45)",
              textShadow: "0 1px 0 rgba(0,0,0,0.15)",
            }}
          >
            {issue.cover.burstSticker}
          </div>
        </div>
      )}

      {/* Primary headline — anchored bottom, the showpiece */}
      <div
        className="absolute left-0 right-0 z-10"
        style={{ bottom: size === "thumb" ? 6 : "6%" }}
      >
        <div
          className="px-3 font-display uppercase font-extrabold leading-[0.85] tracking-tight"
          style={{
            color: headlineColor,
            fontSize:
              size === "thumb"
                ? 22
                : size === "feature"
                ? 96
                : 64,
            WebkitTextStroke:
              size === "thumb" ? `1px ${headlineStrokeColor}` : `2.5px ${headlineStrokeColor}`,
            textShadow: "0 6px 18px rgba(0,0,0,0.55)",
            transform: "rotate(-1deg)",
            letterSpacing: "-0.02em",
          }}
        >
          <HeadlineWords text={issue.cover.primaryHeadline} />
        </div>
        {issue.cover.primarySubhead && size !== "thumb" && (
          <div
            className="px-3 mt-1 font-display uppercase font-bold"
            style={{
              color: "#fff",
              fontSize: size === "feature" ? 18 : 13,
              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
              transform: "rotate(-1deg)",
            }}
          >
            {issue.cover.primarySubhead}
          </div>
        )}
      </div>

      {/* Subtle vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.35) 100%)",
        }}
      />
    </div>
  );
}

/** Stagger headline words so multi-line headlines feel hand-laid like the magazine refs. */
function HeadlineWords({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length <= 2) return <>{text}</>;
  // Break into balanced lines, ~3 words each.
  const perLine = Math.ceil(words.length / Math.ceil(words.length / 3));
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += perLine) {
    lines.push(words.slice(i, i + perLine).join(" "));
  }
  return (
    <>
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            marginLeft: `${(i % 2) * 8 + (i === lines.length - 1 ? 4 : 0)}%`,
          }}
        >
          {line}
        </div>
      ))}
    </>
  );
}
