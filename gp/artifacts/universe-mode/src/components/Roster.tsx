import { Fragment, useEffect, useMemo, useRef, useState, type ChangeEvent, type ComponentType, type MouseEvent, type ReactNode } from "react";
import { AssignTalentBoard } from "@/components/AssignTalentBoard";
import { useRoster, useShows, useChampionships, useStables, useChampionLookup, useUniverseDate, useMatchResults, type Championship, type Stable } from "@/lib/storage";
import { WrestlerProfile } from "@/components/WrestlerProfile";
import { MatchLogger } from "@/components/MatchLogger";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";
import { SEED_ROSTER, inferGender } from "@/lib/seedRoster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search, Plus, Trash2, Edit2, ShieldAlert, User, Upload, X,
  LayoutGrid, List as ListIcon, CheckSquare, Square, Users,
  Trophy, Tag, Camera, Star, MoreHorizontal, ImagePlus, ToggleLeft,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu, ContextMenuContent, ContextMenuItem,
  ContextMenuLabel, ContextMenuSeparator, ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  WrestlerBrand, WrestlerAlignment, WrestlerStatus, WrestlerRole,
  type Wrestler, type Show,
} from "@workspace/api-client-react";
import { toast } from "sonner";
import wweLogo from "@assets/wwe-logo-image-png-18_1777487875845.png";
import smackdownBg from "@assets/smackdown-2005-06_1777488510139.jpg";
import rawBg from "@assets/raw-2002-06_1777487992501.jpg";
import performanceCenterBg from "@assets/WWE_Performance_Center_2015_1777587013538.webp";

const NO_SHOW = "__none__";
const NO_MEMBER = "__none__";

const SHOW_BRAND_MAP: Record<string, WrestlerBrand> = {
  raw: WrestlerBrand.RAW,
  smackdown: WrestlerBrand.SMACKDOWN,
};

const BRAND_SHOW_MAP: Partial<Record<WrestlerBrand, string>> = {
  [WrestlerBrand.RAW]: "raw",
  [WrestlerBrand.SMACKDOWN]: "smackdown",
};

function deriveShowId(w: Wrestler): string {
  if (w.showId) return w.showId;
  if (w.brand && BRAND_SHOW_MAP[w.brand]) return BRAND_SHOW_MAP[w.brand]!;
  return NO_SHOW;
}

type ShowFilter = "ALL" | "FREE" | string;
type GenderFilter = "ALL" | "M" | "F";
type ViewMode = "cards" | "list";
type RosterSection = "wrestlers" | "stables";

type BrandTheme = { frameStyle: React.CSSProperties; ring: string; label: string };

const BRAND_THEME: Record<string, BrandTheme> = {
  RAW: {
    frameStyle: {
      backgroundImage: ["linear-gradient(180deg, rgba(160,15,15,0.35) 0%, rgba(60,0,0,0.65) 100%)", `url(${rawBg})`].join(","),
      backgroundSize: "cover, cover", backgroundPosition: "center, center", backgroundRepeat: "no-repeat, no-repeat",
    },
    ring: "ring-[#dc1e1e]/70",
    label: "text-white border-[#dc1e1e] bg-[#dc1e1e]",
  },
  SMACKDOWN: {
    frameStyle: {
      backgroundImage: ["linear-gradient(180deg, rgba(20,90,200,0.25) 0%, rgba(8,20,80,0.55) 100%)", `url(${smackdownBg})`].join(","),
      backgroundSize: "cover, cover", backgroundPosition: "center, center", backgroundRepeat: "no-repeat, no-repeat",
    },
    ring: "ring-[#1d4ed8]/70",
    label: "text-white border-[#1d4ed8] bg-[#1d4ed8]",
  },
  NXT: {
    frameStyle: {
      backgroundImage: [
        "radial-gradient(ellipse at 30% 20%, rgba(255,235,160,0.55), transparent 55%)",
        "radial-gradient(ellipse at 75% 80%, rgba(80,55,0,0.7), transparent 60%)",
        "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 9px)",
        "linear-gradient(180deg, #d4a017 0%, #6d4f06 100%)",
      ].join(","),
    },
    ring: "ring-[#eab308]/70",
    label: "text-black border-[#eab308] bg-[#eab308]",
  },
  FREE_AGENT: {
    frameStyle: {
      backgroundImage: ["linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.75) 100%)", `url(${performanceCenterBg})`].join(","),
      backgroundSize: "cover, cover", backgroundPosition: "center, center", backgroundRepeat: "no-repeat, no-repeat",
    },
    ring: "ring-zinc-400/60",
    label: "text-white border-zinc-400 bg-zinc-600",
  },
};

function brandTheme(brand: string | undefined): BrandTheme {
  return BRAND_THEME[brand ?? "FREE_AGENT"] ?? BRAND_THEME.FREE_AGENT;
}
function brandLabel(brand: string | undefined): string {
  if (!brand || brand === WrestlerBrand.FREE_AGENT) return "Performance Center";
  return brand.replace(/_/g, " ");
}
function showFrameStyle(show: Show): React.CSSProperties {
  return {
    backgroundImage: ["linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.65) 100%)", `url(${show.imageUrl})`].join(","),
    backgroundSize: "cover, cover", backgroundPosition: "center, center", backgroundRepeat: "no-repeat, no-repeat",
  };
}

function roleLabel(role: string | undefined): string {
  if (!role) return "";
  return role.replace(/_/g, " ");
}

function StatusBadge({ status }: { status: string | undefined }) {
  if (!status || status === WrestlerStatus.ACTIVE) return null;
  return (
    <span className={cn(
      "text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border",
      status === WrestlerStatus.INJURED
        ? "border-dashed border-foreground/40 text-foreground/60"
        : status === WrestlerStatus.INACTIVE
        ? "border-border text-muted-foreground/50 opacity-60"
        : "border-foreground bg-foreground text-background"
    )}>
      {status}
    </span>
  );
}

function RoleBadge({ role }: { role: string | undefined }) {
  if (!role) return null;
  const isTop = role === WrestlerRole.MAIN_EVENTER;
  return (
    <span className={cn(
      "text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border",
      isTop ? "border-foreground/60 text-foreground" : "border-border text-muted-foreground/60"
    )}>
      {roleLabel(role)}
    </span>
  );
}

