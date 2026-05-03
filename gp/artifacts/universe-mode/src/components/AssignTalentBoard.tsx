import { useMemo, useState } from "react";
import { useRoster, useShows, useChampionLookup } from "@/lib/storage";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { WrestlerBrand, WrestlerStatus, type Wrestler, type Show } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Search, X, CheckSquare, Square, User, ArrowLeft, Users, Tv } from "lucide-react";
import rawBg from "@assets/raw-2002-06_1777487992501.jpg";
import smackdownBg from "@assets/smackdown-2005-06_1777488510139.jpg";
import performanceCenterBg from "@assets/WWE_Performance_Center_2015_1777587013538.webp";

const SHOW_BRAND_MAP: Record<string, WrestlerBrand> = {
  raw: WrestlerBrand.RAW,
  smackdown: WrestlerBrand.SMACKDOWN,
};

type QuickFilter = "ALL" | "UNASSIGNED" | "CHAMPIONS" | "INACTIVE";

interface ShowSlot {
  id: string;
  name: string;
  shortName: string;
  bgImage: string;
  accentColor: string;
  borderColor: string;
  textClass: string;
}

function buildShowSlots(shows: Show[]): ShowSlot[] {
  const slots: ShowSlot[] = shows.map(s => {
    const isRaw = s.id === "raw";
    const isSd = s.id === "smackdown";
    return {
      id: s.id,
      name: s.name,
      shortName: s.name
        .replace("Monday Night ", "")
        .replace("Friday Night ", "")
        .replace("Saturday Night's ", ""),
      bgImage: isRaw ? rawBg : isSd ? smackdownBg : (s.imageUrl ?? ""),
      accentColor: isRaw ? "#dc1e1e" : isSd ? "#1d4ed8" : "#555",
      borderColor: isRaw ? "border-[#dc1e1e]" : isSd ? "border-[#1d4ed8]" : "border-border",
      textClass: isRaw ? "text-[#dc1e1e]" : isSd ? "text-[#1d4ed8]" : "text-muted-foreground",
    };
  });
  slots.push({
    id: "FREE",
    name: "Performance Center",
    shortName: "Free Agent",
    bgImage: performanceCenterBg,
    accentColor: "#6b7280",
    borderColor: "border-zinc-500",
    textClass: "text-zinc-400",
  });
  return slots;
}

function getTargetBrand(showId: string): WrestlerBrand {
  if (showId === "FREE") return WrestlerBrand.FREE_AGENT;
  return SHOW_BRAND_MAP[showId] ?? WrestlerBrand.FREE_AGENT;
}

interface AssignTalentBoardProps {
  onClose: () => void;
}

