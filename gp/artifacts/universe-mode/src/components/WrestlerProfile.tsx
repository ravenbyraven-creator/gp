import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Edit2, Trophy, Swords, Activity, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRoster,
  useRivalries,
  useTitleReigns,
  useChampionships,
  useChampionLookup,
  useMatchResults,
} from "@/lib/storage";
import { deriveWrestlerStats, wrestlerMatches } from "@/lib/matches";
import { rivalryDisplayTitle, sideLabel } from "@/lib/rivalry";
import { formatDate } from "@/lib/calendar";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";

const BRAND_RED = "#dc1e1e";

const OUTCOME_LABEL: Record<string, string> = {
  PIN: "Pin",
  SUBMISSION: "Submission",
  DQ: "DQ",
  COUNTOUT: "CO",
  NO_CONTEST: "NC",
  DRAW: "Draw",
  KO: "KO",
  OTHER: "—",
};

interface WrestlerProfileProps {
  wrestlerId: string | null;
  onClose: () => void;
  onEdit?: () => void;
  onLogMatch?: () => void;
}

function ProfileSection({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-muted-foreground">
          {label}
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {children}
    </div>
  );
}

export function WrestlerProfile({ wrestlerId, onClose, onEdit, onLogMatch }: WrestlerProfileProps) {
  const [roster] = useRoster();
  const [rivalries] = useRivalries();
  const [titleReigns] = useTitleReigns();
  const [championships] = useChampionships();
  const [matchResults] = useMatchResults();
  const champLookup = useChampionLookup();

  const wrestler = useMemo(
    () => roster.find((w) => w.id === wrestlerId) ?? null,
    [roster, wrestlerId],
  );
  const rosterMap = useMemo(() => new Map(roster.map((w) => [w.id, w])), [roster]);
  const champMap = useMemo(() => new Map(championships.map((c) => [c.id, c])), [championships]);

  const stats = useMemo(() => {
    if (!wrestlerId) return null;
    return deriveWrestlerStats(wrestlerId, matchResults);
  }, [wrestlerId, matchResults]);

  const myMatches = useMemo(() => {
    if (!wrestlerId) return [];
    return wrestlerMatches(wrestlerId, matchResults);
  }, [wrestlerId, matchResults]);

  const myReigns = useMemo(() => {
    if (!wrestlerId || !wrestler) return [];
    return titleReigns.filter(
      (r) =>
        r.wrestlerId === wrestlerId ||
        r.wrestlerName.toLowerCase() === wrestler.name.toLowerCase(),
    );
  }, [wrestlerId, wrestler, titleReigns]);

  const activeRivalries = useMemo(() => {
    if (!wrestlerId) return [];
    return rivalries.filter(
      (r) =>
        r.status === "ACTIVE" &&
        r.sides.some((s) => (s as any).wrestlerIds?.includes(wrestlerId)),
    );
  }, [wrestlerId, rivalries]);

  const currentChampionships = champLookup.get(wrestlerId ?? "") ?? [];
  const open = Boolean(wrestler && wrestlerId);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-8 px-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-5xl bg-card border border-border rounded-xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-[3px] w-full" style={{ background: BRAND_RED }} />

            <div className="bg-muted/10 border-b border-border px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground">
                  Talent Profile
                </div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-wider text-foreground leading-tight mt-0.5 truncate">
                  {wrestler?.name}
                </h2>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onLogMatch && (
                  <button
                    type="button"
                    onClick={onLogMatch}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:border-foreground/40 bg-muted/20 hover:bg-muted/40 text-[10px] font-bold tracking-widest uppercase text-foreground/70 hover:text-foreground transition-colors"
                  >
                    Log Match
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={onEdit}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border hover:border-foreground/40 bg-muted/20 hover:bg-muted/40 text-[10px] font-bold tracking-widest uppercase text-foreground/70 hover:text-foreground transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                    Edit
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[260px_1fr]">
              {/* Left sidebar */}
              <div className="border-b md:border-b-0 md:border-r border-border p-5 space-y-5">
                {/* Portrait */}
                <div className="relative w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted/20 border border-border">
                  {wrestler?.imageUrl ? (
                    <img
                      src={wrestler.imageUrl}
                      alt={wrestler.name}
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-muted-foreground/20 font-display text-7xl font-bold uppercase">
                        {wrestler?.name?.[0]}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-0 right-0 flex justify-center">
                    <ChampionBeltOverlay championships={currentChampionships} size="lg" />
                  </div>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">
                    {wrestler?.brand ?? "FREE AGENT"}
                  </span>
                  {wrestler?.alignment && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">
                      {wrestler.alignment}
                    </span>
                  )}
                  {wrestler?.role && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">
                      {wrestler.role}
                    </span>
                  )}
                  {wrestler?.status === "INACTIVE" && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-amber-500/40 text-amber-400 bg-amber-500/10">
                      Inactive
                    </span>
                  )}
                </div>

                {/* Current Championships */}
                {currentChampionships.length > 0 && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      Current {currentChampionships.length === 1 ? "Title" : "Titles"}
                    </div>
                    <div className="space-y-1.5">
                      {currentChampionships.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded border border-amber-500/20 bg-amber-500/5"
                        >
                          {c.imageUrl && (
                            <img
                              src={c.imageUrl}
                              alt={c.name}
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          )}
                          <span className="text-[10px] font-bold tracking-wider uppercase text-amber-400 leading-tight">
                            {c.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* W-L-D Record */}
                {stats && (
                  <div>
                    <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-2">
                      Career Record
                    </div>
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      <div className="text-center py-2 rounded bg-emerald-500/10 border border-emerald-500/20">
                        <div className="text-xl font-bold text-emerald-400 font-display">
                          {stats.wins}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                          W
                        </div>
                      </div>
                      <div className="text-center py-2 rounded bg-red-500/10 border border-red-500/20">
                        <div className="text-xl font-bold text-red-400 font-display">
                          {stats.losses}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                          L
                        </div>
                      </div>
                      <div className="text-center py-2 rounded bg-muted/20 border border-border">
                        <div className="text-xl font-bold text-muted-foreground font-display">
                          {stats.draws}
                        </div>
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wider font-bold">
                          D
                        </div>
                      </div>
                    </div>
                    {stats.total > 0 && (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Win %</span>
                          <span className="font-bold text-foreground">
                            {Math.round(stats.winPct * 100)}%
                          </span>
                        </div>
                        {stats.titleMatchWins + stats.titleMatchLosses > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Title Matches</span>
                            <span className="font-bold text-foreground">
                              {stats.titleMatchWins}-{stats.titleMatchLosses}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                    {stats.currentStreak.length > 0 && stats.currentStreak.kind !== "N" && (
                      <div
                        className={cn(
                          "mt-2 px-2 py-1 rounded text-center text-[9px] font-bold tracking-widest uppercase border",
                          stats.currentStreak.kind === "W"
                            ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                            : "text-red-400 border-red-400/30 bg-red-400/10",
                        )}
                      >
                        {stats.currentStreak.length}{" "}
                        {stats.currentStreak.kind === "W" ? "Win" : "Loss"} Streak
                      </div>
                    )}
                    {stats.total === 0 && (
                      <div className="text-center text-[10px] text-muted-foreground/40 uppercase tracking-wider py-1">
                        No matches logged
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right content */}
              <div className="overflow-y-auto max-h-[70vh] p-5 space-y-6">
                {/* Active Rivalries */}
                <ProfileSection icon={Swords} label="Active Rivalries">
                  {activeRivalries.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/40 uppercase tracking-wider py-1">
                      Not in any active rivalry
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeRivalries.map((r) => (
                        <div
                          key={r.id}
                          className="px-3 py-2 rounded border border-border bg-muted/10 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold tracking-wider uppercase text-foreground truncate">
                              {rivalryDisplayTitle(r, roster)}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {r.sides.map((s) => sideLabel(s, roster)).join(" vs ")}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border text-emerald-400 border-emerald-400/30 bg-emerald-400/10 shrink-0">
                            Active
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ProfileSection>

                {/* Title Reigns */}
                {myReigns.length > 0 && (
                  <ProfileSection icon={Trophy} label={`Title Reigns (${myReigns.length})`}>
                    <div className="space-y-1.5">
                      {myReigns.map((r, i) => {
                        const champ = champMap.get(r.championshipId);
                        return (
                          <div key={i} className="px-3 py-2 rounded border border-border bg-muted/10">
                            <div className="flex items-center justify-between gap-2 mb-0.5">
                              <div className="text-[10px] font-bold tracking-wider uppercase text-amber-400 truncate">
                                {champ?.name ?? "Unknown Title"}
                              </div>
                              <span
                                className={cn(
                                  "text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded border shrink-0",
                                  !r.lostDate
                                    ? "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
                                    : "text-muted-foreground border-border",
                                )}
                              >
                                {!r.lostDate ? "Current" : "Former"}
                              </span>
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              Won: {formatDate(r.wonDate)}
                              {r.lostDate ? ` · Lost: ${formatDate(r.lostDate)}` : ""}
                            </div>
                            {r.howWon && (
                              <div className="text-[10px] text-muted-foreground/50 mt-0.5 italic">
                                Via {r.howWon}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </ProfileSection>
                )}

                {/* Career Matches */}
                <ProfileSection
                  icon={Activity}
                  label={`Career Matches${myMatches.length > 0 ? ` (${myMatches.length})` : ""}`}
                >
                  {myMatches.length === 0 ? (
                    <div className="text-[11px] text-muted-foreground/40 uppercase tracking-wider py-1">
                      No matches logged yet
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {myMatches.slice(0, 30).map((m) => {
                        const mySide = m.sides.find((s) =>
                          s.wrestlerIds.includes(wrestlerId!),
                        );
                        const isDraw =
                          m.outcome === "DRAW" || m.outcome === "NO_CONTEST";
                        const isWin = !isDraw && mySide?.id === m.winnerSideId;
                        const opponents = m.sides
                          .filter((s) => s.id !== mySide?.id)
                          .flatMap((s) => s.wrestlerIds)
                          .map((id) => rosterMap.get(id)?.name ?? id)
                          .join(" & ");
                        const outcomeStr = OUTCOME_LABEL[m.outcome] ?? m.outcome;
                        return (
                          <div
                            key={m.id}
                            className="grid grid-cols-[18px_1fr_auto] items-center gap-2 px-2.5 py-2 rounded border border-border/50 hover:border-border bg-muted/5 hover:bg-muted/15 transition-colors"
                          >
                            <span
                              className={cn(
                                "text-[9px] font-bold tracking-widest text-center",
                                isDraw
                                  ? "text-muted-foreground"
                                  : isWin
                                    ? "text-emerald-400"
                                    : "text-red-400",
                              )}
                            >
                              {isDraw ? "D" : isWin ? "W" : "L"}
                            </span>
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium text-foreground/80 truncate">
                                {opponents || "Unknown Opponent"}
                              </div>
                              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider truncate">
                                {m.showName ?? m.eventName ?? formatDate(m.date)}
                                {m.slot ? ` · ${m.slot}` : ""}
                                {" · "}
                                {m.finish ? `${outcomeStr} (${m.finish})` : outcomeStr}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {m.titleId && (
                                <Trophy className="w-3 h-3 text-amber-400" />
                              )}
                              {m.stars && m.stars > 0 ? (
                                <span className="text-[9px] text-amber-400/70 font-bold">
                                  {"★".repeat(Math.min(m.stars, 5))}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                      {myMatches.length > 30 && (
                        <div className="text-center text-[10px] text-muted-foreground/40 uppercase tracking-wider py-1">
                          + {myMatches.length - 30} more matches
                        </div>
                      )}
                    </div>
                  )}
                </ProfileSection>

                {/* Notes */}
                {(wrestler?.notes || wrestler?.creativeNotes) && (
                  <ProfileSection icon={Shield} label="Notes">
                    <div className="space-y-2 text-xs text-muted-foreground/70 leading-relaxed">
                      {wrestler.notes && <p>{wrestler.notes}</p>}
                      {wrestler.creativeNotes && (
                        <p className="text-muted-foreground/50 italic">{wrestler.creativeNotes}</p>
                      )}
                    </div>
                  </ProfileSection>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
