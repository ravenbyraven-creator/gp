import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { Rumor } from "@/lib/news";
import { formatDate } from "@/lib/calendar";
import { cn } from "@/lib/utils";

interface RumorViewProps {
  rumor: Rumor | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RumorView({ rumor, open, onOpenChange }: RumorViewProps) {
  if (!rumor) return null;
  const paragraphs = rumor.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-w-[640px] w-full p-0 overflow-hidden",
          "bg-[#f4ecd8] text-black border-0 rounded-none",
          "shadow-[0_30px_80px_rgba(0,0,0,0.6)]",
        )}
        style={{
          backgroundImage: "url('/news/paper.svg')",
          backgroundSize: "400px 400px",
          transform: "rotate(-0.6deg)",
        }}
      >
        <DialogTitle className="sr-only">{rumor.headline}</DialogTitle>
        <DialogDescription className="sr-only">{rumor.fakeSource}</DialogDescription>
        <div className="p-6 sm:p-9">
          {/* Top tape strip */}
          <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-5">
            <span
              className="font-mono text-[11px] uppercase tracking-[0.3em] font-bold"
              style={{ color: "#dc1e1e" }}
            >
              ▣ Dirt Sheet Exclusive
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-black/60">
              {formatDate(rumor.universeDate)}
            </span>
          </div>

          <h2
            className="font-display uppercase font-extrabold leading-[0.92] tracking-tight text-black text-3xl sm:text-5xl"
            style={{ textShadow: "3px 3px 0 #dc1e1e" }}
          >
            {rumor.headline}
          </h2>

          <div className="mt-6 space-y-4 font-mono text-[14px] leading-[1.7] text-black">
            {paragraphs.map((p, i) => (
              <p key={i}>
                {i === 0 && (
                  <span
                    className="font-display font-extrabold mr-2"
                    style={{ color: "#dc1e1e", fontSize: 22 }}
                  >
                    ▸
                  </span>
                )}
                {p}
              </p>
            ))}
          </div>

          <div className="mt-7 pt-4 border-t-2 border-dashed border-black/50">
            <div className="font-mono text-[11px] uppercase tracking-widest text-black/70 italic">
              Source: <span className="font-bold not-italic">{rumor.fakeSource}</span>
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest text-black/45">
              File this one under: take with a fistful of salt.
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