export function AssignTalentBoard({ onClose }: AssignTalentBoardProps) {
  const [roster, setRoster] = useRoster();
  const [shows] = useShows();
  const champLookup = useChampionLookup();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");

  const showSlots = useMemo(() => buildShowSlots(shows), [shows]);

  const champIds = useMemo(() => {
    const s = new Set<string>();
    for (const [id, champs] of champLookup.entries()) {
      if (champs.length > 0) s.add(id);
    }
    return s;
  }, [champLookup]);

  const wrestlerCountBySlot = useMemo(() => {
    const m = new Map<string, number>();
    showSlots.forEach(slot => m.set(slot.id, 0));
    for (const w of roster) {
      const sid = w.showId ?? "FREE";
      m.set(sid, (m.get(sid) ?? 0) + 1);
    }
    return m;
  }, [roster, showSlots]);

  const filteredRoster = useMemo(() => {
    return roster.filter(w => {
      if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (quickFilter === "UNASSIGNED") {
        return !w.showId && (!w.brand || w.brand === WrestlerBrand.FREE_AGENT);
      }
      if (quickFilter === "CHAMPIONS") return champIds.has(w.id);
      if (quickFilter === "INACTIVE") {
        return w.status === WrestlerStatus.INACTIVE || w.status === WrestlerStatus.INJURED;
      }
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [roster, search, quickFilter, champIds]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(filteredRoster.map(w => w.id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function assignTo(showId: string, ids?: string[]) {
    const targetIds = ids ?? [...selected];
    if (targetIds.length === 0) {
      toast.error("Select wrestlers first");
      return;
    }
    const brand = getTargetBrand(showId);
    setRoster(prev => prev.map(w =>
      targetIds.includes(w.id)
        ? { ...w, showId: showId === "FREE" ? undefined : showId, brand }
        : w
    ));
    setSelected(new Set());
    const slot = showSlots.find(s => s.id === showId);
    toast.success(`${targetIds.length} ${targetIds.length === 1 ? "superstar" : "superstars"} assigned to ${slot?.shortName ?? showId}`);
  }

  const hasSelection = selected.size > 0;
  const allFilteredSelected = filteredRoster.length > 0 && filteredRoster.every(w => selected.has(w.id));

  const FILTER_LABELS: Record<QuickFilter, string> = {
    ALL: "All",
    UNASSIGNED: "Unassigned",
    CHAMPIONS: "Champions",
    INACTIVE: "Inactive",
  };

  if (roster.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center p-12">
        <button
          type="button"
          onClick={onClose}
          className="self-start flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold tracking-widest uppercase">Back to Roster</span>
        </button>
        <Users className="w-16 h-16 text-muted-foreground/20" strokeWidth={1} />
        <p className="text-muted-foreground max-w-xs">No superstars on the roster yet. Add talent first to start assigning them to shows.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1 relative">

      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-bold tracking-widest uppercase">Back</span>
        </button>
        <div className="h-4 w-px bg-border shrink-0" />
        <h2 className="text-xl font-display font-bold uppercase tracking-widest text-foreground">Assign Talent</h2>
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground bg-muted/40 px-2 py-1 rounded">
          {roster.length} superstars
        </span>
        {hasSelection && (
          <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-1 rounded bg-foreground text-background ml-auto">
            {selected.size} selected
          </span>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-hide">
        {showSlots.map(slot => {
          const count = wrestlerCountBySlot.get(slot.id) ?? 0;
          return (
            <button
              key={slot.id}
              type="button"
              onClick={() => assignTo(slot.id)}
              disabled={!hasSelection}
              className={cn(
                "relative shrink-0 min-w-[110px] sm:min-w-[130px] rounded-xl border-2 overflow-hidden transition-all text-left",
                hasSelection
                  ? cn("cursor-pointer hover:scale-[1.02] hover:shadow-xl", slot.borderColor)
                  : "border-border/50 cursor-default opacity-60"
              )}
            >
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: slot.bgImage
                    ? `linear-gradient(160deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.80) 100%), url(${slot.bgImage})`
                    : "linear-gradient(160deg, rgba(30,30,30,0.9) 0%, rgba(10,10,10,0.95) 100%)",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
              <div className="relative p-3 sm:p-4">
                <div
                  className="w-8 h-0.5 mb-2 rounded-full"
                  style={{ backgroundColor: slot.accentColor }}
                />
                <div className="text-xs font-display font-bold uppercase tracking-wide text-white leading-tight">
                  {slot.shortName}
                </div>
                <div className="text-[10px] text-white/50 mt-1.5 font-bold tabular-nums">
                  {count} {count === 1 ? "superstar" : "superstars"}
                </div>
                {hasSelection && (
                  <div
                    className="mt-2 text-[9px] font-bold tracking-widest uppercase"
                    style={{ color: slot.accentColor }}
                  >
                    ASSIGN →
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search talent..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-hide shrink-0">
          {(Object.keys(FILTER_LABELS) as QuickFilter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setQuickFilter(f)}
              className={cn(
                "shrink-0 px-3 py-1.5 rounded text-[10px] font-bold tracking-wider uppercase transition-colors border whitespace-nowrap h-9",
                quickFilter === f
                  ? "bg-foreground text-background border-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-muted/20"
              )}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
          {filteredRoster.length} {filteredRoster.length === 1 ? "superstar" : "superstars"}
        </span>
        <button
          type="button"
          onClick={allFilteredSelected ? clearSelection : selectAll}
          className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors"
        >
          {allFilteredSelected
            ? <><CheckSquare className="w-3.5 h-3.5" /> Deselect All</>
            : <><Square className="w-3.5 h-3.5" /> Select All</>
          }
        </button>
      </div>

      {filteredRoster.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
          <Tv className="w-10 h-10 text-muted-foreground/20" strokeWidth={1} />
          <p className="text-sm text-muted-foreground">No talent matches your filters.</p>
        </div>
      ) : (
        <div className={cn("overflow-y-auto", hasSelection ? "pb-28" : "pb-4")}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredRoster.map(w => {
              const isSelected = selected.has(w.id);
              const currentShow = shows.find(s => s.id === w.showId);
              const champs = champLookup.get(w.id) ?? [];
              const isFreeAgent = !w.showId && (!w.brand || w.brand === WrestlerBrand.FREE_AGENT);

              return (
                <ContextMenu key={w.id}>
                  <ContextMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleSelect(w.id)}
                      className={cn(
                        "relative flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left w-full group",
                        isSelected
                          ? "border-foreground bg-foreground/8 shadow-md"
                          : "border-border hover:border-foreground/40 bg-card"
                      )}
                    >
                      <div className="absolute top-2.5 right-2.5 shrink-0">
                        {isSelected
                          ? <CheckSquare className="w-4 h-4 text-foreground" />
                          : <Square className="w-4 h-4 text-muted-foreground/25 group-hover:text-muted-foreground/50 transition-colors" />
                        }
                      </div>

                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-muted/40 border border-border">
                          {w.imageUrl
                            ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-center" />
                            : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground/40" /></div>
                          }
                        </div>
                        <ChampionBeltOverlay championships={champs} size="sm" />
                      </div>

                      <div className="flex-1 min-w-0 pr-5">
                        <div className="font-display font-bold text-sm uppercase tracking-wide text-foreground truncate leading-tight">
                          {w.name}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currentShow ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30 truncate max-w-[100px]">
                              {currentShow.name.replace("Monday Night ", "").replace("Friday Night ", "")}
                            </span>
                          ) : isFreeAgent ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-zinc-600/60 text-zinc-500 bg-zinc-800/30">
                              Free Agent
                            </span>
                          ) : null}
                          {w.role && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border/60 text-muted-foreground/50">
                              {w.role.replace(/_/g, " ")}
                            </span>
                          )}
                          {w.status && w.status !== WrestlerStatus.ACTIVE && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border/60 text-muted-foreground/40">
                              {w.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-56">
                    <ContextMenuLabel className="text-foreground/70 font-display uppercase tracking-widest">{w.name}</ContextMenuLabel>
                    <ContextMenuSeparator />
                    <ContextMenuLabel className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60 py-0.5">
                      Assign to
                    </ContextMenuLabel>
                    {showSlots.map(slot => (
                      <ContextMenuItem
                        key={slot.id}
                        onClick={() => assignTo(slot.id, [w.id])}
                        className="gap-2 cursor-pointer"
                      >
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: slot.accentColor }}
                        />
                        {slot.shortName}
                        {(w.showId === slot.id || (slot.id === "FREE" && !w.showId)) && (
                          <span className="ml-auto text-[9px] text-muted-foreground/50 font-bold uppercase tracking-wider">current</span>
                        )}
                      </ContextMenuItem>
                    ))}
                    {selected.size > 1 && selected.has(w.id) && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuLabel className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/60 py-0.5">
                          Or assign all {selected.size} selected
                        </ContextMenuLabel>
                        {showSlots.map(slot => (
                          <ContextMenuItem
                            key={`bulk-${slot.id}`}
                            onClick={() => assignTo(slot.id)}
                            className="gap-2 cursor-pointer"
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: slot.accentColor }}
                            />
                            All {selected.size} → {slot.shortName}
                          </ContextMenuItem>
                        ))}
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </div>
        </div>
      )}

      {hasSelection && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-foreground/20 bg-card/95 backdrop-blur-md shadow-2xl">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold tracking-widest uppercase text-foreground">
                {selected.size} {selected.size === 1 ? "superstar" : "superstars"} selected
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="ml-auto text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {showSlots.map(slot => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => assignTo(slot.id)}
                  className={cn(
                    "shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-bold tracking-wider uppercase transition-all whitespace-nowrap",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    slot.borderColor
                  )}
                  style={{ borderColor: slot.accentColor, color: slot.accentColor }}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: slot.accentColor }}
                  />
                  {slot.shortName}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
