import { useHistory } from "@/lib/storage";

export function NewsTicker() {
  const [history] = useHistory();

  const headlines = history
    .filter(item => item.kind !== "log")
    .map((item) => (item as any).data?.headline)
    .filter(Boolean);

  return (
    <div className="fixed bottom-0 left-0 right-0 h-10 bg-foreground text-background border-t border-border flex items-center overflow-hidden z-50">
      <div className="absolute left-0 top-0 bottom-0 px-4 bg-foreground border-r border-background/20 flex items-center z-10">
        <span className="font-display font-bold tracking-widest text-sm uppercase">BREAKING</span>
      </div>
      
      <div className="flex-1 overflow-hidden relative pl-28">
        <div className="flex whitespace-nowrap animate-ticker group-hover:[animation-play-state:paused]">
          <div className="flex items-center gap-8 px-8">
            {headlines.length > 0 ? (
              headlines.map((headline, i) => (
                <div key={i} className="flex items-center gap-8">
                  <span className="text-sm font-medium uppercase tracking-wide">{headline}</span>
                  <span className="text-background/50 text-xs">|</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-8">
                <span className="text-sm font-medium uppercase tracking-wide opacity-80">BOOK YOUR FIRST STORYLINE TO SEE LIVE HEADLINES HERE</span>
                <span className="text-background/50 text-xs">|</span>
                <span className="text-sm font-medium uppercase tracking-wide opacity-80">WELCOME TO GORILLA POSITION</span>
                <span className="text-background/50 text-xs">|</span>
              </div>
            )}
          </div>
          {/* Duplicate for seamless loop */}
          <div className="flex items-center gap-8 px-8">
            {headlines.length > 0 ? (
              headlines.map((headline, i) => (
                <div key={i + 'dup'} className="flex items-center gap-8">
                  <span className="text-sm font-medium uppercase tracking-wide">{headline}</span>
                  <span className="text-background/50 text-xs">|</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-8">
                <span className="text-sm font-medium uppercase tracking-wide opacity-80">BOOK YOUR FIRST STORYLINE TO SEE LIVE HEADLINES HERE</span>
                <span className="text-background/50 text-xs">|</span>
                <span className="text-sm font-medium uppercase tracking-wide opacity-80">WELCOME TO GORILLA POSITION</span>
                <span className="text-background/50 text-xs">|</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