export function Roster() {
  const [section, setSection] = useState<RosterSection>("wrestlers");
  const [roster] = useRoster();
  const [stables] = useStables();

  const sectionCounts: Record<RosterSection, number> = {
    wrestlers: roster.length,
    stables: stables.length,
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Roster</h1>
          <p className="text-muted-foreground mt-1">Superstars, stables, and talent assignments.</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 bg-muted/20 rounded-xl border border-border p-1 w-fit">
        {(["wrestlers", "stables"] as RosterSection[]).map(s => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2",
              section === s
                ? "bg-foreground text-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "wrestlers" && <Users className="w-3.5 h-3.5" />}
            {s === "stables" && <Tag className="w-3.5 h-3.5" />}
            {s}
            {sectionCounts[s] > 0 && (
              <span className={cn(
                "min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[9px] font-bold",
                section === s ? "bg-background/20 text-background" : "bg-foreground/10 text-foreground"
              )}>
                {sectionCounts[s]}
              </span>
            )}
          </button>
        ))}
      </div>

      {section === "wrestlers" && <WrestlersSection />}
      {section === "stables" && <StablesSection />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WRESTLERS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function WrestlersSection() {
  const [roster, setRoster] = useRoster();
  const [shows] = useShows();
  const [search, setSearch] = useState("");
  const [showFilter, setShowFilter] = useState<ShowFilter>("ALL");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("ALL");
  const [view, setView] = useState<ViewMode>("cards");
  const [editingWrestler, setEditingWrestler] = useState<Wrestler | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  const quickPhotoRef = useRef<HTMLInputElement>(null);
  const champLookup = useChampionLookup();
  const [showAssignBoard, setShowAssignBoard] = useState(false);
  const [profileWrestlerId, setProfileWrestlerId] = useState<string | null>(null);
  const [matchLoggerOpen, setMatchLoggerOpen] = useState(false);
  const [date] = useUniverseDate();

  useEffect(() => {
    if (selected.size === 0) return;
    const valid = new Set(roster.map(w => w.id));
    let changed = false;
    const next = new Set<string>();
    for (const id of selected) {
      if (valid.has(id)) next.add(id);
      else changed = true;
    }
    if (changed) setSelected(next);
  }, [roster, selected]);

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };
  const toggleSelected = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const showsById = useMemo(() => {
    const m = new Map<string, Show>();
    shows.forEach(s => m.set(s.id, s));
    return m;
  }, [shows]);

  const filteredRoster = roster.filter(w => {
    const matchesSearch = w.name.toLowerCase().includes(search.toLowerCase());
    let matchesShow = true;
    if (showFilter === "FREE") {
      matchesShow = !w.showId && (!w.brand || w.brand === WrestlerBrand.FREE_AGENT);
    } else if (showFilter !== "ALL") {
      const expectedBrand = SHOW_BRAND_MAP[showFilter];
      matchesShow = w.showId === showFilter || (!w.showId && expectedBrand !== undefined && w.brand === expectedBrand);
    }
    const matchesGender = genderFilter === "ALL" || inferGender(w.name) === genderFilter;
    return matchesSearch && matchesShow && matchesGender;
  }).sort((a, b) => a.name.localeCompare(b.name));

  const handleSave = (w: Wrestler) => {
    if (editingWrestler && roster.some(rw => rw.id === editingWrestler.id)) {
      setRoster(roster.map(rw => rw.id === editingWrestler.id ? w : rw));
      toast.success("Superstar updated");
    } else {
      if (roster.some(rw => rw.name.toLowerCase() === w.name.toLowerCase())) {
        toast.error("Superstar already exists"); return;
      }
      setRoster([...roster, w]);
      toast.success("Superstar added");
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Remove superstar from roster?")) {
      setRoster(roster.filter(w => w.id !== id));
      toast.success("Superstar removed");
    }
  };

  const handleQuickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTargetId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image is too large (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const url = reader.result;
      setRoster(r => r.map(w => w.id === photoTargetId ? { ...w, imageUrl: url } : w));
      toast.success("Photo updated");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setPhotoTargetId(null);
  };

  const quickStart = () => { setRoster(SEED_ROSTER); toast.success("Seed roster loaded!"); };

  const allVisibleSelected = filteredRoster.length > 0 && filteredRoster.every(w => selected.has(w.id));
  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelected(prev => { const next = new Set(prev); for (const w of filteredRoster) next.delete(w.id); return next; });
    } else {
      setSelected(prev => { const next = new Set(prev); for (const w of filteredRoster) next.add(w.id); return next; });
    }
  };

  const bulkAssignToShow = (targetShowId: string | null) => {
    if (selected.size === 0) return;
    const targetBrand: WrestlerBrand = targetShowId === null ? WrestlerBrand.FREE_AGENT : (SHOW_BRAND_MAP[targetShowId] ?? WrestlerBrand.FREE_AGENT);
    setRoster(roster.map(w => selected.has(w.id) ? { ...w, brand: targetBrand, showId: targetShowId ?? undefined } : w));
    const label = targetShowId === null ? "Performance Center" : (showsById.get(targetShowId)?.name.replace("Monday Night ", "").replace("Friday Night ", "") ?? targetShowId);
    toast.success(`Moved ${selected.size} ${selected.size === 1 ? "superstar" : "superstars"} to ${label}`);
    exitSelectMode();
  };

  const bulkDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Remove ${selected.size} ${selected.size === 1 ? "superstar" : "superstars"} from the roster?`)) return;
    setRoster(roster.filter(w => !selected.has(w.id)));
    toast.success(`Removed ${selected.size} ${selected.size === 1 ? "superstar" : "superstars"}`);
    exitSelectMode();
  };

  if (showAssignBoard) {
    return <AssignTalentBoard onClose={() => setShowAssignBoard(false)} />;
  }

  return (
    <>
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant={selectMode ? "default" : "outline"}
            onClick={() => { if (selectMode) exitSelectMode(); else setSelectMode(true); }}
            className={cn("font-bold tracking-wider uppercase", selectMode && "bg-foreground hover:bg-foreground/90 text-background")}
            disabled={roster.length === 0}
            title={roster.length === 0 ? "Add superstars to your roster first" : undefined}
          >
            <Users className="w-4 h-4 mr-2" /> {selectMode ? "Done" : "Select"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowAssignBoard(true)}
            className="font-bold tracking-wider uppercase"
            disabled={roster.length === 0}
            title={roster.length === 0 ? "Add superstars to your roster first" : undefined}
          >
            Assign Talent
          </Button>
        </div>
        <Button
          onClick={() => { setEditingWrestler(null); setIsDialogOpen(true); }}
          className="bg-foreground hover:bg-foreground/90 text-background font-bold tracking-wider uppercase"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Superstar
        </Button>
      </div>

      {selectMode && (
        <div className="mb-4 bg-card border border-foreground/30 rounded-xl p-3 flex flex-col gap-2 shadow-sm sticky top-0 z-30 backdrop-blur-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleSelectAllVisible}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase border border-border hover:border-foreground/50 transition-colors"
            >
              {allVisibleSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
              {allVisibleSelected ? "Deselect visible" : "Select all"}
            </button>
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{selected.size} selected</span>
            <button type="button" onClick={bulkDelete} disabled={selected.size === 0}
              className="ml-auto px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase border-2 border-destructive/60 text-destructive hover:bg-destructive hover:text-destructive-foreground disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mr-1">Move to</span>
            {shows.map(s => (
              <button key={s.id} type="button" onClick={() => bulkAssignToShow(s.id)} disabled={selected.size === 0}
                className={cn("px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase border-2 transition-colors",
                  s.id === "raw" ? "border-[#dc1e1e] text-white bg-[#dc1e1e] hover:bg-[#b51717] disabled:opacity-40 disabled:cursor-not-allowed"
                    : s.id === "smackdown" ? "border-[#1d4ed8] text-white bg-[#1d4ed8] hover:bg-[#173db0] disabled:opacity-40 disabled:cursor-not-allowed"
                    : "border-border text-foreground bg-muted/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed")}>
                {s.name.replace("Monday Night ", "").replace("Friday Night ", "")}
              </button>
            ))}
            <button type="button" onClick={() => bulkAssignToShow(null)} disabled={selected.size === 0}
              className="px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase border-2 border-border text-foreground bg-muted/40 hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
              Perf. Center
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search roster..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-background/50 border-border" />
          </div>
          <div className="flex p-1 bg-muted/30 rounded-md border border-border w-max shrink-0">
            <button onClick={() => setView("cards")} className={cn("px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5", view === "cards" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <LayoutGrid className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setView("list")} className={cn("px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition-colors flex items-center gap-1.5", view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              <ListIcon className="w-3.5 h-3.5" /> List
            </button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          <button onClick={() => setShowFilter("ALL")} className={cn("px-4 h-12 rounded-lg text-xs font-bold tracking-wider uppercase whitespace-nowrap transition-all border-2 shrink-0", showFilter === "ALL" ? "bg-foreground text-background border-foreground" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30")}>
            All
          </button>
          {shows.map(s => (
            <button key={s.id} onClick={() => setShowFilter(s.id)}
              className={cn("relative h-12 w-28 sm:w-36 rounded-lg overflow-hidden whitespace-nowrap transition-all border-2 shrink-0", showFilter === s.id ? "border-foreground ring-2 ring-foreground/40" : "border-border hover:border-foreground/40")}
              style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.20) 100%), url(${s.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
          ))}
          <button onClick={() => setShowFilter("FREE")}
            className={cn("relative h-12 w-28 sm:w-36 rounded-lg overflow-hidden whitespace-nowrap transition-all border-2 shrink-0", showFilter === "FREE" ? "border-foreground ring-2 ring-foreground/40" : "border-border hover:border-foreground/40")}
            style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.20) 100%), url(${performanceCenterBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mr-1">Division</span>
          {(["ALL", "M", "F"] as GenderFilter[]).map(g => (
            <button key={g} onClick={() => setGenderFilter(g)}
              className={cn("px-3 py-1.5 rounded text-xs font-bold tracking-wider uppercase transition-colors border", genderFilter === g ? "bg-foreground text-background border-foreground" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:border-foreground/30")}>
              {g === "ALL" ? "All" : g === "M" ? "Men" : "Women"}
            </button>
          ))}
          <span className="ml-auto text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
            {filteredRoster.length} / {roster.length}
          </span>
        </div>
      </div>

      {roster.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card border-dashed">
          <ShieldAlert className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-display uppercase tracking-widest text-foreground mb-2">No Superstars</h3>
          <p className="text-muted-foreground max-w-md mb-6">Your roster is empty. Head to the Creative Desk to start booking, but you'll need some talent first.</p>
          <Button onClick={quickStart} variant="outline" className="border-foreground text-foreground hover:bg-foreground/5">
            QUICK START: ADD WWE ROSTER
          </Button>
        </div>
      ) : view === "list" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className={cn("grid gap-2 sm:gap-4 px-3 sm:px-4 py-2 border-b border-border bg-muted/20 text-[10px] font-bold tracking-widest uppercase text-muted-foreground",
            selectMode
              ? "grid-cols-[28px_1fr_auto_auto_auto_auto] sm:grid-cols-[28px_1fr_140px_100px_90px_90px_50px]"
              : "grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[1fr_140px_100px_90px_90px_50px]"
          )}>
            {selectMode && <span></span>}
            <span>Name</span>
            <span className="hidden sm:block">Show</span>
            <span className="hidden sm:block">Role</span>
            <span>Align</span>
            <span>Div</span>
            <span className="w-12 sm:w-12 text-right pr-1"></span>
          </div>
          {filteredRoster.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No superstars match your filters.</div>
          ) : filteredRoster.map(w => {
            const show = w.showId ? showsById.get(w.showId) : undefined;
            const theme = brandTheme(w.brand);
            const gender = inferGender(w.name);
            const isSelected = selected.has(w.id);
            const rowActions: CardMenuAction[] = [
              { label: "View Profile", icon: <User />, action: () => setProfileWrestlerId(w.id) },
              { label: "Edit Talent Profile", icon: <Edit2 />, action: () => { setEditingWrestler(w); setIsDialogOpen(true); } },
              { label: "Change Photo", icon: <ImagePlus />, action: () => { setPhotoTargetId(w.id); quickPhotoRef.current?.click(); } },
              { label: w.status === "INACTIVE" ? "Set Active" : "Set Inactive", icon: <ToggleLeft />, action: () => {
                const next = w.status === "INACTIVE" ? undefined : "INACTIVE" as WrestlerStatus;
                setRoster(r => r.map(x => x.id === w.id ? { ...x, status: next } : x));
                toast.success(next ? "Marked inactive" : "Marked active");
              }},
              { label: "Delete Wrestler", icon: <Trash2 />, action: () => handleDelete(w.id), destructive: true, separator: true },
            ];
            return (
              <ContextMenu key={w.id}>
                <ContextMenuTrigger asChild>
                  <div
                    onClick={selectMode ? () => toggleSelected(w.id) : () => setProfileWrestlerId(w.id)}
                    className={cn("group grid gap-2 sm:gap-4 px-3 sm:px-4 py-2.5 items-center border-b border-border last:border-b-0 transition-colors",
                      selectMode
                        ? cn("grid-cols-[28px_1fr_auto_auto_auto_auto] sm:grid-cols-[28px_1fr_140px_100px_90px_90px_50px] cursor-pointer", isSelected ? "bg-foreground/10 hover:bg-foreground/15" : "hover:bg-muted/20")
                        : "grid-cols-[1fr_auto_auto_auto_auto] sm:grid-cols-[1fr_140px_100px_90px_90px_50px] hover:bg-muted/20 cursor-pointer"
                    )}
                  >
                    {selectMode && (
                      <span className="flex items-center justify-center text-foreground">
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-muted-foreground" />}
                      </span>
                    )}
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="font-display font-bold text-sm sm:text-base uppercase tracking-wide text-foreground truncate">{w.name}</span>
                      <StatusBadge status={w.status} />
                    </span>
                    <span className={cn("hidden sm:inline-flex w-fit text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border", theme.label)}>
                      {show ? show.name.replace("Monday Night ", "").replace("Friday Night ", "") : brandLabel(w.brand)}
                    </span>
                    <span className="hidden sm:block"><RoleBadge role={w.role} /></span>
                    <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">{w.alignment ?? "—"}</span>
                    <span className={cn("text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded w-fit border",
                      gender === "F" ? "border-pink-500/40 text-pink-300 bg-pink-500/10" : "border-sky-500/40 text-sky-300 bg-sky-500/10")}>
                      {gender}
                    </span>
                    {!selectMode && (
                      <span className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button onClick={e => e.stopPropagation()} className="p-1.5 rounded border border-transparent hover:border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 sm:[@media(hover:none)]:opacity-100" aria-label={`Actions for ${w.name}`}>
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-foreground/70">{w.name}</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {rowActions.map((a, i) => (
                              <Fragment key={i}>
                                {a.separator && <DropdownMenuSeparator />}
                                <DropdownMenuItem onClick={e => { e.stopPropagation(); a.action(); }} className={cn("gap-2 cursor-pointer", a.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10")}>
                                  {a.icon}{a.label}
                                </DropdownMenuItem>
                              </Fragment>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    )}
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuLabel className="text-foreground/70">{w.name}</ContextMenuLabel>
                  <ContextMenuSeparator />
                  {rowActions.map((a, i) => (
                    <Fragment key={i}>
                      {a.separator && <ContextMenuSeparator />}
                      <ContextMenuItem onClick={a.action} className={cn("gap-2 cursor-pointer", a.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10")}>
                        {a.icon}{a.label}
                      </ContextMenuItem>
                    </Fragment>
                  ))}
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-max">
          {filteredRoster.map(w => {
            const theme = brandTheme(w.brand);
            const show = w.showId ? showsById.get(w.showId) : undefined;
            const frameStyle = show?.imageUrl ? showFrameStyle(show) : theme.frameStyle;
            const isSelected = selected.has(w.id);
            const cardActions: CardMenuAction[] = [
              { label: "View Profile", icon: <User />, action: () => setProfileWrestlerId(w.id) },
              { label: "Edit Talent Profile", icon: <Edit2 />, action: () => { setEditingWrestler(w); setIsDialogOpen(true); } },
              { label: "Change Photo", icon: <ImagePlus />, action: () => { setPhotoTargetId(w.id); quickPhotoRef.current?.click(); } },
              { label: w.status === "INACTIVE" ? "Set Active" : "Set Inactive", icon: <ToggleLeft />, action: () => {
                const next = w.status === "INACTIVE" ? undefined : "INACTIVE" as WrestlerStatus;
                setRoster(r => r.map(x => x.id === w.id ? { ...x, status: next } : x));
                toast.success(next ? "Marked inactive" : "Marked active");
              }},
              { label: "Delete Wrestler", icon: <Trash2 />, action: () => handleDelete(w.id), destructive: true, separator: true },
            ];
            const cardContent = (
              <div
                onClick={selectMode ? () => toggleSelected(w.id) : () => setProfileWrestlerId(w.id)}
                className={cn("bg-card border rounded-xl transition-all relative flex flex-col",
                  selectMode
                    ? cn("cursor-pointer", isSelected ? "border-foreground ring-2 ring-foreground shadow-lg" : "border-border hover:border-foreground/40")
                    : `border-border hover:shadow-lg hover:ring-2 ${theme.ring} cursor-pointer`
                )}
              >
                <img src={wweLogo} alt="WWE" className="absolute top-2 left-2 w-10 h-10 z-30 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] pointer-events-none select-none" />
                {selectMode && (
                  <div className="absolute top-2 right-2 z-30 pointer-events-none">
                    <div className={cn("w-7 h-7 rounded-md flex items-center justify-center border-2 backdrop-blur-sm", isSelected ? "bg-foreground border-foreground text-background" : "bg-background/80 border-border text-muted-foreground")}>
                      {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>
                  </div>
                )}
                <div className="relative aspect-square w-full p-4 sm:p-5 flex items-center justify-center overflow-hidden rounded-t-xl" style={frameStyle}>
                  <div className="relative w-full h-full" style={{ filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.75))' }}>
                    <div className="w-full h-full p-[4px]"
                      style={{ clipPath: 'polygon(11px 0%,calc(100% - 11px) 0%,100% 11px,100% calc(100% - 11px),calc(100% - 11px) 100%,11px 100%,0% calc(100% - 11px),0% 11px)', background: 'linear-gradient(145deg,#e6e6e6 0%,#a4a4a4 18%,#efefef 34%,#b8b8b8 50%,#7e7e7e 66%,#cccccc 82%,#9a9a9a 100%)' }}>
                      <div className="relative w-full h-full overflow-hidden bg-muted/30"
                        style={{ clipPath: 'polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)' }}>
                        {w.imageUrl ? (
                          <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-center hover:scale-[1.03] transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-12 h-12 text-muted-foreground/40" strokeWidth={1.25} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <ChampionBeltOverlay championships={champLookup.get(w.id) ?? []} size="lg" />
                </div>
                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-display font-bold text-base sm:text-lg uppercase tracking-wide text-foreground leading-tight line-clamp-2">{w.name}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {show ? (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border ${theme.label}`}>{show.name}</span>
                    ) : (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border ${theme.label}`}>{brandLabel(w.brand)}</span>
                    )}
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">{w.alignment}</span>
                    <RoleBadge role={w.role} />
                    <StatusBadge status={w.status} />
                  </div>
                  {w.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-1 pt-2 border-t border-border italic leading-relaxed">{w.notes}</p>
                  )}
                  {!w.notes && w.creativeNotes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1 pt-2 border-t border-border leading-relaxed">{w.creativeNotes}</p>
                  )}
                </div>
              </div>
            );
            return selectMode ? (
              <div key={w.id}>{cardContent}</div>
            ) : (
              <CardMenu key={w.id} actions={cardActions} label={w.name}>
                {cardContent}
              </CardMenu>
            );
          })}
        </div>
      )}

      <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickPhoto} />

      <WrestlerDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editingWrestler}
        shows={shows}
        onSave={handleSave}
      />

      <WrestlerProfile
        wrestlerId={profileWrestlerId}
        onClose={() => setProfileWrestlerId(null)}
        onEdit={() => {
          const w = roster.find(r => r.id === profileWrestlerId);
          if (w) { setEditingWrestler(w); setIsDialogOpen(true); }
          setProfileWrestlerId(null);
        }}
        onLogMatch={() => {
          setMatchLoggerOpen(true);
        }}
      />

      <MatchLogger
        open={matchLoggerOpen}
        onOpenChange={setMatchLoggerOpen}
        date={date}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPIONSHIPS SECTION
// ─────────────────────────────────────────────────────────────────────────────

function ChampionshipsSection() {
  const [championships, setChampionships] = useChampionships();
  const [roster] = useRoster();
  const [editing, setEditing] = useState<Championship | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [photoTargetId, setPhotoTargetId] = useState<string | null>(null);
  const quickPhotoRef = useRef<HTMLInputElement>(null);

  const handleQuickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !photoTargetId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image is too large (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setChampionships(ch => ch.map(c => c.id === photoTargetId ? { ...c, imageUrl: reader.result as string } : c));
      toast.success("Belt photo updated");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setPhotoTargetId(null);
  };

  const rosterById = useMemo(() => {
    const m = new Map<string, Wrestler>();
    roster.forEach(w => m.set(w.id, w));
    return m;
  }, [roster]);

  const handleSave = (c: Championship) => {
    if (editing && championships.some(x => x.id === editing.id)) {
      setChampionships(championships.map(x => x.id === editing.id ? c : x));
      toast.success("Championship updated");
    } else {
      setChampionships([...championships, c]);
      toast.success("Championship added");
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Remove this championship?")) {
      setChampionships(championships.filter(c => c.id !== id));
      toast.success("Championship removed");
    }
  };

  const champNames = (c: Championship) =>
    (c.currentChampionIds ?? []).map(id => rosterById.get(id)?.name).filter(Boolean).join(" & ") || "VACANT";

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => { setEditing(null); setIsDialogOpen(true); }}
          className="bg-foreground hover:bg-foreground/90 text-background font-bold tracking-wider uppercase"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Championship
        </Button>
      </div>

      {championships.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card border-dashed">
          <Trophy className="w-16 h-16 text-muted-foreground/30 mb-4" strokeWidth={1} />
          <h3 className="text-xl font-display uppercase tracking-widest text-foreground mb-2">No Championships</h3>
          <p className="text-muted-foreground max-w-md mb-6">Track your title belts and their current holders here. The AI will factor championships into booking decisions.</p>
          <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }} variant="outline" className="border-foreground text-foreground hover:bg-foreground/5">
            Add Your First Title
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {championships.map(c => {
            const theme = brandTheme(c.brand);
            const inactive = c.active === false;
            const actions: CardMenuAction[] = [
              { label: "Edit Championship", icon: <Edit2 />, action: () => { setEditing(c); setIsDialogOpen(true); } },
              { label: "Change Belt Photo", icon: <ImagePlus />, action: () => { setPhotoTargetId(c.id); quickPhotoRef.current?.click(); } },
              { label: inactive ? "Set Active" : "Set Inactive", icon: <ToggleLeft />, action: () => {
                setChampionships(ch => ch.map(x => x.id === c.id ? { ...x, active: inactive ? true : false } : x));
                toast.success(inactive ? "Championship activated" : "Championship deactivated");
              }},
              { label: "Delete Championship", icon: <Trash2 />, action: () => handleDelete(c.id), destructive: true, separator: true },
            ];
            return (
              <CardMenu key={c.id} actions={actions} label={c.name}>
                <div className={cn("bg-card border rounded-xl flex flex-col overflow-hidden transition-all hover:shadow-lg", inactive ? "opacity-50 border-border" : "border-border hover:border-foreground/30")}>
                  <div className="h-28 flex items-center justify-center bg-muted/20 border-b border-border relative">
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt={c.name} className="h-full w-full object-contain p-4" />
                    ) : (
                      <Trophy className="w-14 h-14 text-foreground/20" strokeWidth={1} />
                    )}
                    {inactive && (
                      <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border border-border text-muted-foreground bg-background/80">
                        INACTIVE
                      </span>
                    )}
                  </div>

                  <div className="p-4 flex flex-col gap-2 flex-1">
                    <h3 className="font-display font-bold text-base uppercase tracking-wide text-foreground leading-tight line-clamp-2">{c.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {c.brand && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border ${theme.label}`}>
                          {brandLabel(c.brand)}
                        </span>
                      )}
                      {c.division && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">
                          {c.division}
                        </span>
                      )}
                    </div>
                    <div className="mt-auto pt-2 border-t border-border">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Champion</span>
                      <p className="text-sm font-display font-bold uppercase tracking-wide text-foreground mt-0.5 line-clamp-2">{champNames(c)}</p>
                    </div>
                    {c.notes && (
                      <p className="text-xs text-muted-foreground line-clamp-2 italic">{c.notes}</p>
                    )}
                  </div>
                </div>
              </CardMenu>
            );
          })}
        </div>
      )}

      <input ref={quickPhotoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickPhoto} />

      <ChampionshipDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editing}
        roster={roster}
        onSave={handleSave}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLES SECTION
