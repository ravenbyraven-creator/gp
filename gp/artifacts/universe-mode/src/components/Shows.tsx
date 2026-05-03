import { useRef, useState } from "react";
import { useShows, useRoster } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, Edit2, Tv, Upload, X, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { type Show } from "@workspace/api-client-react";
import { toast } from "sonner";

const NIGHTS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function makeId(name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || `show-${Date.now()}`;
}

export function Shows() {
  const [shows, setShows] = useShows();
  const [roster] = useRoster();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Show | null>(null);
  const [open, setOpen] = useState(false);

  const filtered = shows.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleSave = (next: Show) => {
    if (editing) {
      setShows(shows.map(s => s.id === editing.id ? next : s));
      toast.success("Show updated");
    } else {
      if (shows.some(s => s.id === next.id)) {
        toast.error("A show with that name already exists");
        return;
      }
      setShows([...shows, next]);
      toast.success("Show added");
    }
    setOpen(false);
  };

  const handleDelete = (s: Show) => {
    const onShow = roster.filter(w => w.showId === s.id).length;
    const msg = onShow > 0
      ? `Remove ${s.name}? ${onShow} wrestler${onShow === 1 ? "" : "s"} will become Free Agent.`
      : `Remove ${s.name}?`;
    if (!confirm(msg)) return;
    setShows(shows.filter(x => x.id !== s.id));
    toast.success("Show removed");
  };

  return (
    <div className="w-full max-w-5xl mx-auto h-full flex flex-col pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-display font-bold uppercase tracking-widest text-foreground">Shows</h1>
          <p className="text-muted-foreground mt-1">Define the brands you run. The AI uses these to keep storylines on-brand.</p>
        </div>
        <Button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="bg-foreground hover:bg-foreground/90 text-background font-bold tracking-wider uppercase"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Show
        </Button>
      </div>

      <div className="mb-6 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search shows..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-background/50 border-border"
          />
        </div>
      </div>

      {shows.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border border-border rounded-xl bg-card border-dashed">
          <Tv className="w-16 h-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-xl font-display uppercase tracking-widest text-foreground mb-2">No Shows Yet</h3>
          <p className="text-muted-foreground max-w-md mb-6">Add your first brand to start themeing your roster cards and giving Creative more context.</p>
          <Button onClick={() => { setEditing(null); setOpen(true); }} variant="outline" className="border-foreground text-foreground hover:bg-foreground/5">
            <Plus className="w-4 h-4 mr-2" /> ADD FIRST SHOW
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
          {filtered.map(s => {
            const count = roster.filter(w => w.showId === s.id).length;
            return (
              <div key={s.id} className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-foreground/40 transition-all flex flex-col">
                <div className="relative aspect-[16/9] w-full bg-muted/40 overflow-hidden">
                  {s.imageUrl ? (
                    <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-10 h-10 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={() => { setEditing(s); setOpen(true); }}
                      className="p-1.5 text-foreground bg-background/80 backdrop-blur-sm hover:bg-background rounded border border-border"
                      aria-label={`Edit ${s.name}`}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(s)}
                      className="p-1.5 text-foreground hover:text-destructive bg-background/80 backdrop-blur-sm hover:bg-background rounded border border-border"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="p-4 flex flex-col gap-2 flex-1">
                  <h3 className="font-display font-bold text-lg uppercase tracking-wide leading-tight">{s.name}</h3>
                  <div className="flex flex-wrap gap-1.5 text-[10px] font-bold tracking-wider uppercase">
                    {s.night && (
                      <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-muted/30">{s.night}</span>
                    )}
                    <span className="px-1.5 py-0.5 rounded border border-border text-muted-foreground bg-muted/30">
                      {count} {count === 1 ? "wrestler" : "wrestlers"}
                    </span>
                  </div>
                  {s.vibe && (
                    <p className="text-xs text-muted-foreground line-clamp-3 italic leading-relaxed">{s.vibe}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ShowDialog
        open={open}
        onOpenChange={setOpen}
        initialData={editing}
        existingIds={shows.map(s => s.id)}
        onSave={handleSave}
      />
    </div>
  );
}

function ShowDialog({
  open,
  onOpenChange,
  initialData,
  existingIds,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialData: Show | null;
  existingIds: string[];
  onSave: (s: Show) => void;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [night, setNight] = useState(initialData?.night ?? "");
  const [vibe, setVibe] = useState(initialData?.vibe ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialData?.imageUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (open && initialData && name !== initialData.name) {
    setName(initialData.name);
    setNight(initialData.night ?? "");
    setVibe(initialData.vibe ?? "");
    setImageUrl(initialData.imageUrl);
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 3 * 1024 * 1024) { toast.error("Image is too large (max 3MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") setImageUrl(reader.result); };
    reader.onerror = () => toast.error("Could not read image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = initialData?.id ?? makeId(trimmed);
    if (!initialData && existingIds.includes(id)) {
      toast.error("A show with that name already exists");
      return;
    }
    onSave({
      id,
      name: trimmed,
      night: night || undefined,
      vibe: vibe.trim() || undefined,
      imageUrl,
    });
    if (!initialData) { setName(""); setNight(""); setVibe(""); setImageUrl(undefined); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest">
            {initialData ? "Edit Show" : "Add Show"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Show Image</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-32 aspect-[16/9] rounded-md overflow-hidden bg-muted/50 border border-border flex items-center justify-center hover:border-foreground/50 transition-colors shrink-0"
                aria-label="Upload show image"
              >
                {imageUrl ? (
                  <img src={imageUrl} alt="show" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-6 h-6 text-muted-foreground/60" />
                )}
              </button>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-3.5 h-3.5 mr-2" /> {imageUrl ? "Change" : "Upload"}
                </Button>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(undefined)}>
                    <X className="w-3.5 h-3.5 mr-2" /> Remove
                  </Button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Show Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} required className="bg-background border-border" placeholder="e.g. Monday Night Raw" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Night</label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setNight("")} className={`text-[10px] px-2 py-1 rounded font-bold tracking-wider uppercase border ${!night ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground"}`}>Any</button>
              {NIGHTS.map(n => (
                <button key={n} type="button" onClick={() => setNight(n)} className={`text-[10px] px-2 py-1 rounded font-bold tracking-wider uppercase border ${night === n ? "bg-foreground text-background border-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>
                  {n.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">Vibe / Booking Style</label>
            <Textarea
              value={vibe}
              onChange={e => setVibe(e.target.value)}
              className="bg-background resize-none h-24"
              placeholder="What's this show about? Long-form storytelling? Hardcore-leaning? Helps the AI keep storylines on-brand."
            />
          </div>

          <DialogFooter className="pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>CANCEL</Button>
            <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">SAVE</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
