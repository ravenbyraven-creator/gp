import { useState, useMemo, useEffect } from "react";
import { AppHeader, type AppTab } from "@/components/AppHeader";
import { NewsTicker } from "@/components/NewsTicker";
import { CreativeDesk } from "@/components/CreativeDesk";
import { Roster } from "@/components/Roster";
import { Legacy } from "@/components/Legacy";
import { Shows } from "@/components/Shows";
import { Rivalries } from "@/components/Rivalries";
import { News } from "@/components/News";
import { WrestlerInbox } from "@/components/WrestlerInbox";
import { SettingsView } from "@/components/SettingsView";
import { GettingStarted } from "@/components/GettingStarted";
import { Dashboard } from "@/components/Dashboard";
import { CalendarView } from "@/components/CalendarView";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTheme, useFont, useGettingStartedDismissed } from "@/lib/storage";
import { FONT_FAMILIES } from "@/lib/fonts";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    }
  }
});

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useTheme();
  const [font] = useFont();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    const family = FONT_FAMILIES[font] ?? FONT_FAMILIES.default;
    root.style.setProperty("--app-font-display", family);
  }, [theme, font]);

  return <>{children}</>;
}

function AppContent() {
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [guideDismissed, setGuideDismissed] = useGettingStartedDismissed();

  return (
    <div className="min-h-[100dvh] flex flex-col text-foreground selection:bg-primary selection:text-primary-foreground relative pb-10">
      <AppHeader 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onOpenSettings={() => setIsSettingsOpen(!isSettingsOpen)} 
        isSettingsOpen={isSettingsOpen}
      />
      {!guideDismissed && (
        <GettingStarted
          onDismiss={() => setGuideDismissed(true)}
          onGoTo={(tab) => {
            setActiveTab(tab);
            setGuideDismissed(true);
          }}
        />
      )}
      
      <main className="flex-1 overflow-x-hidden overflow-y-auto w-full relative z-0">
        {isSettingsOpen ? (
          <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 h-full">
            <SettingsView onClose={() => setIsSettingsOpen(false)} />
          </div>
        ) : activeTab === "home" ? (
          <Dashboard onNavigate={setActiveTab} />
        ) : activeTab === "inbox" ? (
          <div style={{ height: "calc(100dvh - 56px - 40px)" }}>
            <WrestlerInbox />
          </div>
        ) : activeTab === "news" ? (
          <News />
        ) : (
          <div className="container mx-auto px-4 md:px-6 py-6 md:py-8 h-full">
            {activeTab === "calendar" && <CalendarView />}
            {activeTab === "desk" && <CreativeDesk onNavigate={setActiveTab} />}
            {activeTab === "roster" && <Roster />}
            {activeTab === "legacy" && <Legacy />}
            {activeTab === "shows" && <Shows />}
            {activeTab === "rivalries" && <Rivalries onNavigate={setActiveTab} />}
          </div>
        )}
      </main>

      <NewsTicker />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