// ─────────────────────────────────────────────────────────────────────────────

function StablesSection() {
  const [stables, setStables] = useStables();
  const [roster] = useRoster();
  const [editing, setEditing] = useState<Stable | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [logoTargetId, setLogoTargetId] = useState<string | null>(null);
  const quickLogoRef = useRef<HTMLInputElement>(null);

  const handleQuickLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !logoTargetId) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image is too large (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setStables(st => st.map(s => s.id === logoTargetId ? { ...s, logoUrl: reader.result as string } : s));
      toast.success("Logo updated");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    setLogoTargetId(null);
  };

  const rosterById = useMemo(() => {
    const m = new Map<string, Wrestler>();
    roster.forEach(w => m.set(w.id, w));
    return m;
  }, [roster]);

  const handleSave = (s: Stable) => {
    if (editing && stables.some(x => x.id === editing.id)) {
      setStables(stables.map(x => x.id === editing.id ? s : x));
      toast.success("Stable updated");
    } else {
      setStables([...stables, s]);
      toast.success("Stable added");
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirm("Remove this stable or tag team?")) {
      setStables(stables.filter(s => s.id !== id));
      toast.success("Stable removed");
    }
  };

  const memberNames = (s: Stable) =>
    (s.memberIds ?? []).map(id => rosterById.get(id)?.name).filter((n): n is string => Boolean(n));

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => { setEditing(null); setIsDialogOpen(true); }}
          className="bg-foreground hover:bg-foreground/90 text-background font-bold tracking-wider uppercase"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Stable / Tag Team
        </Button>
      </div>

      {stables.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card border-dashed">
          <Tag className="w-16 h-16 text-muted-foreground/30 mb-4" strokeWidth={1} />
          <h3 className="text-xl font-display uppercase tracking-widest text-foreground mb-2">No Stables or Tag Teams</h3>
          <p className="text-muted-foreground max-w-md mb-6">Track factions, stables, and tag teams here. The AI will respect alliances when booking matches and storylines.</p>
          <Button onClick={() => { setEditing(null); setIsDialogOpen(true); }} variant="outline" className="border-foreground text-foreground hover:bg-foreground/5">
            Add Your First Stable
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {stables.map(s => {
            const theme = brandTheme(s.brand);
            const disbanded = s.status === "DISBANDED";
            const leader = s.leaderId ? rosterById.get(s.leaderId) : undefined;
            const names = memberNames(s);
            const displayNames = names.slice(0, 4);
            const overflow = names.length - displayNames.length;
            const actions: CardMenuAction[] = [
              { label: "Edit Stable", icon: <Edit2 />, action: () => { setEditing(s); setIsDialogOpen(true); } },
              { label: "Change Logo", icon: <ImagePlus />, action: () => { setLogoTargetId(s.id); quickLogoRef.current?.click(); } },
              { label: disbanded ? "Reactivate" : s.status === "INACTIVE" ? "Set Active" : "Disband", icon: <ToggleLeft />, action: () => {
                const next = disbanded ? "ACTIVE" : s.status === "INACTIVE" ? "ACTIVE" : "DISBANDED";
                setStables(st => st.map(x => x.id === s.id ? { ...x, status: next as Stable["status"] } : x));
                toast.success(next === "ACTIVE" ? "Stable reactivated" : "Stable disbanded");
              }},
              { label: "Delete Stable", icon: <Trash2 />, action: () => handleDelete(s.id), destructive: true, separator: true },
            ];
            return (
              <CardMenu key={s.id} actions={actions} label={s.name}>
                <div className={cn("bg-card border rounded-xl flex flex-col overflow-hidden transition-all hover:shadow-lg", disbanded ? "opacity-50 border-border" : "border-border hover:border-foreground/30")}>
                <div className="h-24 flex items-center justify-center bg-muted/20 border-b border-border relative">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="h-full w-full object-contain p-3" />
                  ) : (
                    <div className="flex items-center gap-[-4px]">
                      {names.slice(0, 3).map((name, i) => {
                        const w = roster.find(r => r.name === name);
                        return (
                          <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted/50 overflow-hidden flex items-center justify-center -ml-2 first:ml-0" style={{ zIndex: 3 - i }}>
                            {w?.imageUrl ? (
                              <img src={w.imageUrl} alt={name} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-5 h-5 text-muted-foreground/50" strokeWidth={1.5} />
                            )}
                          </div>
                        );
                      })}
                      {names.length === 0 && <Users className="w-12 h-12 text-foreground/20" strokeWidth={1} />}
                    </div>
                  )}
                  {disbanded && (
                    <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border border-border text-muted-foreground bg-background/80">
                      DISBANDED
                    </span>
                  )}
                  {!disbanded && s.status === "INACTIVE" && (
                    <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border border-border text-muted-foreground bg-background/80">
                      INACTIVE
                    </span>
                  )}
                </div>

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-display font-bold text-base uppercase tracking-wide text-foreground leading-tight line-clamp-1">{s.name}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {s.brand && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border ${theme.label}`}>
                        {brandLabel(s.brand)}
                      </span>
                    )}
                    {s.alignment && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground bg-muted/30">
                        {s.alignment}
                      </span>
                    )}
                  </div>
                  {leader && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Leader:</span>
                      <span className="text-[10px] font-bold uppercase tracking-wide text-foreground">{leader.name}</span>
                    </div>
                  )}
                  {names.length > 0 && (
                    <div>
                      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Members: </span>
                      <span className="text-[10px] text-foreground/80">
                        {displayNames.join(", ")}{overflow > 0 ? ` +${overflow} more` : ""}
                      </span>
                    </div>
                  )}
                  {s.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic mt-1">{s.notes}</p>
                  )}
                </div>
                </div>
              </CardMenu>
            );
          })}
        </div>
      )}

      <input ref={quickLogoRef} type="file" accept="image/*" className="hidden" onChange={handleQuickLogo} />

      <StableDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        initialData={editing}
        roster={roster}
        onSave={handleSave}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_RED = "#dc1e1e";

