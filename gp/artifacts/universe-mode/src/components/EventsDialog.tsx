import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Plus, Edit2, Trash2, Camera, X } from "lucide-react";
import { toast } from "sonner";
import {
  MONTH_LABELS,
  DAY_FULL,
  formatDate,
  weeksUntil,
  upcomingEvents as sortUpcoming,
  type PremiumEvent,
  type UniverseDate,
} from "@/lib/calendar";

function useImageUpload(onLoad: (url: string) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const open = () => ref.current?.click();
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    if (file.size > 4 * 1024 * 1024) { toast.error("Image is too large (max 4 MB)"); return; }
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === "string") onLoad(reader.result); };
    reader.onerror = () => toast.error("Could not read image");
    reader.readAsDataURL(file);
    e.target.value = "";
  };
  return { ref, open, handleChange };
}

const EVENT_CAP = 8;

export function EventsDialog({
  open,
  onOpenChange,
  events,
  setEvents,
  currentDate,
  externalEditing,
  prefillDate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  events: PremiumEvent[];
  setEvents: (next: PremiumEvent[] | ((prev: PremiumEvent[]) => PremiumEvent[])) => void;
  currentDate: UniverseDate;
  externalEditing?: PremiumEvent | null;
  prefillDate?: { month: number; week: number; day: number };
}) {
  const [editing, setEditing] = useState<PremiumEvent | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (externalEditing !== undefined) {
      setEditing(externalEditing);
      setAdding(false);
    } else if (prefillDate) {
      setEditing(null);
      setAdding(true);
    } else {
      setEditing(null);
      setAdding(false);
    }
  }, [open, externalEditing, prefillDate]);

  const sorted = sortUpcoming(events, currentDate);

  const handleSave = (next: PremiumEvent) => {
    if (editing) {
      setEvents((prev) => prev.map((e) => (e.id === editing.id ? next : e)));
      toast.success("Event updated");
    } else {
      if (events.length >= EVENT_CAP) {
        toast.error("Event slate is full", { description: `Max ${EVENT_CAP} premium events at a time.` });
        return;
      }
      setEvents((prev) => [...prev, next]);
      toast.success("Event added");
    }
    setEditing(null);
    setAdding(false);
  };

  const handleDelete = (e: PremiumEvent) => {
    if (!confirm(`Remove ${e.name}?`)) return;
    setEvents((prev) => prev.filter((x) => x.id !== e.id));
    toast.success("Event removed");
  };

  const showingForm = adding || editing !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display uppercase tracking-widest flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Premium Events
          </DialogTitle>
        </DialogHeader>

        {showingForm ? (
          <EventForm
            initialData={editing}
            prefillDate={editing ? undefined : prefillDate}
            onSave={handleSave}
            onCancel={() => {
              setEditing(null);
              setAdding(false);
            }}
          />
        ) : (
          <div className="pt-2">
            {sorted.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-border rounded-lg">
                <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">No premium events yet.</p>
                <Button
                  onClick={() => setAdding(true)}
                  variant="outline"
                  className="border-foreground/40 text-foreground"
                >
                  <Plus className="w-4 h-4 mr-2" /> ADD FIRST EVENT
                </Button>
              </div>
            ) : (
              <>
                <ul className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                  {sorted.map((e) => {
                    const w = weeksUntil(e, currentDate);
                    const out =
                      w === 0 ? "THIS WEEK" : w === 1 ? "1 WEEK OUT" : `${w} WEEKS OUT`;
                    return (
                      <li
                        key={e.id}
                        className="group flex items-start gap-3 p-3 rounded-lg border border-border bg-background/40 hover:border-foreground/30 transition-colors"
                      >
                        {e.imageUrl ? (
                          <div
                            className="w-12 h-12 rounded shrink-0 bg-cover bg-center bg-muted/30 border border-border"
                            style={{ backgroundImage: `url(${e.imageUrl})` }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded shrink-0 bg-muted/20 border border-border flex items-center justify-center">
                            <Image className="w-4 h-4 text-muted-foreground/30" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-display font-bold uppercase tracking-wider text-sm leading-tight truncate">
                            {e.name}
                          </div>
                          <div className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground mt-1">
                            {formatDate(e)}
                          </div>
                          {e.notes && (
                            <p className="text-xs text-muted-foreground/80 mt-1.5 italic line-clamp-2">
                              {e.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className="text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 border border-border rounded bg-muted/30 text-foreground">
                            {out}
                          </span>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditing(e)}
                              className="p-1 text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${e.name}`}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(e)}
                              className="p-1 text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${e.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                    {events.length} / {EVENT_CAP} EVENTS
                  </span>
                  <Button
                    onClick={() => setAdding(true)}
                    disabled={events.length >= EVENT_CAP}
                    className="bg-foreground text-background hover:bg-foreground/90"
                  >
                    <Plus className="w-4 h-4 mr-2" /> ADD EVENT
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {!showingForm && (
          <DialogFooter className="pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              CLOSE
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EventForm({
  initialData,
  prefillDate,
  onSave,
  onCancel,
}: {
  initialData: PremiumEvent | null;
  prefillDate?: { month: number; week: number; day: number };
  onSave: (e: PremiumEvent) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [month, setMonth] = useState(initialData?.month ?? prefillDate?.month ?? 1);
  const [week, setWeek] = useState(initialData?.week ?? prefillDate?.week ?? 1);
  const [day, setDay] = useState(initialData?.day ?? prefillDate?.day ?? 6);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [imageUrl, setImageUrl] = useState<string | undefined>(initialData?.imageUrl);
  const { ref: fileRef, open: openFile, handleChange: handleFileChange } = useImageUpload((url) => setImageUrl(url));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Event needs a name");
      return;
    }
    onSave({
      id: initialData?.id ?? crypto.randomUUID(),
      name: trimmed,
      month,
      week,
      day,
      notes: notes.trim() || undefined,
      imageUrl: imageUrl || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-3">
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Event Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="bg-background border-border"
          placeholder="e.g. Royal Rumble, WrestleMania"
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Month
          </label>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground/40"
          >
            {MONTH_LABELS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Week
          </label>
          <select
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground/40"
          >
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Day
          </label>
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-foreground/40"
          >
            {DAY_FULL.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Event Photo */}
      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Event Photo (optional)
        </label>
        <button
          type="button"
          onClick={openFile}
          className="relative w-full h-28 rounded-md overflow-hidden border border-border bg-muted/20 group flex items-center justify-center hover:border-foreground/40 transition-colors"
        >
          {imageUrl ? (
            <>
              <img
                src={imageUrl}
                alt="Event preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Camera className="w-5 h-5 text-white" />
                <span className="text-xs font-bold tracking-wider uppercase text-white">Change Photo</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
              <Camera className="w-6 h-6" />
              <span className="text-[11px] font-bold tracking-wider uppercase">Click to upload photo</span>
            </div>
          )}
        </button>
        {imageUrl && (
          <button
            type="button"
            onClick={() => setImageUrl(undefined)}
            className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="w-3 h-3" /> Remove photo
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
          Notes (optional)
        </label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="bg-background resize-none h-20"
          placeholder="What's the hook? Big match. Tournament. Chamber. Helps the AI build toward it."
        />
      </div>

      <DialogFooter className="pt-4 border-t border-border">
        <Button type="button" variant="ghost" onClick={onCancel}>
          CANCEL
        </Button>
        <Button type="submit" className="bg-foreground text-background hover:bg-foreground/90">
          SAVE
        </Button>
      </DialogFooter>
    </form>
  );
}
