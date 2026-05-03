import { useState } from "react";
import {
  useHistory, useRivalries, useMemories, useRoster,
  useChampionships, useStables, useUniverseDate,
  type RivalryEntry,
} from "@/lib/storage";
import type { Memory, Rivalry } from "@/lib/rivalry";
import { rivalryDisplayTitle } from "@/lib/rivalry";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { NotebookPen, Link2 } from "lucide-react";

interface CaptureCanonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillRivalryId?: string;
}

export function CaptureCanonDialog({ open, onOpenChange, prefillRivalryId }: CaptureCanonDialogProps) {
  const [roster] = useRoster();
  const [rivalries, setRivalries] = useRivalries();
  const [, setHistory] = useHistory();
  const [, setMemories] = useMemories();
  const [championships] = useChampionships();
  const [stables] = useStables();
  const [universeDate] = useUniverseDate();

  const [title, setTitle] = useState("");
  const [participants, setParticipants] = useState("");
  const [beat, setBeat] = useState("");
  const [headline, setHeadline] = useState("");
  const [linkedRivalryId, setLinkedRivalryId] = useState(prefillRivalryId ?? "");
  const [linkedChampionshipId, setLinkedChampionshipId] = useState("");
  const [linkedStableId, setLinkedStableId] = useState("");
  const [linkedWrestlerId, setLinkedWrestlerId] = useState("");

  const activeRivalries = rivalries.filter((r: Rivalry) => r.status === "ACTIVE");
  const activeChampionships = championships.filter((c) => c.active !== false);
  const activeStables = stables.filter((s) => s.status !== "DISBANDED");

  function reset() {
    setTitle("");
    setParticipants("");
    setBeat("");
    setHeadline("");
    setLinkedRivalryId(prefillRivalryId ?? "");
    setLinkedChampionshipId("");
    setLinkedStableId("");
    setLinkedWrestlerId("");
  }

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function handleSave() {
    const trimTitle = title.trim();
    const trimBeat = beat.trim();
    if (!trimTitle || !trimBeat) {
      toast.error("Title and story beat are required.");
      return;
    }

    const parsedParticipants = participants.split(",").map((p) => p.trim()).filter(Boolean);
    const wrestler = roster.find((w) => w.id === linkedWrestlerId);
    if (wrestler && !parsedParticipants.includes(wrestler.name)) {
      parsedParticipants.push(wrestler.name);
    }

    const resolvedHeadline =
      headline.trim() || trimTitle.toUpperCase().replace(/[.!?]+$/g, "").slice(0, 80);

    const entryId = crypto.randomUUID();
    const newEntry: RivalryEntry = {
      kind: "storyline",
      id: entryId,
      createdAt: Date.now(),
      universeDate,
      data: {
        kind: "storyline",
        title: "STORYLINE",
        stamp: "CANON LOCKED",
        feud: trimTitle.toUpperCase(),
        participants: parsedParticipants,
        beats: [{ label: "CANON", text: trimBeat }],
        headline: resolvedHeadline.toUpperCase(),
      },
    };

    setHistory((prev) => [newEntry, ...prev]);

    if (linkedRivalryId) {
      const memoryEntry: Memory = {
        id: crypto.randomUUID(),
        rivalryId: linkedRivalryId,
        text: trimBeat,
        date: universeDate,
        source: "manual",
      };
      setMemories((prev) => [memoryEntry, ...prev]);
      setRivalries((prev) =>
        prev.map((r) =>
          r.id === linkedRivalryId
            ? { ...r, historyEntryIds: [...(r.historyEntryIds ?? []), entryId], lastActivityDate: universeDate }
            : r
        )
      );
    }

    reset();
    onOpenChange(false);

    const linkedRivalry = activeRivalries.find((r) => r.id === linkedRivalryId);
    const linkedChamp = activeChampionships.find((c) => c.id === linkedChampionshipId);
    const linkedStable = activeStables.find((s) => s.id === linkedStableId);
    const parts: string[] = [];
    if (linkedRivalry) parts.push(`filed to ${rivalryDisplayTitle(linkedRivalry, roster)}`);
    if (linkedChamp) parts.push(linkedChamp.name);
    if (linkedStable) parts.push(linkedStable.name);

    toast.success("Canon moment saved", {
      description: parts.length > 0
        ? `Saved to history and ${parts.join(", ")}.`
        : "Saved to history. File it to a rivalry if it belongs to a feud.",
    });
  }

  const selectCls = "w-full bg-card border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-foreground/40 transition-colors";
  const labelCls = "text-[10px] font-bold tracking-wider uppercase text-muted-foreground";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-lg w-full bg-card border-border">
        <div className="flex items-center gap-3 mb-1">
          <NotebookPen className="w-5 h-5 text-foreground/60 shrink-0" />
          <DialogTitle className="font-display text-lg font-bold uppercase tracking-widest text-foreground">
            Capture Canon
          </DialogTitle>
        </div>
        <DialogDescription className="text-sm text-muted-foreground mb-4">
          Lock a story moment into your universe. It feeds the AI, the dashboard, and the news.
        </DialogDescription>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={labelCls}>Moment Title <span className="text-destructive">*</span></label>
              <Input
                placeholder="e.g. Cody refuses Roman's offer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background/50 border-border"
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelCls}>Participants</label>
              <Input
                placeholder="Cody Rhodes, Roman Reigns"
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className="bg-background/50 border-border"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>Story Beat <span className="text-destructive">*</span></label>
            <Textarea
              placeholder="Describe what happened. This is what the AI will remember as canon."
              value={beat}
              onChange={(e) => setBeat(e.target.value)}
              rows={3}
              className="bg-background/50 border-border resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className={labelCls}>News Ticker Headline <span className="text-muted-foreground/40 font-normal normal-case">(optional)</span></label>
            <Input
              placeholder="Auto-generated from title if blank"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              className="bg-background/50 border-border"
            />
          </div>

          <div className="border-t border-border pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-3.5 h-3.5 text-muted-foreground/60" />
              <span className="text-[10px] font-bold tracking-wider uppercase text-muted-foreground">
                Connect to (optional)
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelCls}>Rivalry</label>
                <select
                  value={linkedRivalryId}
                  onChange={(e) => setLinkedRivalryId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— None —</option>
                  {activeRivalries.map((r) => (
                    <option key={r.id} value={r.id}>
                      {rivalryDisplayTitle(r, roster)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Wrestler</label>
                <select
                  value={linkedWrestlerId}
                  onChange={(e) => setLinkedWrestlerId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— None —</option>
                  {[...roster].sort((a, b) => a.name.localeCompare(b.name)).map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Championship</label>
                <select
                  value={linkedChampionshipId}
                  onChange={(e) => setLinkedChampionshipId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— None —</option>
                  {activeChampionships.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className={labelCls}>Stable / Faction</label>
                <select
                  value={linkedStableId}
                  onChange={(e) => setLinkedStableId(e.target.value)}
                  className={selectCls}
                >
                  <option value="">— None —</option>
                  {activeStables.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {linkedRivalryId && (
              <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">
                This moment will be added to the rivalry timeline and shown on the dashboard.
              </p>
            )}
          </div>
        </div>

        <div className="flex gap-3 justify-end mt-2 pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || !beat.trim()}
            className={cn(
              "font-bold tracking-wider uppercase",
              title.trim() && beat.trim()
                ? "bg-foreground hover:bg-foreground/90 text-background"
                : "opacity-50"
            )}
          >
            Lock It In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
