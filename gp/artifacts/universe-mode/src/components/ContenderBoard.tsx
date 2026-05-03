import { useState, useMemo, useCallback } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, X, Plus, ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useRoster, useChampionships, useMatchResults, useRivalries,
  useContenderQueues,
} from "@/lib/storage";
import { computePushScore, TIER_STYLE, type PushTier } from "@/lib/pushScore";
import type { Championship } from "@/lib/storage";
import type { Wrestler } from "@workspace/api-client-react";

const MAX_CONTENDERS = 5;

// ─── Wrestler Search ──────────────────────────────────────────────────────────

function WrestlerSearch({
  roster,
  exclude,
  onSelect,
}: {
  roster: Wrestler[];
  exclude: string[];
  onSelect: (w: Wrestler) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return roster
      .filter((w) => !exclude.includes(w.id))
      .filter((w) => w.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, roster, exclude]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Plus className="w-3 h-3 text-muted-foreground/40 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add contender…"
          className="flex-1 text-[11px] font-bold uppercase tracking-wide bg-transparent text-foreground placeholder:text-muted-foreground/30 focus:outline-none py-1"
          autoComplete="off"
        />
      </div>
      {filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-card shadow-xl overflow-hidden">
          {filtered.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { onSelect(w); setQuery(""); }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-muted/20 transition-colors text-left border-b border-border/30 last:border-0"
            >
              <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 border border-border/40">
                {w.imageUrl ? (
                  <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                ) : (
                  <div className="w-full h-full bg-muted/40 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-muted-foreground/50">{w.name[0]}</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-foreground truncate">{w.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drag Row ─────────────────────────────────────────────────────────────────

function DragRow({
  wrestlerId,
  rank,
  wrestler,
  score,
  tier,
  onRemove,
}: {
  wrestlerId: string;
  rank: number;
  wrestler: Wrestler | undefined;
  score: number;
  tier: PushTier;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const style = TIER_STYLE[tier];
  const name = wrestler?.name ?? wrestlerId;

  return (
    <Reorder.Item
      value={wrestlerId}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2.5 py-2 border-b border-border/30 last:border-0 select-none"
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/20 hover:text-muted-foreground/50 transition-colors shrink-0"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <div className={cn(
        "w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-black",
        rank === 1 ? "bg-amber-400 text-black" : "bg-muted/30 text-muted-foreground"
      )}>
        {rank}
      </div>

      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border/40">
        {wrestler?.imageUrl ? (
          <img src={wrestler.imageUrl} alt={name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full bg-muted/30 flex items-center justify-center">
            <span className="text-[8px] font-bold text-muted-foreground/50">{name[0]}</span>
          </div>
        )}
      </div>

      <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-foreground truncate min-w-0">
        {name}
      </span>

      <div className="flex items-center gap-1.5 shrink-0">
        <div className="flex items-center gap-0.5">
          <div className="w-12 h-1 rounded-full bg-muted/20 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", style.bar)}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn("text-[9px] font-black tabular-nums w-6 text-right", style.text)}>
            {score}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground/20 hover:text-rose-400 transition-colors p-0.5"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ─── Title Card ───────────────────────────────────────────────────────────────

function TitleCard({
  championship,
  contenders,
  onReorder,
  onAdd,
  onRemove,
  roster,
  scoreMap,
}: {
  championship: Championship;
  contenders: string[];
  onReorder: (ids: string[]) => void;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  roster: Wrestler[];
  scoreMap: Map<string, { score: number; tier: PushTier }>;
}) {
  const [expanded, setExpanded] = useState(true);
  const allExcluded = [
    ...(championship.currentChampionIds ?? []),
    ...contenders,
  ];

  const champName = useMemo(() => {
    const ids = championship.currentChampionIds ?? [];
    if (ids.length === 0) return "Vacant";
    return ids
      .map((id) => roster.find((w) => w.id === id)?.name ?? id)
      .join(" & ");
  }, [championship.currentChampionIds, roster]);

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      {/* Title header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-muted/5 hover:bg-muted/10 transition-colors text-left"
      >
        {championship.imageUrl ? (
          <img src={championship.imageUrl} alt={championship.name} className="w-8 h-8 object-contain shrink-0 opacity-90" />
        ) : (
          <div className="w-8 h-8 rounded border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
            <span className="text-xs">🏆</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/70 truncate">
            {championship.name}
          </div>
          <div className="text-xs font-bold uppercase tracking-wide text-foreground/80 truncate mt-0.5">
            {champName}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {contenders.length > 0 && (
            <span className="text-[9px] font-black text-muted-foreground/40 uppercase tracking-widest">
              {contenders.length} in queue
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-3 pt-1">
          {/* Drag-and-drop contenders */}
          {contenders.length > 0 && (
            <Reorder.Group
              axis="y"
              values={contenders}
              onReorder={onReorder}
              className="mb-2"
            >
              {contenders.map((id, i) => {
                const sc = scoreMap.get(id) ?? { score: 50, tier: "MID CARD" as PushTier };
                const wrestler = roster.find((w) => w.id === id);
                return (
                  <DragRow
                    key={id}
                    wrestlerId={id}
                    rank={i + 1}
                    wrestler={wrestler}
                    score={sc.score}
                    tier={sc.tier}
                    onRemove={() => onRemove(id)}
                  />
                );
              })}
            </Reorder.Group>
          )}

          {/* Add contender */}
          {contenders.length < MAX_CONTENDERS && (
            <WrestlerSearch
              roster={roster}
              exclude={allExcluded}
              onSelect={(w) => onAdd(w.id)}
            />
          )}
          {contenders.length === 0 && (
            <div className="text-[9px] text-muted-foreground/30 uppercase tracking-widest mb-2">
              No contenders queued — type a name above to add
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Push Score List ──────────────────────────────────────────────────────────

function PushScoreRow({
  wrestler,
  score,
  tier,
}: {
  wrestler: Wrestler;
  score: number;
  tier: PushTier;
}) {
  const style = TIER_STYLE[tier];
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border/20 last:border-0">
      <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 border border-border/40">
        {wrestler.imageUrl ? (
          <img src={wrestler.imageUrl} alt={wrestler.name} className="w-full h-full object-cover object-top" />
        ) : (
          <div className="w-full h-full bg-muted/30 flex items-center justify-center">
            <span className="text-[8px] font-bold text-muted-foreground/50">{wrestler.name[0]}</span>
          </div>
        )}
      </div>
      <span className="flex-1 text-[11px] font-bold uppercase tracking-wide text-foreground truncate min-w-0">
        {wrestler.name}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border hidden sm:inline",
          style.badge
        )}>
          {tier}
        </span>
        <div className="w-14 h-1.5 rounded-full bg-muted/20 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", style.bar)}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={cn("text-[11px] font-black tabular-nums w-7 text-right", style.text)}>
          {score}
        </span>
      </div>
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function ContenderBoard() {
  const [roster] = useRoster();
  const [championships] = useChampionships();
  const [matchResults] = useMatchResults();
  const [rivalries] = useRivalries();
  const [contenderQueues, setContenderQueues] = useContenderQueues();

  const activeChampionships = useMemo(
    () => championships.filter((c) => c.active !== false),
    [championships],
  );

  const scoreMap = useMemo(() => {
    const map = new Map<string, { score: number; tier: PushTier }>();
    for (const w of roster) {
      const ps = computePushScore(w.id, matchResults, championships, rivalries);
      map.set(w.id, { score: ps.score, tier: ps.tier });
    }
    return map;
  }, [roster, matchResults, championships, rivalries]);

  const sortedRoster = useMemo(() => {
    return [...roster]
      .map((w) => ({ wrestler: w, ...(scoreMap.get(w.id) ?? { score: 50, tier: "MID CARD" as PushTier }) }))
      .sort((a, b) => b.score - a.score);
  }, [roster, scoreMap]);

  const setQueue = useCallback((champId: string, ids: string[]) => {
    setContenderQueues((prev) => ({ ...prev, [champId]: ids }));
  }, [setContenderQueues]);

  const addContender = useCallback((champId: string, wrestlerId: string) => {
    const current = contenderQueues[champId] ?? [];
    if (current.length >= MAX_CONTENDERS || current.includes(wrestlerId)) return;
    setQueue(champId, [...current, wrestlerId]);
  }, [contenderQueues, setQueue]);

  const removeContender = useCallback((champId: string, wrestlerId: string) => {
    const current = contenderQueues[champId] ?? [];
    setQueue(champId, current.filter((id) => id !== wrestlerId));
  }, [contenderQueues, setQueue]);

  const [showAllScores, setShowAllScores] = useState(false);
  const displayedRoster = showAllScores ? sortedRoster : sortedRoster.slice(0, 10);

  return (
    <div className="space-y-6">

      {/* ── Contender Queues ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">Contender Queues</span>
          <div className="flex-1 h-px bg-border/30" />
        </div>
        {activeChampionships.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest text-center py-4">
            No championships configured
          </div>
        ) : (
          <div className="space-y-2">
            {activeChampionships.map((c) => (
              <TitleCard
                key={c.id}
                championship={c}
                contenders={contenderQueues[c.id] ?? []}
                onReorder={(ids) => setQueue(c.id, ids)}
                onAdd={(id) => addContender(c.id, id)}
                onRemove={(id) => removeContender(c.id, id)}
                roster={roster}
                scoreMap={scoreMap}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Push Scores ── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-[9px] font-bold tracking-[0.3em] uppercase text-muted-foreground/50">Push Scores</span>
          <div className="flex-1 h-px bg-border/30" />
          <div className="flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-muted-foreground/30">
            {(["MAIN EVENT", "UPPER CARD", "MID CARD", "LOWER CARD"] as PushTier[]).map((t) => (
              <span key={t} className={cn("hidden sm:inline", TIER_STYLE[t].text)}>{t.split(" ")[0]}</span>
            ))}
          </div>
        </div>
        {roster.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/40 uppercase tracking-widest text-center py-4">
            No roster — add wrestlers to see push scores
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden px-4">
            {displayedRoster.map(({ wrestler, score, tier }) => (
              <PushScoreRow key={wrestler.id} wrestler={wrestler} score={score} tier={tier} />
            ))}
            {sortedRoster.length > 10 && (
              <button
                type="button"
                onClick={() => setShowAllScores((v) => !v)}
                className="w-full py-2 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                {showAllScores ? "Show Less" : `Show All ${sortedRoster.length} Wrestlers`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