interface CardMenuAction {
  label: string;
  icon: React.ReactNode;
  action: () => void;
  destructive?: boolean;
  separator?: boolean;
}

/** Wraps a card with right-click ContextMenu + a hover/tap three-dot DropdownMenu */
function CardMenu({
  children,
  actions,
  label,
  dotButtonClass,
}: {
  children: ReactNode;
  actions: CardMenuAction[];
  label: string;
  dotButtonClass?: string;
}) {
  const items = (
    ItemC: ComponentType<{ onClick: (e: MouseEvent) => void; className?: string; children: ReactNode }>,
    SepC: ComponentType
  ) => actions.map((a, i) => (
    <Fragment key={i}>
      {a.separator && <SepC />}
      <ItemC
        onClick={e => { e.stopPropagation(); a.action(); }}
        className={cn("gap-2 cursor-pointer", a.destructive && "text-destructive focus:text-destructive focus:bg-destructive/10")}
      >
        {a.icon}
        {a.label}
      </ItemC>
    </Fragment>
  ));

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="relative group/card">
          {children}
          {/* Three-dot button — always visible on touch devices, hover-reveal on desktop */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={e => e.stopPropagation()}
                aria-label={`Actions for ${label}`}
                className={cn(
                  "absolute top-2 right-2 z-20 w-7 h-7 rounded-md flex items-center justify-center",
                  "bg-background/85 backdrop-blur-sm border border-border text-foreground",
                  "opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity",
                  "[@media(hover:none)]:opacity-100",
                  dotButtonClass
                )}
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-foreground/70">{label}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items(DropdownMenuItem as any, DropdownMenuSeparator)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuLabel className="text-foreground/70">{label}</ContextMenuLabel>
        <ContextMenuSeparator />
        {items(ContextMenuItem as any, ContextMenuSeparator)}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function FieldLabel({ children, helper }: { children: React.ReactNode; helper?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{children}</span>
      {helper && <span className="text-[10px] text-muted-foreground/45 normal-case tracking-normal font-normal">{helper}</span>}
    </div>
  );
}

function PanelHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <>
      <div className="h-[3px] w-full shrink-0" style={{ background: BRAND_RED }} />
      <div className="px-6 py-4 border-b border-border bg-muted/10 shrink-0">
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">{eyebrow}</div>
        <div className="font-display text-xl uppercase tracking-widest text-foreground">{title}</div>
      </div>
    </>
  );
}

