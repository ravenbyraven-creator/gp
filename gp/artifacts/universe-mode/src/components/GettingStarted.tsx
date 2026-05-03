import { AnimatePresence, motion } from "framer-motion";
import type { AppTab } from "@/components/AppHeader";

interface GettingStartedProps {
  onDismiss: () => void;
  onGoTo: (tab: AppTab) => void;
}

const STEPS = [
  {
    number: "01",
    heading: "Set up your universe",
    body: "Add your roster and shows so the AI knows who you're working with.",
    tab: "roster" as AppTab,
    cta: "Open Roster",
  },
  {
    number: "02",
    heading: "Book what should happen",
    body: "Use the Creative Desk or Chat to plan storylines, shows, promos, and surprises.",
    tab: "desk" as AppTab,
    cta: "Open Creative Desk",
  },
  {
    number: "03",
    heading: "Play the game",
    body: "Run the show in WWE 2K26. Come back when it's done.",
    tab: null,
    cta: null,
  },
  {
    number: "04",
    heading: "File what happened as canon",
    body: "Save results and story beats to rivalries. The AI remembers everything you file.",
    tab: "rivalries" as AppTab,
    cta: "Open Rivalries",
  },
];

export function GettingStarted({ onDismiss, onGoTo }: GettingStartedProps) {
  return (
    <AnimatePresence>
      <motion.div
        key="intro-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm overflow-y-auto"
        style={{ backdropFilter: "blur(6px)" }}
      >
        <div className="w-full max-w-3xl mx-auto px-6 py-12 flex flex-col items-center text-center">

          <div className="text-[10px] font-bold tracking-[0.3em] uppercase text-muted-foreground mb-4">
            Welcome to
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-black uppercase tracking-widest text-foreground mb-3">
            Gorilla Position
          </h1>

          <p className="text-base text-muted-foreground max-w-xl leading-relaxed mb-2">
            Your WWE 2K26 writers' room companion.
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed mb-12">
            Book storylines before you play. File what actually happened after. The AI stays wired to your universe — your roster, your rivalries, your canon.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full mb-12">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="rounded-xl border border-border bg-card text-left px-5 py-5 space-y-2"
              >
                <div className="text-[10px] font-black tracking-[0.3em] uppercase text-muted-foreground">
                  Step {step.number}
                </div>
                <div className="font-display text-sm uppercase tracking-widest text-foreground font-bold leading-snug">
                  {step.heading}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
                {step.tab && step.cta && (
                  <button
                    type="button"
                    onClick={() => onGoTo(step.tab!)}
                    className="text-[10px] font-bold tracking-widest uppercase text-foreground/60 hover:text-foreground border-b border-foreground/20 hover:border-foreground/60 transition-colors pb-px"
                  >
                    {step.cta}
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={onDismiss}
            className="px-10 py-4 bg-foreground text-background font-display text-sm font-black uppercase tracking-[0.25em] hover:opacity-90 active:scale-[0.98] transition-all rounded-sm"
          >
            Enter the Room
          </button>

          <button
            type="button"
            onClick={onDismiss}
            className="text-[10px] text-muted-foreground/60 mt-5 tracking-wider uppercase hover:text-muted-foreground transition-colors cursor-pointer underline-offset-4 hover:underline"
          >
            You won't see this again
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
