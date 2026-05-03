import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import type { StorylineScene, ShowCard, SurpriseScene, PromoScript } from "@workspace/api-client-react";
import { Stamp } from "./Stamp";
import { BookOpen, ClipboardList } from "lucide-react";
import { FileToRivalryDialog } from "./RivalryDialogs";
import type { RivalryEntry } from "@/lib/storage";
import { useUniverseDate } from "@/lib/storage";
import { MatchLogger } from "@/components/MatchLogger";

type QuickBookEntry = Extract<RivalryEntry, { kind: "storyline" | "show" | "surprise" | "promo" }>;

interface ResultScreenProps {
  entry: QuickBookEntry;
  onBack: () => void;
}

export function ResultScreen({ entry, onBack }: ResultScreenProps) {
  const [fileOpen, setFileOpen] = useState(false);
  const [matchLoggerOpen, setMatchLoggerOpen] = useState(false);
  const [date] = useUniverseDate();
  const data = entry.data;

  const showCard = entry.kind === "show" ? (entry.data as { matches?: Array<{ slot: string; match: string; result: string }> }) : null;
  const prefillSlots = useMemo(() => {
    if (!showCard?.matches) return [];
    return showCard.matches.map((m) => ({ slot: m.slot, matchText: m.match, resultText: m.result }));
  }, [showCard]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6 h-full max-w-6xl mx-auto"
    >
      {/* Left Panel: Image/Stamp */}
      <div className="lg:col-span-2 cinematic-panel relative flex items-center justify-center min-h-[300px] lg:min-h-[500px] overflow-hidden rounded-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black/20 z-10" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full h-1/2 bg-foreground/5 blur-3xl rounded-full" />
        <Stamp text={data.stamp} />
      </div>

      {/* Right Panel: Content */}
      <div className="lg:col-span-3 flex flex-col max-h-[70vh] lg:max-h-[80vh] bg-card rounded-xl border border-border overflow-hidden shadow-2xl">
        <div className="bg-muted/30 border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <span className="text-xl text-foreground font-display uppercase tracking-widest">{data.title}</span>
        </div>

        <div className="p-6 overflow-y-auto overflow-x-hidden flex-1 scrollbar-hide">
          {data.kind === "storyline" && <StorylineContent data={data as StorylineScene} />}
          {data.kind === "show" && <ShowContent data={data as ShowCard} />}
          {data.kind === "surprise" && <SurpriseContent data={data as SurpriseScene} />}
          {data.kind === "promo" && <PromoContent data={data as PromoScript} />}

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 pt-6 border-t border-border space-y-3"
          >
            <button
              onClick={onBack}
              className="w-full bg-foreground hover:bg-foreground/90 text-background py-3 rounded text-sm font-semibold tracking-wider transition-colors"
            >
              ACCEPT & RETURN
            </button>
            {entry.kind === "show" && (
              <button
                onClick={() => setMatchLoggerOpen(true)}
                className="w-full bg-[#dc1e1e]/10 border border-[#dc1e1e]/30 hover:bg-[#dc1e1e]/20 hover:border-[#dc1e1e]/50 text-[#dc1e1e]/80 hover:text-[#dc1e1e] py-3 rounded text-sm font-semibold tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                RESOLVE RESULTS
              </button>
            )}
            <button
              onClick={() => setFileOpen(true)}
              className="w-full bg-transparent border border-border hover:border-foreground/40 text-foreground py-3 rounded text-sm font-semibold tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              <BookOpen className="w-4 h-4" />
              FILE TO RIVALRY
            </button>
          </motion.div>
        </div>
      </div>

      <FileToRivalryDialog
        open={fileOpen}
        onOpenChange={setFileOpen}
        entry={entry}
        suggestedHint={
          (entry.data as { suggestedRivalryHint?: { matchupGuess: string; confidence?: "high" | "medium" | "low" } })
            .suggestedRivalryHint
        }
      />

      <MatchLogger
        open={matchLoggerOpen}
        onOpenChange={setMatchLoggerOpen}
        date={date}
        prefillSlots={prefillSlots}
      />
    </motion.div>
  );
}

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const staggerItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