function PanelFooter({ onCancel, saveLabel, formId }: { onCancel: () => void; saveLabel: string; formId: string }) {
  return (
    <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-muted/5">
      <button type="button" onClick={onCancel}
        className="px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
        Cancel
      </button>
      <button type="submit" form={formId}
        className="px-5 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase bg-foreground text-background hover:bg-foreground/90 transition-colors">
        {saveLabel}
      </button>
    </div>
  );
}

function useImageUpload(onLoad: (url: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => ref.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image is too large (max 2MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") onLoad(reader.result); };
    reader.onerror = () => toast.error("Could not read image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return { ref, open, handleChange };
}

/** Visual wrestler grid picker — matches the RivalryDialogs style */
function WrestlerPickerGrid({
  roster, selectedIds, onToggle,
}: {
  roster: Wrestler[]; selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = roster.filter(w =>
    !search || w.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search roster..."
          className="w-full pl-8 pr-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground text-foreground placeholder:text-muted-foreground/50"
        />
      </div>
      {filtered.length === 0 && (
        <div className="py-8 text-center text-sm text-muted-foreground">No superstars match.</div>
      )}
      <div className="grid grid-cols-5 gap-2 max-h-56 overflow-y-auto pr-0.5">
        {filtered.map(w => {
          const sel = selectedIds.includes(w.id);
          return (
            <button key={w.id} type="button" onClick={() => onToggle(w.id)}
              className={cn(
                "flex flex-col rounded-lg overflow-hidden border-2 transition-all text-left focus:outline-none",
                sel ? "border-foreground ring-1 ring-foreground/30" : "border-border hover:border-foreground/50"
              )}>
              <div className="relative w-full bg-muted/20 overflow-hidden" style={{ aspectRatio: "3/4" }}>
                {w.imageUrl
                  ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                  : <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-muted-foreground/30" /></div>
                }
                {sel && (
                  <div className="absolute inset-0 flex items-end justify-end p-1" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <span className="w-4 h-4 rounded-full bg-foreground flex items-center justify-center">
                      <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-background fill-background stroke-background"><path d="M2 5l2.5 2.5L8 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" /></svg>
                    </span>
                  </div>
                )}
              </div>
              <div className="px-1 py-1 bg-muted/10">
                <div className="text-[8px] font-bold uppercase tracking-wide text-foreground leading-tight line-clamp-2">{w.name}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// WRESTLER DIALOG — Talent Profile Card
// ─────────────────────────────────────────────────────────────────────────────

function WrestlerDialog({
  open, onOpenChange, initialData, shows, onSave,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initialData: Wrestler | null; shows: Show[];
  onSave: (w: Wrestler) => void;
}) {
  const champLookup = useChampionLookup();
  const dialogChampionships = initialData ? (champLookup.get(initialData.id) ?? []) : [];
  const [name, setName] = useState("");
  const [showId, setShowId] = useState<string>(NO_SHOW);
  const [alignment, setAlignment] = useState<WrestlerAlignment>(WrestlerAlignment.FACE);
  const [status, setStatus] = useState<WrestlerStatus | "">("");
  const [role, setRole] = useState<WrestlerRole | "">("");
  const [notes, setNotes] = useState("");
  const [creativeNotes, setCreativeNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const { ref: fileRef, open: openFile, handleChange: handleFileChange } = useImageUpload(url => setImageUrl(url));

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setShowId(deriveShowId(initialData));
      setAlignment(initialData.alignment || WrestlerAlignment.FACE);
      setStatus(initialData.status || "");
      setRole(initialData.role || "");
      setNotes(initialData.notes || "");
      setCreativeNotes(initialData.creativeNotes || "");
      setImageUrl(initialData.imageUrl);
    } else {
      setName(""); setShowId(NO_SHOW); setAlignment(WrestlerAlignment.FACE);
      setStatus(""); setRole(""); setNotes(""); setCreativeNotes(""); setImageUrl(undefined);
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const derivedBrand = showId !== NO_SHOW
      ? (SHOW_BRAND_MAP[showId] ?? WrestlerBrand.FREE_AGENT)
      : (initialData && !initialData.showId && initialData.brand && !BRAND_SHOW_MAP[initialData.brand])
        ? initialData.brand
        : WrestlerBrand.FREE_AGENT;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      name: name.trim(), brand: derivedBrand, alignment,
      status: status || undefined, role: role || undefined,
      notes: notes.trim(), creativeNotes: creativeNotes.trim() || undefined,
      imageUrl, showId: showId === NO_SHOW ? undefined : showId,
    });
    if (!initialData) { setName(""); setNotes(""); setCreativeNotes(""); setImageUrl(undefined); setShowId(NO_SHOW); }
  };

  const FORM_ID = "wrestler-dialog-form";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[660px] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{initialData ? "Edit Talent Profile" : "New Signing"}</DialogTitle>
        <DialogDescription className="sr-only">Manage wrestler information including photo, brand assignment, alignment, status, and booking notes.</DialogDescription>
        <PanelHeader eyebrow="Roster Management" title={initialData ? "Edit Talent Profile" : "New Signing"} />

        <form id={FORM_ID} onSubmit={handleSubmit} className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* ── Left: Photo panel ── */}
          <div className="md:w-52 shrink-0 bg-muted/10 border-b md:border-b-0 md:border-r border-border flex flex-col items-center gap-4 p-5 overflow-y-auto">
            {/* Octagonal talent photo frame */}
            <button type="button" onClick={openFile}
              className="relative w-36 group shrink-0"
              style={{ filter: "drop-shadow(0 6px 18px rgba(0,0,0,0.6))", aspectRatio: "3/4" }}>
              <div className="w-full h-full p-[4px]"
                style={{ clipPath: "polygon(11px 0%,calc(100% - 11px) 0%,100% 11px,100% calc(100% - 11px),calc(100% - 11px) 100%,11px 100%,0% calc(100% - 11px),0% 11px)", background: "linear-gradient(145deg,#e6e6e6 0%,#a4a4a4 18%,#efefef 34%,#b8b8b8 50%,#7e7e7e 66%,#cccccc 82%,#9a9a9a 100%)" }}>
                <div className="relative w-full h-full overflow-hidden bg-muted/40"
                  style={{ clipPath: "polygon(8px 0%,calc(100% - 8px) 0%,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0% calc(100% - 8px),0% 8px)" }}>
                  {imageUrl
                    ? <img src={imageUrl} alt="profile" className="w-full h-full object-cover object-center" />
                    : <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-muted/20">
                        <User className="w-10 h-10 text-muted-foreground/25" strokeWidth={1.25} />
                        <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/40">No Photo</span>
                      </div>
                  }
                  <div className="absolute inset-0 bg-black/65 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-7 h-7 text-white" />
                    <span className="text-[9px] font-bold tracking-widest uppercase text-white">{imageUrl ? "Change Photo" : "Upload Photo"}</span>
                  </div>
                </div>
              </div>
              <img src={wweLogo} alt="WWE" className="absolute top-2 left-2 w-8 h-8 z-10 drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)] pointer-events-none select-none" />
              <ChampionBeltOverlay championships={dialogChampionships} size="md" />
            </button>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {imageUrl && (
              <button type="button" onClick={() => setImageUrl(undefined)}
                className="w-full px-3 py-1.5 rounded border border-border/60 text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors flex items-center justify-center gap-1.5">
                <X className="w-3 h-3" /> Remove Photo
              </button>
            )}

            {/* Live name preview */}
            {name && (
              <div className="w-full px-2 pt-2 border-t border-border/40 text-center">
                <div className="font-display text-sm uppercase tracking-wider text-foreground leading-tight">{name}</div>
                {alignment && <div className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground mt-1">{alignment}</div>}
              </div>
            )}
          </div>

          {/* ── Right: Fields ── */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Ring name */}
            <div>
              <FieldLabel>Ring Name</FieldLabel>
              <input
                value={name} onChange={e => setName(e.target.value)} required
                placeholder="Enter superstar name..."
                className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-foreground font-display text-lg uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-foreground placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/30"
              />
            </div>

            {/* Brand — show thumbnails */}
            <div>
              <FieldLabel>Brand Assignment</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                {shows.map(s => (
                  <button key={s.id} type="button" onClick={() => setShowId(showId === s.id ? NO_SHOW : s.id)}
                    className={cn("relative h-11 w-24 rounded-lg overflow-hidden border-2 transition-all shrink-0",
                      showId === s.id ? "border-foreground ring-1 ring-foreground/30" : "border-border hover:border-foreground/40"
                    )}
                    style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.15),rgba(0,0,0,0.35)), url(${s.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }}
                  >
                    <span className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-bold tracking-widest uppercase text-white/90">
                      {s.name.replace("Monday Night ", "").replace("Friday Night ", "")}
                    </span>
                  </button>
                ))}
                <button type="button" onClick={() => setShowId(NO_SHOW)}
                  className={cn("relative h-11 w-24 rounded-lg overflow-hidden border-2 transition-all shrink-0",
                    showId === NO_SHOW ? "border-foreground ring-1 ring-foreground/30" : "border-border hover:border-foreground/40"
                  )}
                  style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.15),rgba(0,0,0,0.35)), url(${performanceCenterBg})`, backgroundSize: "cover", backgroundPosition: "center" }}
                >
                  <span className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-bold tracking-widest uppercase text-white/90">P. Center</span>
                </button>
              </div>
            </div>

            {/* Alignment */}
            <div>
              <FieldLabel>Character Alignment</FieldLabel>
              <div className="flex gap-2">
                {Object.values(WrestlerAlignment).map(a => (
                  <button key={a} type="button" onClick={() => setAlignment(a)}
                    className={cn("px-4 py-2 rounded-lg border-2 text-[11px] font-bold tracking-widest uppercase transition-all",
                      alignment === a ? "border-foreground bg-foreground text-background shadow-sm" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <FieldLabel helper="Leave unset for active roster">Creative Status</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setStatus("")}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                    !status ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                  )}>Active</button>
                {Object.values(WrestlerStatus).map(s => (
                  <button key={s} type="button" onClick={() => setStatus(status === s ? "" : s)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                      status === s ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Role on card */}
            <div>
              <FieldLabel helper="Card position — guides AI booking priority">Role on Card</FieldLabel>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => setRole("")}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                    !role ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                  )}>Unset</button>
                {Object.values(WrestlerRole).map(r => (
                  <button key={r} type="button" onClick={() => setRole(role === r ? "" : r)}
                    className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all flex items-center gap-1",
                      role === r ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
                    {r === WrestlerRole.MAIN_EVENTER && <Star className="w-2.5 h-2.5 shrink-0" />}
                    {roleLabel(r)}
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border" />

            {/* Current angle */}
            <div>
              <FieldLabel helper="Current program, feuds, title status">Current Angle</FieldLabel>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="bg-background resize-none h-[72px] text-sm"
                placeholder="e.g. Intercontinental Champion, on collision course with Seth Rollins..." />
            </div>

            {/* Creative direction */}
            <div>
              <FieldLabel helper="Internal GM notes — AI booker eyes only">Creative Direction</FieldLabel>
              <Textarea value={creativeNotes} onChange={e => setCreativeNotes(e.target.value)}
                className="bg-background resize-none h-[72px] text-sm"
                placeholder="Long-term push plans, character arc, booking notes..." />
            </div>
          </div>
        </form>

        <PanelFooter onCancel={() => onOpenChange(false)} saveLabel={initialData ? "Update Profile" : "Sign Talent"} formId={FORM_ID} />
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAMPIONSHIP DIALOG — Title Management Card
// ─────────────────────────────────────────────────────────────────────────────

function ChampionshipDialog({
  open, onOpenChange, initialData, roster, onSave,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initialData: Championship | null; roster: Wrestler[];
  onSave: (c: Championship) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [division, setDivision] = useState<string>("");
  const [active, setActive] = useState(true);
  const [championIds, setChampionIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);

  const { ref: fileRef, open: openFile, handleChange: handleFileChange } = useImageUpload(url => setImageUrl(url));

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setBrand(initialData.brand || "");
      setDivision(initialData.division || "");
      setActive(initialData.active !== false);
      setChampionIds(initialData.currentChampionIds ?? []);
      setNotes(initialData.notes || "");
      setImageUrl(initialData.imageUrl);
    } else {
      setName(""); setBrand(""); setDivision(""); setActive(true);
      setChampionIds([]); setNotes(""); setImageUrl(undefined);
    }
  }, [open, initialData]);

  const toggleChampion = (id: string) => setChampionIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  );

  const champNames = championIds.map(id => roster.find(w => w.id === id)?.name).filter(Boolean);
  const champDisplay = champNames.length === 0 ? null
    : champNames.length === 1 ? champNames[0]
    : champNames.slice(0, -1).join(", ") + " & " + champNames[champNames.length - 1];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      name: name.trim(),
      brand: (brand || undefined) as Championship["brand"],
      division: (division || undefined) as Championship["division"],
      active,
      currentChampionIds: championIds,
      notes: notes.trim() || undefined,
      imageUrl,
    });
  };

  const sortedRoster = useMemo(() => [...roster].sort((a, b) => a.name.localeCompare(b.name)), [roster]);

  const FORM_ID = "championship-dialog-form";
  const BRAND_PILLS = [
    { value: "", label: "Any" },
    { value: WrestlerBrand.RAW, label: "RAW" },
    { value: WrestlerBrand.SMACKDOWN, label: "SmackDown" },
    { value: WrestlerBrand.NXT, label: "NXT" },
  ];
  const DIVISION_PILLS = [
    { value: "", label: "Any" },
    { value: "MENS", label: "Men's" },
    { value: "WOMENS", label: "Women's" },
    { value: "TAG", label: "Tag Team" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[560px] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{initialData ? "Edit Championship" : "Create Championship"}</DialogTitle>
        <DialogDescription className="sr-only">Manage championship details including belt image, brand, division, and current champion.</DialogDescription>
        <PanelHeader eyebrow="Title Management" title={initialData ? "Edit Championship" : "Create Championship"} />

        {/* Belt hero image zone */}
        <button type="button" onClick={openFile}
          className="group relative w-full h-36 bg-muted/20 border-b border-border overflow-hidden shrink-0 flex items-center justify-center hover:bg-muted/30 transition-colors">
          {imageUrl
            ? <img src={imageUrl} alt="belt" className="h-full w-full object-contain p-4" />
            : <div className="flex flex-col items-center gap-2">
                <Trophy className="w-14 h-14 text-muted-foreground/20" strokeWidth={0.8} />
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">Upload Belt Photo</span>
              </div>
          }
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-8 h-8 text-white" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-white">{imageUrl ? "Change Belt Photo" : "Upload Belt Photo"}</span>
          </div>
          {imageUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); setImageUrl(undefined); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center hover:bg-black/90 transition-colors z-10">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <form id={FORM_ID} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Championship name */}
          <div>
            <FieldLabel>Championship Name</FieldLabel>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. WWE Championship"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-foreground font-display text-base uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-foreground placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Brand */}
          <div>
            <FieldLabel>Brand</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {BRAND_PILLS.map(p => (
                <button key={p.value} type="button" onClick={() => setBrand(p.value)}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                    brand === p.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Division */}
          <div>
            <FieldLabel>Division</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {DIVISION_PILLS.map(p => (
                <button key={p.value} type="button" onClick={() => setDivision(p.value)}
                  className={cn("px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                    division === p.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Champion display */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <FieldLabel>Current Champion{championIds.length !== 1 ? "(s)" : ""}</FieldLabel>
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">
                {champDisplay
                  ? <span className="text-foreground">{champDisplay}</span>
                  : <span className="italic font-normal normal-case tracking-normal">Vacant</span>
                }
              </span>
            </div>
            {sortedRoster.length === 0
              ? <div className="rounded-lg border border-dashed border-border bg-muted/10 py-6 text-center text-sm text-muted-foreground">No superstars in roster yet.</div>
              : <WrestlerPickerGrid roster={sortedRoster} selectedIds={championIds} onToggle={toggleChampion} />
            }
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button type="button" onClick={() => setActive(!active)}
              className={cn("relative w-10 h-6 rounded-full border-2 transition-all",
                active ? "border-foreground bg-foreground" : "border-border bg-transparent"
              )}>
              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full transition-all",
                active ? "left-[calc(100%-18px)] bg-background" : "left-0.5 bg-muted-foreground"
              )} />
            </button>
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-foreground">{active ? "Active" : "Retired / Vacant"}</div>
              <div className="text-[10px] text-muted-foreground/60 normal-case font-normal tracking-normal">
                {active ? "This title is in active rotation" : "Inactive titles are still tracked but marked retired"}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <FieldLabel helper="Booking history, defense rules, etc.">Notes</FieldLabel>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="bg-background resize-none h-[64px] text-sm"
              placeholder="e.g. Defended at every premium live event, unified with the IC title..." />
          </div>
        </form>

        <PanelFooter onCancel={() => onOpenChange(false)} saveLabel={initialData ? "Save Championship" : "Crown Champion"} formId={FORM_ID} />
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STABLE DIALOG — Faction HQ
// ─────────────────────────────────────────────────────────────────────────────

function StableDialog({
  open, onOpenChange, initialData, roster, onSave,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  initialData: Stable | null; roster: Wrestler[];
  onSave: (s: Stable) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState<string>("");
  const [alignment, setAlignment] = useState<string>("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [leaderId, setLeaderId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  const { ref: fileRef, open: openFile, handleChange: handleFileChange } = useImageUpload(url => setLogoUrl(url));
  const sortedRoster = useMemo(() => [...roster].sort((a, b) => a.name.localeCompare(b.name)), [roster]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setBrand(initialData.brand || "");
      setAlignment(initialData.alignment || "");
      setStatus(initialData.status || "ACTIVE");
      setMemberIds(initialData.memberIds ?? []);
      setLeaderId(initialData.leaderId || "");
      setManagerId(initialData.managerId || "");
      setNotes(initialData.notes || "");
      setLogoUrl(initialData.logoUrl);
    } else {
      setName(""); setBrand(""); setAlignment(""); setStatus("ACTIVE");
      setMemberIds([]); setLeaderId(""); setManagerId(""); setNotes(""); setLogoUrl(undefined);
    }
  }, [open, initialData]);

  const toggleMember = (id: string) => {
    setMemberIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!next.includes(leaderId)) setLeaderId("");
      if (!next.includes(managerId)) setManagerId("");
      return next;
    });
  };

  const memberWrestlers = memberIds.map(id => roster.find(w => w.id === id)).filter((w): w is Wrestler => Boolean(w));

  const memberFallbackDisplay = (() => {
    const names = memberWrestlers.map(w => w.name);
    if (names.length === 0) return null;
    if (names.length === 1) return names[0];
    return names.slice(0, -1).join(", ") + " & " + names[names.length - 1];
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      name: name.trim(),
      brand: (brand || undefined) as Stable["brand"],
      alignment: (alignment || undefined) as Stable["alignment"],
      status: (status || undefined) as Stable["status"],
      memberIds, leaderId: leaderId || undefined,
      managerId: managerId || undefined,
      notes: notes.trim() || undefined, logoUrl,
    });
  };

  const FORM_ID = "stable-dialog-form";
  const BRAND_PILLS = [
    { value: "", label: "Any" },
    { value: WrestlerBrand.RAW, label: "RAW" },
    { value: WrestlerBrand.SMACKDOWN, label: "SmackDown" },
    { value: WrestlerBrand.NXT, label: "NXT" },
  ];
  const ALIGN_PILLS = [
    { value: "", label: "Any" },
    ...Object.values(WrestlerAlignment).map(a => ({ value: a, label: a })),
  ];
  const STATUS_PILLS = [
    { value: "ACTIVE", label: "Active" },
    { value: "INACTIVE", label: "Inactive" },
    { value: "DISBANDED", label: "Disbanded" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[600px] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{initialData ? "Edit Stable / Tag Team" : "Form a Faction"}</DialogTitle>
        <DialogDescription className="sr-only">Manage faction details including logo, members, alignment, and leader assignment.</DialogDescription>
        <PanelHeader eyebrow="Faction Management" title={initialData ? "Edit Stable / Tag Team" : "Form a Faction"} />

        {/* Logo / member faces hero zone */}
        <button type="button" onClick={openFile}
          className="group relative w-full h-32 bg-muted/20 border-b border-border overflow-hidden shrink-0 flex items-center justify-center hover:bg-muted/30 transition-colors">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-full w-full object-contain p-3" />
          ) : memberWrestlers.length > 0 ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center">
                {memberWrestlers.slice(0, 5).map((w, i) => (
                  <div key={w.id} className="w-12 h-12 rounded-full border-2 border-background bg-muted/60 overflow-hidden flex items-center justify-center -ml-3 first:ml-0"
                    style={{ zIndex: 5 - i }}>
                    {w.imageUrl ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover" />
                      : <User className="w-6 h-6 text-muted-foreground/50" />
                    }
                  </div>
                ))}
                {memberWrestlers.length > 5 && (
                  <div className="w-12 h-12 rounded-full border-2 border-background bg-muted/60 flex items-center justify-center -ml-3 z-0">
                    <span className="text-[10px] font-bold text-muted-foreground">+{memberWrestlers.length - 5}</span>
                  </div>
                )}
              </div>
              {memberFallbackDisplay && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 max-w-[80%] text-center line-clamp-1">
                  {memberFallbackDisplay}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Tag className="w-12 h-12 text-muted-foreground/20" strokeWidth={0.8} />
              <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/50">Upload Faction Logo</span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-7 h-7 text-white" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-white">{logoUrl ? "Change Logo" : "Upload Logo"}</span>
          </div>
          {logoUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); setLogoUrl(undefined); }}
              className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center hover:bg-black/90 transition-colors z-10">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <form id={FORM_ID} onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Faction name */}
          <div>
            <FieldLabel>Faction Name</FieldLabel>
            <input
              value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. The Bloodline"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-md text-foreground font-display text-base uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-foreground placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/30"
            />
          </div>

          {/* Brand + Alignment row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <FieldLabel>Brand</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {BRAND_PILLS.map(p => (
                  <button key={p.value} type="button" onClick={() => setBrand(p.value)}
                    className={cn("px-2.5 py-1.5 rounded border-2 text-[9px] font-bold tracking-widest uppercase transition-all",
                      brand === p.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Alignment</FieldLabel>
              <div className="flex gap-1.5 flex-wrap">
                {ALIGN_PILLS.map(p => (
                  <button key={p.value} type="button" onClick={() => setAlignment(p.value)}
                    className={cn("px-2.5 py-1.5 rounded border-2 text-[9px] font-bold tracking-widest uppercase transition-all",
                      alignment === p.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <FieldLabel>Faction Status</FieldLabel>
            <div className="flex gap-2">
              {STATUS_PILLS.map(p => (
                <button key={p.value} type="button" onClick={() => setStatus(p.value)}
                  className={cn("px-4 py-2 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
                    status === p.value ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
                  )}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Members picker */}
          <div>
            <div className="flex items-baseline justify-between mb-2">
              <FieldLabel>Members</FieldLabel>
              {memberIds.length > 0 && (
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">{memberIds.length} selected</span>
              )}
            </div>
            {sortedRoster.length === 0
              ? <div className="rounded-lg border border-dashed border-border bg-muted/10 py-6 text-center text-sm text-muted-foreground">No superstars in roster yet.</div>
              : <WrestlerPickerGrid roster={sortedRoster} selectedIds={memberIds} onToggle={toggleMember} />
            }
          </div>

          {/* Leader + Manager — tappable member faces */}
          {memberWrestlers.length > 0 && (
            <div className="grid grid-cols-2 gap-5 pt-2 border-t border-border">
              <div>
                <FieldLabel helper="Tap to assign">Leader</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {memberWrestlers.map(w => (
                    <button key={w.id} type="button" onClick={() => setLeaderId(leaderId === w.id ? "" : w.id)}
                      className={cn("flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all",
                        leaderId === w.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40"
                      )}>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/40 flex items-center justify-center">
                        {w.imageUrl ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover" />
                          : <User className="w-4 h-4 text-muted-foreground/50" />}
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wide text-foreground leading-tight text-center max-w-[48px] line-clamp-2">
                        {w.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel helper="Optional">Manager</FieldLabel>
                <div className="flex gap-2 flex-wrap">
                  {memberWrestlers.map(w => (
                    <button key={w.id} type="button" onClick={() => setManagerId(managerId === w.id ? "" : w.id)}
                      className={cn("flex flex-col items-center gap-1 p-1.5 rounded-lg border-2 transition-all",
                        managerId === w.id ? "border-foreground bg-foreground/5" : "border-border hover:border-foreground/40"
                      )}>
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-muted/40 flex items-center justify-center">
                        {w.imageUrl ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover" />
                          : <User className="w-4 h-4 text-muted-foreground/50" />}
                      </div>
                      <span className="text-[8px] font-bold uppercase tracking-wide text-foreground leading-tight text-center max-w-[48px] line-clamp-2">
                        {w.name.split(" ")[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <FieldLabel helper="Storyline role, history, etc.">Notes</FieldLabel>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              className="bg-background resize-none h-[64px] text-sm"
              placeholder="e.g. Dominant heel faction, reigns supreme on SmackDown..." />
          </div>
        </form>

        <PanelFooter onCancel={() => onOpenChange(false)} saveLabel={initialData ? "Update Faction" : "Assemble Faction"} formId={FORM_ID} />
      </DialogContent>
    </Dialog>
  );
}
