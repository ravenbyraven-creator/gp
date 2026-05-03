import { useState } from "react";
import { Settings, X, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIssues } from "@/lib/news";
import { useInboxUnreadCount } from "@/components/WrestlerInbox";
import { useTokenLog, deriveTokenStats, formatTokenCount } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import gpLogo from "@assets/gorilla-position-logo_1777507317192.png";
import gpWordmark from "@assets/gorilla-position-wordmark_1777507532121.png";

export type AppTab = "home" | "inbox" | "calendar" | "news" | "desk" | "roster" | "shows" | "rivalries" | "legacy";

interface AppHeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onOpenSettings: () => void;
  isSettingsOpen?: boolean;
}

const TABS: { key: AppTab; label: string }[] = [
  { key: "inbox", label: "INBOX" },
  { key: "calendar", label: "CALENDAR" },
  { key: "desk", label: "CREATIVE DESK" },
  { key: "rivalries", label: "RIVALRIES" },
  { key: "news", label: "NEWS" },
  { key: "legacy", label: "LEGACY" },
  { key: "roster", label: "ROSTER" },
  { key: "shows", label: "SHOWS" },
];

export function AppHeader({ activeTab, onTabChange, onOpenSettings, isSettingsOpen }: AppHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [issues] = useIssues();
  const hasUnreadIssue = issues.some((i) => !i.read);
  const inboxUnread = useInboxUnreadCount();
  const homeActive = activeTab === "home";
  const [tokenLog] = useTokenLog();
  const tokenStats = deriveTokenStats(tokenLog);
  const todayTotal = tokenStats.today.total;

  function handleTabChange(tab: AppTab) {
    onTabChange(tab);
    setMobileMenuOpen(false);
  }

  function handleOpenSettings() {
    setMobileMenuOpen(false);
    onOpenSettings();
  }

  return (
    <>
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="flex h-14 items-center px-4 md:px-6">
          <div className="flex flex-1 items-center justify-between gap-2">

            <div className="flex items-center gap-2 shrink-0">
              <img
                src={gpLogo}
                alt="Gorilla Position"
                className="h-8 w-8 object-contain shrink-0"
              />
              <button
                type="button"
                onClick={() => handleTabChange("home")}
                className={cn(
                  "flex items-center relative transition-all focus:outline-none group",
                  homeActive ? "opacity-100" : "opacity-70 hover:opacity-100"
                )}
                aria-label="Gorilla Position — Home"
              >
                <img
                  src={gpWordmark}
                  alt="Gorilla Position"
                  className={cn(
                    "h-5 object-contain shrink-0 transition-all",
                    homeActive && "drop-shadow-[0_0_8px_rgba(220,30,30,0.6)]"
                  )}
                />
                {homeActive && (
                  <span className="absolute -bottom-[11px] left-0 right-0 h-[2px] bg-[#dc1e1e]" />
                )}
              </button>
            </div>

            {!isSettingsOpen && (
              <nav className="hidden md:flex items-center space-x-1 md:space-x-3 overflow-x-auto">
                {TABS.map(t => {
                  const isActive = activeTab === t.key;
                  const isDesk = t.key === "desk";
                  return (
                    <button
                      key={t.key}
                      onClick={() => handleTabChange(t.key)}
                      className={cn(
                        "relative whitespace-nowrap transition-all",
                        isDesk
                          ? cn(
                              "px-3 py-1.5 rounded-md text-xs md:text-sm font-bold tracking-wider border",
                              isActive
                                ? "bg-[#dc1e1e] border-[#dc1e1e] text-white shadow-[0_0_14px_#dc1e1e60]"
                                : "bg-[#dc1e1e]/10 border-[#dc1e1e]/50 text-[#dc1e1e] hover:bg-[#dc1e1e]/20 hover:border-[#dc1e1e]/80"
                            )
                          : cn(
                              "px-3 py-2 text-xs md:text-sm font-medium",
                              isActive ? "text-foreground border-b-2 border-foreground" : "text-muted-foreground hover:text-foreground"
                            )
                      )}
                      data-testid={`tab-${t.key}`}
                    >
                      {t.label}
                      {t.key === "news" && hasUnreadIssue && (
                        <span
                          aria-label="Unread issue"
                          data-testid="news-unread-dot"
                          className="absolute top-1 -right-0.5 w-[7px] h-[7px] rounded-full ring-1 ring-background"
                          style={{ backgroundColor: "#dc1e1e" }}
                        />
                      )}
                      {t.key === "inbox" && inboxUnread > 0 && (
                        <span
                          aria-label={`${inboxUnread} unread messages`}
                          className="absolute -top-0.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full ring-1 ring-background flex items-center justify-center text-[9px] font-bold text-white"
                          style={{ backgroundColor: "#dc1e1e", lineHeight: 1 }}
                        >
                          {inboxUnread > 99 ? "99+" : inboxUnread}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-1 justify-end shrink-0">
              {todayTotal > 0 && !mobileMenuOpen && (
                <button
                  type="button"
                  onClick={handleOpenSettings}
                  title="Token usage today — click to view in Settings"
                  className="hidden md:flex items-center px-2 py-0.5 rounded border border-border bg-muted/30 text-[10px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors shrink-0"
                >
                  {formatTokenCount(todayTotal)}
                </button>
              )}
              {!isSettingsOpen && (
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(v => !v)}
                  className="md:hidden p-2 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground relative"
                  aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  {(hasUnreadIssue || inboxUnread > 0) && !mobileMenuOpen && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#dc1e1e]" />
                  )}
                </button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpenSettings}
                className="text-muted-foreground hover:text-foreground"
              >
                {isSettingsOpen ? <X className="h-5 w-5" /> : <Settings className="h-5 w-5" />}
              </Button>
            </div>

          </div>
        </div>
      </header>

      {mobileMenuOpen && !isSettingsOpen && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-background/97 backdrop-blur-md overflow-y-auto">
          <nav className="flex flex-col p-3 gap-1">
            <button
              type="button"
              onClick={() => handleTabChange("home")}
              className={cn(
                "flex items-center w-full px-4 py-3.5 rounded-lg text-sm font-bold tracking-widest uppercase transition-colors text-left",
                homeActive
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              HOME
            </button>
            {TABS.map(t => {
              const isActive = activeTab === t.key;
              const isDesk = t.key === "desk";
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => handleTabChange(t.key)}
                  className={cn(
                    "relative flex items-center justify-between w-full px-4 py-3.5 rounded-lg text-sm font-bold tracking-widest uppercase transition-colors text-left",
                    isDesk
                      ? isActive
                        ? "bg-[#dc1e1e] text-white"
                        : "bg-[#dc1e1e]/10 text-[#dc1e1e] border border-[#dc1e1e]/40"
                      : isActive
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  data-testid={`tab-mobile-${t.key}`}
                >
                  <span>{t.label}</span>
                  <span className="flex items-center gap-1.5">
                    {t.key === "news" && hasUnreadIssue && (
                      <span className="w-2 h-2 rounded-full bg-[#dc1e1e]" aria-label="Unread issue" />
                    )}
                    {t.key === "inbox" && inboxUnread > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#dc1e1e] flex items-center justify-center text-[10px] font-bold text-white">
                        {inboxUnread > 99 ? "99+" : inboxUnread}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}