function StorylineContent({ data }: { data: StorylineScene }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <motion.div variants={staggerItem} className="flex flex-col gap-1 p-3 bg-muted/20 rounded">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Feud</span>
          <span className="text-foreground font-medium">{data.feud}</span>
        </motion.div>

        <motion.div variants={staggerItem} className="flex flex-col gap-1 p-3 bg-muted/20 rounded">
          <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Participants</span>
          <span className="text-foreground font-medium">{data.participants.join(" VS ")}</span>
        </motion.div>
      </div>

      <div className="h-px bg-border w-full" />

      <div className="space-y-4">
        {data.beats.map((beat, i) => (
          <motion.div key={i} variants={staggerItem} className="flex flex-col gap-1 border-l-2 border-foreground/30 pl-4 py-1">
            <span className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">{beat.label}</span>
            <span className="text-foreground/90 leading-relaxed">{beat.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ShowContent({ data }: { data: ShowCard }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6 text-sm">
      <motion.div variants={staggerItem} className="flex flex-col gap-1 p-4 bg-muted/20 rounded text-center">
        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Event</span>
        <span className="text-foreground text-lg font-display uppercase tracking-widest">{data.showName}</span>
      </motion.div>

      <div className="h-px bg-border w-full" />

      <div className="space-y-3">
        {data.matches.map((match, i) => (
          <motion.div key={i} variants={staggerItem} className="flex flex-col gap-2 p-4 bg-card border border-border rounded relative overflow-hidden group hover:border-foreground/30 transition-colors">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-foreground/10 group-hover:bg-foreground/30 transition-colors" />
            <div className="pl-2">
              <span className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">{match.slot}</span>
              <div className="text-foreground font-medium uppercase mt-1 mb-3">{match.match}</div>

              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs bg-muted/20 p-2 rounded">
                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Result:</span>
                <span className="text-foreground/90">{match.result}</span>

                <span className="text-muted-foreground uppercase tracking-wider font-semibold">Twist:</span>
                <span className="text-foreground/90 italic">{match.twist}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function PromoContent({ data }: { data: PromoScript }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6 text-sm">
      <motion.div variants={staggerItem} className="flex flex-col gap-2 p-4 bg-muted/30 rounded border border-border">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-wider uppercase text-foreground/70">
          <span className="px-2 py-0.5 border border-foreground/40 rounded">{data.wrestlerName}</span>
          <span className="px-2 py-0.5 border border-foreground/40 rounded">{data.tone}</span>
        </div>
        <span className="text-foreground font-display uppercase tracking-widest text-xl mt-1">{data.headline}</span>
      </motion.div>

      <div className="h-px bg-border w-full" />

      <div className="space-y-4">
        {data.beats.map((beat, i) => (
          <motion.div key={i} variants={staggerItem} className="flex flex-col gap-1 border-l-2 border-foreground/30 pl-4 py-1">
            <span className="text-foreground/70 text-xs font-semibold uppercase tracking-wider">{beat.label}</span>
            <span className="text-foreground/90 leading-relaxed italic">"{beat.text}"</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function SurpriseContent({ data }: { data: SurpriseScene }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className="flex flex-col gap-6 text-sm">
      <motion.div variants={staggerItem} className="flex flex-col gap-1 p-4 bg-muted/30 rounded border border-border">
        <span className="text-foreground/70 text-xs uppercase tracking-wider font-semibold">Headline</span>
        <span className="text-foreground font-display uppercase tracking-widest text-xl">{data.headline}</span>
      </motion.div>

      <div className="h-px bg-border w-full" />

      <div className="space-y-4">
        {data.beats.map((beat, i) => (
          <motion.div key={i} variants={staggerItem} className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{beat.label}</span>
            <span className="text-foreground/90 leading-relaxed bg-muted/20 p-3 rounded mt-1 border border-border">{beat.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
