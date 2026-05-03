import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  useChampionships, useRoster, useTitleReigns, useUniverseDate,
  type Championship, type TitleReign,
} from "@/lib/storage";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import legacyBackdrop from "@assets/83e9cea5bf2c10bb009efc8ea50ba52f_1777784802077.png";
import { dateToInt, formatDateCompact, MONTH_LABELS } from "@/lib/calendar";
import type { UniverseDate } from "@/lib/calendar";
import type { Wrestler } from "@workspace/api-client-react";
import { WrestlerBrand } from "@workspace/api-client-react";
import {
  Trophy, Plus, ChevronLeft, Edit2, Trash2, Camera, X, User,
  MoreHorizontal, Clock, Shield, BarChart3, ArrowRight,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ─── helpers ────────────────────────────────────────────────────────────────

function reignDays(wonDate: UniverseDate, lostDate?: UniverseDate, now?: UniverseDate): number {
  const end = lostDate ?? now;
  if (!end) return 0;
  return Math.max(0, dateToInt(end) - dateToInt(wonDate));
}

function formatReignLength(days: number): string {
  if (days === 0) return "0 days";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function dateLabel(d: UniverseDate): string {
  return `${MONTH_LABELS[d.month - 1]} · WK ${d.week}${d.year ? ` · Y${d.year}` : ""}`;
}

function brandLabel(brand: string | undefined): string {
  if (!brand || brand === "FREE_AGENT") return "Undivided";
  return brand.replace(/_/g, " ");
}

// ─── image upload util ───────────────────────────────────────────────────────

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

// ─── shared ui primitives ────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-muted-foreground/50">{label}</span>
      <div className="flex-1 h-px bg-white/6" />
    </div>
  );
}

function FieldLabel({ children, helper }: { children: React.ReactNode; helper?: string }) {
  return (
    <div className="flex items-baseline gap-2 mb-2">
      <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">{children}</span>
      {helper && <span className="text-[10px] text-muted-foreground/40 normal-case tracking-normal font-normal">{helper}</span>}
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg border-2 text-[10px] font-bold tracking-widest uppercase transition-all",
        active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
      )}>
      {children}
    </button>
  );
}

// ─── Record Title Change Dialog ───────────────────────────────────────────────

function RecordTitleChangeDialog({
  open, onOpenChange, championship, roster, universeDate, currentReigns, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  championship: Championship;
  roster: Wrestler[];
  universeDate: UniverseDate;
  currentReigns: TitleReign[];
  onSave: (reigns: TitleReign[], updatedChampionship: Championship) => void;
}) {
  const activeReign = currentReigns.find(r => r.championshipId === championship.id && !r.lostDate);
  const prevChampName = activeReign?.wrestlerName ?? "VACANT";

  const [newWrestlerId, setNewWrestlerId] = useState("");
  const [newVacant, setNewVacant] = useState(false);
  const [howWon, setHowWon] = useState("");
  const [eventName, setEventName] = useState("");
  const [notes, setNotes] = useState("");
  const [wrestlerSearch, setWrestlerSearch] = useState("");

  useEffect(() => {
    if (open) {
      setNewWrestlerId(""); setNewVacant(false);
      setHowWon(""); setEventName(""); setNotes(""); setWrestlerSearch("");
    }
  }, [open]);

  const sortedRoster = useMemo(
    () => [...roster].sort((a, b) => a.name.localeCompare(b.name)),
    [roster]
  );
  const filteredRoster = sortedRoster.filter(w =>
    !wrestlerSearch || w.name.toLowerCase().includes(wrestlerSearch.toLowerCase())
  );

  const newChampName = newVacant ? "VACANT"
    : roster.find(w => w.id === newWrestlerId)?.name ?? "";

  function handleSave() {
    if (!newVacant && !newWrestlerId) {
      toast.error("Select a new champion or mark vacant.");
      return;
    }

    const newReigns = [...currentReigns];
    const activeIdx = newReigns.findIndex(r => r.championshipId === championship.id && !r.lostDate);

    if (activeIdx >= 0) {
      newReigns[activeIdx] = {
        ...newReigns[activeIdx],
        lostDate: universeDate,
        lostTo: newVacant ? "VACATED" : newChampName,
        howLost: howWon,
      };
    }

    const newReignEntry: TitleReign = {
      id: crypto.randomUUID(),
      championshipId: championship.id,
      wrestlerId: newVacant ? undefined : newWrestlerId,
      wrestlerName: newVacant ? "VACANT" : newChampName,
      wonDate: universeDate,
      wonFrom: prevChampName,
      howWon: howWon || undefined,
      eventName: eventName.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    newReigns.push(newReignEntry);

    const updatedChampionship: Championship = {
      ...championship,
      currentChampionIds: newVacant ? [] : (newWrestlerId ? [newWrestlerId] : []),
    };

    onSave(newReigns, updatedChampionship);
    onOpenChange(false);
    toast.success(`Title change recorded — ${newChampName} is the new ${championship.name} champion.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[560px] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">Record Title Change</DialogTitle>
        <DialogDescription className="sr-only">Log a championship change to the title history.</DialogDescription>

        <div className="h-[3px] w-full bg-foreground/20 shrink-0" />
        <div className="px-6 py-4 border-b border-border bg-muted/10 shrink-0">
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Title History</div>
          <div className="font-display text-xl uppercase tracking-widest text-foreground">{championship.name}</div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded border border-border bg-muted/10 px-4 py-3 flex items-center gap-3">
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground shrink-0">Previous</div>
            <div className="font-display text-sm uppercase tracking-wide text-foreground">{prevChampName}</div>
            <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
            <div className={cn("font-display text-sm uppercase tracking-wide", newChampName ? "text-foreground" : "text-muted-foreground/30")}>
              {newChampName || "Select new champion"}
            </div>
          </div>

          <div>
            <FieldLabel>New Champion</FieldLabel>
            <div className="flex gap-2 mb-3">
              <Pill active={!newVacant} onClick={() => setNewVacant(false)}>New Champion</Pill>
              <Pill active={newVacant} onClick={() => { setNewVacant(true); setNewWrestlerId(""); }}>Vacate Title</Pill>
            </div>
            {!newVacant && (
              <>
                <div className="relative mb-2">
                  <input
                    value={wrestlerSearch}
                    onChange={e => setWrestlerSearch(e.target.value)}
                    placeholder="Search roster..."
                    className="w-full pl-3 pr-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground text-foreground placeholder:text-muted-foreground/40"
                  />
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-0.5">
                  {filteredRoster.map(w => {
                    const sel = newWrestlerId === w.id;
                    return (
                      <button key={w.id} type="button" onClick={() => setNewWrestlerId(w.id)}
                        className={cn(
                          "flex flex-col rounded-lg overflow-hidden border-2 transition-all",
                          sel ? "border-foreground ring-1 ring-foreground/30" : "border-border hover:border-foreground/40"
                        )}>
                        <div className="relative w-full bg-muted/20 overflow-hidden" style={{ aspectRatio: "3/4" }}>
                          {w.imageUrl
                            ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                            : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground/30" /></div>
                          }
                          {sel && (
                            <div className="absolute inset-0 bg-black/30 flex items-end justify-end p-1">
                              <span className="w-4 h-4 rounded-full bg-foreground flex items-center justify-center">
                                <svg viewBox="0 0 10 10" className="w-2.5 h-2.5"><path d="M2 5l2.5 2.5L8 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" className="text-background" /></svg>
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
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <FieldLabel helper="optional">How They Won</FieldLabel>
              <input
                value={howWon}
                onChange={e => setHowWon(e.target.value)}
                placeholder="e.g. Pinfall, Cash-in, Battle Royal"
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            <div>
              <FieldLabel helper="optional">Event / Show</FieldLabel>
              <input
                value={eventName}
                onChange={e => setEventName(e.target.value)}
                placeholder="e.g. WrestleMania"
                className="w-full px-3 py-2 bg-background border border-border rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          <div>
            <FieldLabel helper="optional">Story Notes</FieldLabel>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Context about this title change — what led to it, what it means for the universe..."
              rows={3}
              className="bg-background border-border resize-none text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-muted/5">
          <button type="button" onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            disabled={!newVacant && !newWrestlerId}
            className="px-5 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:pointer-events-none">
            Lock In Title Change
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Championship Form Dialog ─────────────────────────────────────────────────

function ChampionshipFormDialog({
  open, onOpenChange, initialData, roster, onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData: Championship | null;
  roster: Wrestler[];
  onSave: (c: Championship) => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [division, setDivision] = useState("");
  const [active, setActive] = useState(true);
  const [championIds, setChampionIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [wrestlerSearch, setWrestlerSearch] = useState("");

  const { ref: fileRef, open: openFile, handleChange: handleFileChange } = useImageUpload(url => setImageUrl(url));

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setName(initialData.name);
      setBrand(initialData.brand ?? "");
      setDivision(initialData.division ?? "");
      setActive(initialData.active !== false);
      setChampionIds(initialData.currentChampionIds ?? []);
      setNotes(initialData.notes ?? "");
      setImageUrl(initialData.imageUrl);
    } else {
      setName(""); setBrand(""); setDivision(""); setActive(true);
      setChampionIds([]); setNotes(""); setImageUrl(undefined);
    }
    setWrestlerSearch("");
  }, [open, initialData]);

  const sortedRoster = useMemo(() => [...roster].sort((a, b) => a.name.localeCompare(b.name)), [roster]);
  const filteredRoster = sortedRoster.filter(w =>
    !wrestlerSearch || w.name.toLowerCase().includes(wrestlerSearch.toLowerCase())
  );
  const toggleChampion = (id: string) =>
    setChampionIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  function handleSubmit(e: React.FormEvent) {
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
  }

  const BRANDS = [{ value: "", label: "Any" }, { value: "RAW", label: "RAW" }, { value: "SMACKDOWN", label: "SmackDown" }, { value: "NXT", label: "NXT" }];
  const DIVISIONS = [{ value: "", label: "Any" }, { value: "MENS", label: "Men's" }, { value: "WOMENS", label: "Women's" }, { value: "TAG", label: "Tag Team" }];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground sm:max-w-[560px] max-h-[92dvh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{initialData ? "Edit Championship" : "Create Championship"}</DialogTitle>
        <DialogDescription className="sr-only">Manage championship details.</DialogDescription>
        <div className="h-[3px] w-full bg-foreground/20 shrink-0" />
        <div className="px-6 py-4 border-b border-border bg-muted/10 shrink-0">
          <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground mb-0.5">Title Management</div>
          <div className="font-display text-xl uppercase tracking-widest text-foreground">{initialData ? "Edit Championship" : "Create Championship"}</div>
        </div>

        <button type="button" onClick={openFile}
          className="group relative w-full h-32 bg-muted/20 border-b border-border overflow-hidden shrink-0 flex items-center justify-center hover:bg-muted/30 transition-colors">
          {imageUrl
            ? <img src={imageUrl} alt="belt" className="h-full w-full object-contain p-3" />
            : <div className="flex flex-col items-center gap-2">
                <Trophy className="w-10 h-10 text-muted-foreground/20" strokeWidth={0.8} />
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/40">Upload Belt Photo</span>
              </div>
          }
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-7 h-7 text-white" />
            <span className="text-[10px] font-bold tracking-widest uppercase text-white">{imageUrl ? "Change Photo" : "Upload Photo"}</span>
          </div>
          {imageUrl && (
            <button type="button" onClick={e => { e.stopPropagation(); setImageUrl(undefined); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 border border-white/20 flex items-center justify-center hover:bg-black/90 z-10">
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          )}
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

        <form id="champ-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <FieldLabel>Championship Name</FieldLabel>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. WWE Championship"
              className="w-full px-3 py-2.5 bg-background border border-border rounded text-foreground font-display text-base uppercase tracking-wide focus:outline-none focus:ring-1 focus:ring-foreground placeholder:font-sans placeholder:text-sm placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground/30" />
          </div>
          <div>
            <FieldLabel>Brand</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {BRANDS.map(p => <Pill key={p.value} active={brand === p.value} onClick={() => setBrand(p.value)}>{p.label}</Pill>)}
            </div>
          </div>
          <div>
            <FieldLabel>Division</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {DIVISIONS.map(p => <Pill key={p.value} active={division === p.value} onClick={() => setDivision(p.value)}>{p.label}</Pill>)}
            </div>
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <div className="flex gap-2">
              <Pill active={active} onClick={() => setActive(true)}>Active</Pill>
              <Pill active={!active} onClick={() => setActive(false)}>Inactive</Pill>
            </div>
          </div>
          <div>
            <FieldLabel helper="select current holder(s)">Champion</FieldLabel>
            <div className="relative mb-2">
              <input value={wrestlerSearch} onChange={e => setWrestlerSearch(e.target.value)}
                placeholder="Search roster..."
                className="w-full pl-3 pr-3 py-1.5 rounded border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-foreground text-foreground placeholder:text-muted-foreground/40" />
            </div>
            <div className="grid grid-cols-5 gap-2 max-h-44 overflow-y-auto">
              {filteredRoster.map(w => {
                const sel = championIds.includes(w.id);
                return (
                  <button key={w.id} type="button" onClick={() => toggleChampion(w.id)}
                    className={cn("flex flex-col rounded-lg overflow-hidden border-2 transition-all", sel ? "border-foreground" : "border-border hover:border-foreground/40")}>
                    <div className="relative w-full bg-muted/20" style={{ aspectRatio: "3/4" }}>
                      {w.imageUrl
                        ? <img src={w.imageUrl} alt={w.name} className="w-full h-full object-cover object-top" />
                        : <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-muted-foreground/30" /></div>
                      }
                      {sel && <div className="absolute inset-0 bg-black/30 flex items-end justify-end p-1">
                        <span className="w-3.5 h-3.5 rounded-full bg-foreground flex items-center justify-center">
                          <svg viewBox="0 0 10 10" className="w-2 h-2"><path d="M2 5l2.5 2.5L8 3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="black" /></svg>
                        </span>
                      </div>}
                    </div>
                    <div className="px-1 py-0.5 bg-muted/10">
                      <div className="text-[7px] font-bold uppercase tracking-wide text-foreground leading-tight line-clamp-2">{w.name}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <FieldLabel helper="optional">Notes</FieldLabel>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} className="bg-background border-border resize-none text-sm"
              placeholder="History, significance, prestige notes..." />
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between shrink-0 bg-muted/5">
          <button type="button" onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button type="submit" form="champ-form"
            className="px-5 py-2.5 rounded-lg text-[11px] font-bold tracking-widest uppercase bg-foreground text-background hover:bg-foreground/90 transition-colors">
            {initialData ? "Save Changes" : "Create Title"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reign Timeline ───────────────────────────────────────────────────────────

function ReignTimeline({ reigns, roster, universeDate }: {
  reigns: TitleReign[];
  roster: Wrestler[];
  universeDate: UniverseDate;
}) {
  const rosterById = useMemo(() => new Map(roster.map(w => [w.id, w])), [roster]);
  const sorted = [...reigns].sort((a, b) => dateToInt(b.wonDate) - dateToInt(a.wonDate));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border border-border border-dashed rounded-xl">
        <Clock className="w-10 h-10 text-muted-foreground/20 mb-3" strokeWidth={1} />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/40">No Reigns Recorded</p>
        <p className="text-xs text-muted-foreground/30 mt-1">Record the first title change to start this title's legacy.</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sorted.map((reign, i) => {
        const wrestler = reign.wrestlerId ? rosterById.get(reign.wrestlerId) : undefined;
        const isActive = !reign.lostDate;
        const days = reignDays(reign.wonDate, reign.lostDate, universeDate);
        const isVacant = reign.wrestlerName === "VACANT";

        return (
          <div key={reign.id} className="relative flex gap-4">
            <div className="flex flex-col items-center shrink-0 pt-4">
              <div className={cn(
                "w-3 h-3 rounded-full border-2 shrink-0 z-10",
                isActive ? "border-foreground bg-foreground" : "border-muted-foreground/30 bg-card"
              )} />
              {i < sorted.length - 1 && (
                <div className="w-px flex-1 bg-border mt-1" style={{ minHeight: "24px" }} />
              )}
            </div>

            <div className={cn(
              "flex-1 mb-4 pb-4 border-b border-border/50",
              i === sorted.length - 1 && "border-b-0 mb-0 pb-0"
            )}>
              <div className="flex items-start gap-3">
                {!isVacant && (
                  <div className="w-12 h-16 rounded overflow-hidden bg-muted/20 border border-border shrink-0">
                    {wrestler?.imageUrl
                      ? <img src={wrestler.imageUrl} alt={reign.wrestlerName} className="w-full h-full object-cover object-top" />
                      : <div className="w-full h-full flex items-center justify-center"><User className="w-5 h-5 text-muted-foreground/30" /></div>
                    }
                  </div>
                )}
                {isVacant && (
                  <div className="w-12 h-16 rounded border border-dashed border-border bg-muted/10 flex items-center justify-center shrink-0">
                    <Shield className="w-5 h-5 text-muted-foreground/20" strokeWidth={1} />
                  </div>
                )}

                <div className="flex-1 min-w-0 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      "font-display text-sm font-bold uppercase tracking-wide",
                      isVacant ? "text-muted-foreground/60" : "text-foreground"
                    )}>
                      {reign.wrestlerName}
                    </span>
                    {isActive && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border border-foreground/30 text-foreground/70">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground tracking-wide">
                      {dateLabel(reign.wonDate)} {reign.lostDate && `→ ${dateLabel(reign.lostDate)}`}
                    </span>
                    {isActive && !reign.lostDate && (
                      <span className="text-[10px] text-muted-foreground">→ Present</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60">
                      {formatReignLength(days)}
                    </span>
                    {reign.howWon && (
                      <span className="text-[10px] text-muted-foreground/50">via {reign.howWon}</span>
                    )}
                    {reign.wonFrom && reign.wonFrom !== "VACANT" && (
                      <span className="text-[10px] text-muted-foreground/40">from {reign.wonFrom}</span>
                    )}
                    {reign.eventName && (
                      <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground/40">{reign.eventName}</span>
                    )}
                  </div>

                  {reign.notes && (
                    <p className="text-xs text-muted-foreground/60 mt-1.5 italic leading-relaxed">
                      {reign.notes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Records & Milestones ─────────────────────────────────────────────────────

function RecordsView({ championships, reigns, universeDate }: {
  championships: Championship[];
  reigns: TitleReign[];
  universeDate: UniverseDate;
}) {
  const records = useMemo(() => {
    const nonVacant = reigns.filter(r => r.wrestlerName !== "VACANT");
    if (nonVacant.length === 0) return null;

    const withDays = nonVacant.map(r => ({
      ...r,
      days: reignDays(r.wonDate, r.lostDate, universeDate),
    }));

    const longest = [...withDays].sort((a, b) => b.days - a.days)[0];
    const shortest = [...withDays].filter(r => r.lostDate).sort((a, b) => a.days - b.days)[0];

    const winCounts: Record<string, { name: string; count: number }> = {};
    for (const r of nonVacant) {
      const key = r.wrestlerName;
      if (!winCounts[key]) winCounts[key] = { name: key, count: 0 };
      winCounts[key].count++;
    }
    const mostWins = Object.values(winCounts).sort((a, b) => b.count - a.count)[0];

    const activeReigns = withDays.filter(r => !r.lostDate).sort((a, b) => b.days - a.days);
    const longestActive = activeReigns[0];

    return { longest, shortest, mostWins, longestActive, totalReigns: nonVacant.length };
  }, [reigns, universeDate]);

  const champMap = useMemo(() => new Map(championships.map(c => [c.id, c])), [championships]);

  if (!records) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <BarChart3 className="w-14 h-14 text-muted-foreground/20 mb-4" strokeWidth={1} />
        <p className="text-lg font-display font-bold uppercase tracking-widest text-muted-foreground/40">No Records Yet</p>
        <p className="text-sm text-muted-foreground/30 mt-1 max-w-xs">Record title changes in the championship timeline to generate milestone records.</p>
      </div>
    );
  }

  const cards: { label: string; value: string; sub?: string; note?: string }[] = [
    {
      label: "Longest Reign",
      value: records.longest.wrestlerName,
      sub: formatReignLength(records.longest.days),
      note: champMap.get(records.longest.championshipId)?.name,
    },
    records.shortest ? {
      label: "Shortest Reign",
      value: records.shortest.wrestlerName,
      sub: formatReignLength(records.shortest.days),
      note: champMap.get(records.shortest.championshipId)?.name,
    } : null,
    records.mostWins.count > 1 ? {
      label: "Most Title Wins",
      value: records.mostWins.name,
      sub: `${records.mostWins.count} reigns`,
      note: "Across all championships",
    } : null,
    records.longestActive ? {
      label: "Longest Active Reign",
      value: records.longestActive.wrestlerName,
      sub: `${formatReignLength(records.longestActive.days)} and counting`,
      note: champMap.get(records.longestActive.championshipId)?.name,
    } : null,
    {
      label: "Total Title Changes",
      value: String(records.totalReigns),
      sub: `across ${championships.length} title${championships.length !== 1 ? "s" : ""}`,
    },
  ].filter(Boolean) as { label: string; value: string; sub?: string; note?: string }[];

  return (
    <div className="space-y-6">
      <SectionLabel label="Records and Milestones" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-2">
            <div className="text-[9px] font-bold tracking-[0.25em] uppercase text-muted-foreground/50">{card.label}</div>
            <div className="font-display text-xl font-bold uppercase tracking-wide text-foreground leading-tight">{card.value}</div>
            {card.sub && <div className="text-xs font-bold tracking-widest uppercase text-muted-foreground/60">{card.sub}</div>}
            {card.note && <div className="text-[10px] text-muted-foreground/40 tracking-wide">{card.note}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Legacy Component ────────────────────────────────────────────────────

type LegacyView = "showcase" | "records" | "detail";

export function Legacy() {
  const [championships, setChampionships] = useChampionships();
  const [titleReigns, setTitleReigns] = useTitleReigns();
  const [roster] = useRoster();
  const [universeDate] = useUniverseDate();

  const [view, setView] = useState<LegacyView>("showcase");
  const [selectedChampId, setSelectedChampId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingChamp, setEditingChamp] = useState<Championship | null>(null);
  const [recordChangeOpen, setRecordChangeOpen] = useState(false);

  const selectedChamp = useMemo(
    () => championships.find(c => c.id === selectedChampId) ?? null,
    [championships, selectedChampId]
  );
  const selectedReigns = useMemo(
    () => titleReigns.filter(r => r.championshipId === selectedChampId),
    [titleReigns, selectedChampId]
  );

  const rosterById = useMemo(() => new Map(roster.map(w => [w.id, w])), [roster]);

  function champDisplayName(c: Championship): string {
    const ids = c.currentChampionIds ?? [];
    if (ids.length === 0) return "VACANT";
    return ids.map(id => rosterById.get(id)?.name ?? "Unknown").join(" & ").toUpperCase();
  }

  function champCurrentReignDays(c: Championship): number {
    const active = titleReigns.find(r => r.championshipId === c.id && !r.lostDate);
    if (!active) return 0;
    return reignDays(active.wonDate, undefined, universeDate);
  }

  function handleSaveChampionship(c: Championship) {
    setChampionships(prev => {
      const idx = prev.findIndex(x => x.id === c.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = c;
        return next;
      }
      return [...prev, c];
    });
    setFormOpen(false);
    toast.success(editingChamp ? "Championship updated" : "Championship created");
    setEditingChamp(null);
  }

  function handleDeleteChampionship(id: string) {
    if (!confirm("Remove this championship? All reign history will be lost.")) return;
    setChampionships(prev => prev.filter(c => c.id !== id));
    setTitleReigns(prev => prev.filter(r => r.championshipId !== id));
    if (selectedChampId === id) {
      setView("showcase");
      setSelectedChampId(null);
    }
    toast.success("Championship removed");
  }

  function handleTitleChange(newReigns: TitleReign[], updatedChamp: Championship) {
    setTitleReigns(newReigns);
    setChampionships(prev => prev.map(c => c.id === updatedChamp.id ? updatedChamp : c));
  }

  function openDetail(champId: string) {
    setSelectedChampId(champId);
    setView("detail");
  }

  function goBack() {
    setView("showcase");
    setSelectedChampId(null);
  }

  const activeChampionships = useMemo(() => championships.filter(c => c.active !== false), [championships]);
  const inactiveChampionships = useMemo(() => championships.filter(c => c.active === false), [championships]);

  return (
    <div className="relative w-full max-w-5xl mx-auto h-full flex flex-col pb-10">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <img
          src={legacyBackdrop}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/60" />
      </div>

      {view !== "detail" && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
          <div>
            <div className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground/50 mb-1">Universe Records</div>
            <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Legacy</h1>
            <p className="text-muted-foreground mt-1 text-sm">Championship history — prestige, title reigns, and records.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setEditingChamp(null); setFormOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-foreground text-background text-[11px] font-bold tracking-widest uppercase hover:bg-foreground/90 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Championship
            </button>
          </div>
        </div>
      )}

      {view !== "detail" && (
        <div className="flex gap-1 mb-6 bg-muted/20 rounded-xl border border-border p-1 w-fit relative z-10 backdrop-blur-sm">
          {(["showcase", "records"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold tracking-widest uppercase transition-all flex items-center gap-2",
                view === v ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}>
              {v === "showcase" ? <Trophy className="w-3.5 h-3.5" /> : <BarChart3 className="w-3.5 h-3.5" />}
              {v === "showcase" ? "Titles" : "Records"}
            </button>
          ))}
        </div>
      )}

      {view === "showcase" && (
        <div className="space-y-8 relative z-10">
          {championships.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-16 text-center border border-border border-dashed rounded-xl">
              <Trophy className="w-16 h-16 text-muted-foreground/20 mb-4" strokeWidth={1} />
              <h3 className="text-xl font-display uppercase tracking-widest text-foreground mb-2">No Championships</h3>
              <p className="text-muted-foreground max-w-sm mb-6 text-sm leading-relaxed">
                Legacy tracks the prestige and history of every title in your universe. Start by creating your first championship.
              </p>
              <button
                type="button"
                onClick={() => { setEditingChamp(null); setFormOpen(true); }}
                className="px-5 py-2.5 rounded-lg border border-foreground/40 text-[11px] font-bold tracking-widest uppercase text-foreground hover:bg-foreground/5 transition-colors"
              >
                Create Your First Championship
              </button>
            </div>
          ) : (
            <>
              {activeChampionships.length > 0 && (
                <div>
                  <SectionLabel label={`Active Titles — ${activeChampionships.length}`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeChampionships.map(c => (
                      <ChampionshipCard
                        key={c.id}
                        championship={c}
                        champName={champDisplayName(c)}
                        reignDaysCount={champCurrentReignDays(c)}
                        reignCount={titleReigns.filter(r => r.championshipId === c.id && r.wrestlerName !== "VACANT").length}
                        onClick={() => openDetail(c.id)}
                        onEdit={() => { setEditingChamp(c); setFormOpen(true); }}
                        onDelete={() => handleDeleteChampionship(c.id)}
                        onToggleActive={() => {
                          setChampionships(prev => prev.map(x => x.id === c.id ? { ...x, active: false } : x));
                          toast.success("Championship set inactive");
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {inactiveChampionships.length > 0 && (
                <div>
                  <SectionLabel label={`Inactive Titles — ${inactiveChampionships.length}`} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 opacity-50">
                    {inactiveChampionships.map(c => (
                      <ChampionshipCard
                        key={c.id}
                        championship={c}
                        champName={champDisplayName(c)}
                        reignDaysCount={0}
                        reignCount={titleReigns.filter(r => r.championshipId === c.id && r.wrestlerName !== "VACANT").length}
                        onClick={() => openDetail(c.id)}
                        onEdit={() => { setEditingChamp(c); setFormOpen(true); }}
                        onDelete={() => handleDeleteChampionship(c.id)}
                        onToggleActive={() => {
                          setChampionships(prev => prev.map(x => x.id === c.id ? { ...x, active: true } : x));
                          toast.success("Championship reactivated");
                        }}
                        inactive
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "records" && (
        <RecordsView
          championships={championships}
          reigns={titleReigns}
          universeDate={universeDate}
        />
      )}

      {view === "detail" && selectedChamp && (
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-4">
            <button type="button" onClick={goBack}
              className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-3.5 h-3.5" />
              All Titles
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex flex-col sm:flex-row gap-0">
              <div className="w-full sm:w-48 h-40 sm:h-auto bg-muted/20 border-b sm:border-b-0 sm:border-r border-border flex items-center justify-center shrink-0 p-4">
                {selectedChamp.imageUrl
                  ? <img src={selectedChamp.imageUrl} alt={selectedChamp.name} className="max-h-full object-contain" />
                  : <Trophy className="w-20 h-20 text-muted-foreground/15" strokeWidth={0.8} />
                }
              </div>
              <div className="flex-1 p-6 flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {selectedChamp.brand && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-border text-muted-foreground">
                        {brandLabel(selectedChamp.brand)}
                      </span>
                    )}
                    {selectedChamp.division && (
                      <span className="text-[9px] font-bold tracking-widest uppercase px-2 py-0.5 rounded border border-border text-muted-foreground">
                        {selectedChamp.division}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-widest text-foreground">{selectedChamp.name}</h2>
                  <div className="mt-2">
                    <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Current Champion</span>
                    <p className="font-display text-lg font-bold uppercase tracking-wide text-foreground mt-0.5">
                      {champDisplayName(selectedChamp)}
                    </p>
                    {champCurrentReignDays(selectedChamp) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatReignLength(champCurrentReignDays(selectedChamp))} into reign
                      </p>
                    )}
                  </div>
                  {selectedChamp.notes && (
                    <p className="text-xs text-muted-foreground/60 mt-3 italic leading-relaxed">{selectedChamp.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setRecordChangeOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-foreground text-background text-[11px] font-bold tracking-widest uppercase hover:bg-foreground/90 transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    Record Title Change
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button"
                        className="w-9 h-9 rounded border border-border bg-muted/20 flex items-center justify-center hover:bg-muted/40 transition-colors">
                        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="gap-2" onClick={() => { setEditingChamp(selectedChamp); setFormOpen(true); }}>
                        <Edit2 className="w-3.5 h-3.5" /> Edit Championship
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={() => handleDeleteChampionship(selectedChamp.id)}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete Championship
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          </div>

          <div>
            <SectionLabel label={`Title History — ${selectedReigns.filter(r => r.wrestlerName !== "VACANT").length} reign${selectedReigns.filter(r => r.wrestlerName !== "VACANT").length !== 1 ? "s" : ""}`} />
            <ReignTimeline reigns={selectedReigns} roster={roster} universeDate={universeDate} />
          </div>
        </div>
      )}

      <ChampionshipFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initialData={editingChamp}
        roster={roster}
        onSave={handleSaveChampionship}
      />

      {selectedChamp && (
        <RecordTitleChangeDialog
          open={recordChangeOpen}
          onOpenChange={setRecordChangeOpen}
          championship={selectedChamp}
          roster={roster}
          universeDate={universeDate}
          currentReigns={titleReigns}
          onSave={handleTitleChange}
        />
      )}
    </div>
  );
}

// ─── Championship Card ────────────────────────────────────────────────────────

function ChampionshipCard({
  championship, champName, reignDaysCount, reignCount,
  onClick, onEdit, onDelete, onToggleActive, inactive,
}: {
  championship: Championship;
  champName: string;
  reignDaysCount: number;
  reignCount: number;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  inactive?: boolean;
}) {
  const isVacant = champName === "VACANT";
  return (
    <DropdownMenu>
      <div className="relative group/card">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "w-full text-left bg-card border rounded-xl flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-foreground/25",
            "border-border"
          )}
        >
          <div className="h-28 flex items-center justify-center bg-muted/20 border-b border-border relative">
            {championship.imageUrl
              ? <img src={championship.imageUrl} alt={championship.name} className="h-full w-full object-contain p-4" />
              : <Trophy className="w-12 h-12 text-foreground/15" strokeWidth={1} />
            }
            {inactive && (
              <span className="absolute top-2 left-2 text-[9px] px-1.5 py-0.5 rounded font-bold tracking-widest uppercase border border-border text-muted-foreground bg-background/80">
                INACTIVE
              </span>
            )}
          </div>
          <div className="p-4 flex flex-col gap-2 flex-1">
            <h3 className="font-display font-bold text-sm uppercase tracking-wide text-foreground leading-tight line-clamp-2">{championship.name}</h3>
            <div className="flex flex-wrap gap-1">
              {championship.brand && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground">
                  {brandLabel(championship.brand)}
                </span>
              )}
              {championship.division && (
                <span className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider uppercase border border-border text-muted-foreground">
                  {championship.division}
                </span>
              )}
            </div>
            <div className="mt-auto pt-2 border-t border-border">
              <span className="text-[9px] font-bold tracking-widest uppercase text-muted-foreground/50">Champion</span>
              <p className={cn(
                "text-sm font-display font-bold uppercase tracking-wide mt-0.5 leading-tight",
                isVacant ? "text-muted-foreground/50" : "text-foreground"
              )}>
                {champName}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {reignDaysCount > 0 && (
                  <span className="text-[9px] text-muted-foreground/40 tracking-wide">{formatReignLength(reignDaysCount)}</span>
                )}
                {reignCount > 0 && (
                  <span className="text-[9px] text-muted-foreground/30 tracking-wide">{reignCount} reign{reignCount !== 1 ? "s" : ""} recorded</span>
                )}
              </div>
            </div>
          </div>
        </button>

        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={e => e.stopPropagation()}
            className={cn(
              "absolute top-2 right-2 z-20 w-7 h-7 rounded-md flex items-center justify-center",
              "bg-background/85 backdrop-blur-sm border border-border text-foreground",
              "opacity-0 group-hover/card:opacity-100 focus:opacity-100 transition-opacity",
              "[@media(hover:none)]:opacity-100"
            )}
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem className="gap-2" onClick={onClick}>
            <Clock className="w-3.5 h-3.5" /> View History
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={onEdit}>
            <Edit2 className="w-3.5 h-3.5" /> Edit Championship
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={onToggleActive}>
            <Shield className="w-3.5 h-3.5" /> {inactive ? "Set Active" : "Set Inactive"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" /> Delete Championship
          </DropdownMenuItem>
        </DropdownMenuContent>
      </div>
    </DropdownMenu>
  );
}
