import { useState, useRef } from "react";
import {
  useRoster,
  useChairman,
  useTheme,
  useFont,
  useAutoMagazine,
  useSeasonStart,
  useUniverseDate,
  useEvents,
  APP_STORAGE_KEYS,
} from "@/lib/storage";
import { MONTH_LABELS, seasonYearOf } from "@/lib/calendar";
import { useTokenLog, deriveTokenStats, formatTokenCount, ENDPOINT_LABELS } from "@/lib/tokens";
import { CHAIRMEN } from "@/lib/chairmen";
import { FONT_OPTIONS } from "@/lib/fonts";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  Download,
  Upload,
  ArrowLeft,
  Moon,
  Sun,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const EXPORT_VERSION = 1;

function todaySlug() {
  return new Date().toISOString().slice(0, 10);
}

function buildUniverseBundle(): string {
  const data: Record<string, unknown> = {};
  for (const key of APP_STORAGE_KEYS) {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) {
      try {
        data[key] = JSON.parse(raw);
      } catch {
        data[key] = raw;
      }
    }
  }
  return JSON.stringify(
    { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data },
    null,
    2
  );
}

function restoreUniverseBundle(json: string): { keysRestored: number } {
  const parsed = JSON.parse(json);
  if (!parsed || typeof parsed !== "object" || !parsed.data) {
    throw new Error("Not a valid Gorilla Position backup file.");
  }
  let keysRestored = 0;
  for (const key of APP_STORAGE_KEYS) {
    if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
      window.localStorage.setItem(key, JSON.stringify(parsed.data[key]));
      keysRestored++;
    }
  }
  return { keysRestored };
}

export function SettingsView({ onClose }: { onClose: () => void }) {
  const [roster, setRoster] = useRoster();
  const [chairman, setChairman] = useChairman();
  const [theme, setTheme] = useTheme();
  const [font, setFont] = useFont();
  const [autoMagazine, setAutoMagazine] = useAutoMagazine();
  const [seasonStart, setSeasonStart] = useSeasonStart();
  const [date, setDate] = useUniverseDate();
  const [, setEvents] = useEvents();
  const [newSeasonConfirmOpen, setNewSeasonConfirmOpen] = useState(false);

  const currentSeasonYear = seasonYearOf(date, seasonStart);
  const nextSeasonYear = currentSeasonYear + 1;
  const nextSeasonMonthLabel = MONTH_LABELS[seasonStart - 1];

  const handleStartNewSeason = () => {
    setDate({ year: nextSeasonYear, month: seasonStart, week: 1, day: 1 });
    setEvents([]);
    setNewSeasonConfirmOpen(false);
    toast.success(`Season ${nextSeasonYear + 1} started`, {
      description: `Universe date reset to ${nextSeasonMonthLabel} · Week 1. PLE schedule cleared.`,
    });
  };

  const [tokenLog, setTokenLog] = useTokenLog();
  const tokenStats = deriveTokenStats(tokenLog);

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetText, setResetText] = useState("");

  // Universe backup state
  const [importConfirmOpen, setImportConfirmOpen] = useState(false);
  const [pendingImportJson, setPendingImportJson] = useState<string | null>(null);
  const [pendingImportName, setPendingImportName] = useState("");
  const importFileRef = useRef<HTMLInputElement>(null);

  // Roster import state
  const [rosterImportConfirmOpen, setRosterImportConfirmOpen] = useState(false);
  const [pendingRosterData, setPendingRosterData] = useState<unknown[] | null>(null);
  const [pendingRosterName, setPendingRosterName] = useState("");
  const rosterFileRef = useRef<HTMLInputElement>(null);

  const currentChairman = chairman ?? CHAIRMEN[0];
  const currentFont = FONT_OPTIONS.find((f) => f.key === font) ?? FONT_OPTIONS[0];

  const handleUniverseExport = () => {
    try {
      const json = buildUniverseBundle();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gorilla-position-universe-${todaySlug()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Universe exported", {
        description: "Full backup downloaded — keep it somewhere safe.",
      });
    } catch {
      toast.error("Export failed", { description: "Could not read local storage." });
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        if (!parsed?.data || typeof parsed.data !== "object") {
          toast.error("Invalid backup file", {
            description: "This doesn't look like a Gorilla Position universe backup.",
          });
          return;
        }
        setPendingImportJson(text);
        setPendingImportName(file.name);
        setImportConfirmOpen(true);
      } catch {
        toast.error("Could not read file", { description: "Make sure it's a valid .json backup." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmImport = () => {
    if (!pendingImportJson) return;
    try {
      const { keysRestored } = restoreUniverseBundle(pendingImportJson);
      toast.success(`Universe restored — ${keysRestored} data sets loaded`, {
        description: "Reloading now...",
      });
      setImportConfirmOpen(false);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast.error("Restore failed", {
        description: err instanceof Error ? err.message : "Unknown error.",
      });
    }
  };

  const handleRosterExport = () => {
    try {
      const json = JSON.stringify(roster, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gorilla-position-roster-${todaySlug()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Roster exported", {
        description: `${roster.length} superstars downloaded as JSON.`,
      });
    } catch {
      toast.error("Export failed", { description: "Could not read roster data." });
    }
  };

  const handleRosterFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          toast.error("Invalid roster file", {
            description: "Expected a JSON array of superstars.",
          });
          return;
        }
        setPendingRosterData(parsed);
        setPendingRosterName(file.name);
        setRosterImportConfirmOpen(true);
      } catch {
        toast.error("Could not read file", { description: "Make sure it's a valid .json roster file." });
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleConfirmRosterImport = () => {
    if (!pendingRosterData) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setRoster(pendingRosterData as any[]);
    toast.success(`Roster loaded — ${pendingRosterData.length} superstars imported`, {
      description: "Your existing rivalries and championships are untouched.",
    });
    setRosterImportConfirmOpen(false);
    setPendingRosterData(null);
  };

  const handleFactoryReset = () => {
    if (resetText !== "RESET") return;
    APP_STORAGE_KEYS.forEach((key) => {
      try { window.localStorage.removeItem(key); } catch { /* quota */ }
    });
    window.location.reload();
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-16 animate-in fade-in slide-in-from-bottom-4 duration-300">

      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-border hover:border-foreground/40 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-display text-2xl font-black uppercase tracking-widest text-foreground leading-none">
            Settings
          </h1>
          <p className="text-[11px] text-muted-foreground uppercase tracking-widest mt-0.5">
            Configure your universe
          </p>
        </div>
      </div>

      <div className="space-y-2">

        {/* ── Universe Settings ── */}
        <SettingsSection label="Universe Settings">

          <SettingsRow
            label="Season Start"
            hint="Which month your season begins. The calendar locks to 12 months from this month."
          >
            <div className="flex flex-wrap gap-1.5">
              {MONTH_LABELS.map((m, i) => {
                const monthNum = i + 1;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSeasonStart(monthNum)}
                    className={cn(
                      "px-3 py-1.5 rounded border text-[11px] font-bold tracking-wider uppercase transition-colors",
                      seasonStart === monthNum
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-2 leading-snug">
              WWE typically starts in April (post-WrestleMania). Changing this takes effect immediately.
            </p>
          </SettingsRow>

        </SettingsSection>

        {/* ── App Preferences ── */}
        <SettingsSection label="App Preferences">

          <SettingsRow label="Theme">
            <div className="flex p-0.5 bg-muted/30 rounded border border-border">
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex-1 px-4 py-1.5 rounded text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5",
                  theme === "dark"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Moon className="w-3 h-3" /> Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={cn(
                  "flex-1 px-4 py-1.5 rounded text-[11px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5",
                  theme === "light"
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sun className="w-3 h-3" /> Light
              </button>
            </div>
          </SettingsRow>

          <SettingsRow label="Typography">
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1.5">
                {FONT_OPTIONS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFont(f.key)}
                    className={cn(
                      "px-3 py-1.5 rounded border text-[11px] font-bold tracking-wider uppercase transition-colors",
                      font === f.key
                        ? "border-foreground bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <p
                className="text-sm text-muted-foreground"
                style={{ fontFamily: currentFont.family }}
              >
                {currentFont.sample}
              </p>
            </div>
          </SettingsRow>

        </SettingsSection>

        {/* ── Creative Voice ── */}
        <SettingsSection label="Creative Voice">
          <SettingsRow
            label="Chairman"
            hint="Shapes the AI booking style across all features"
          >
            <div className="space-y-2">
              <select
                value={currentChairman.name}
                onChange={(e) => {
                  const found = CHAIRMEN.find((c) => c.name === e.target.value);
                  if (found) setChairman(found);
                }}
                className="w-full bg-card border border-border rounded px-3 py-2 text-sm font-bold text-foreground uppercase tracking-wide appearance-none cursor-pointer focus:outline-none focus:border-foreground/40 transition-colors"
              >
                {CHAIRMEN.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="px-3 py-2.5 rounded border border-border bg-muted/20 space-y-0.5">
                <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
                  Booking Style
                </p>
                <p className="text-sm text-foreground leading-snug">
                  {currentChairman.style}
                </p>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── AI Behavior ── */}
        <SettingsSection label="AI Behavior">
          <SettingsRow
            label="Auto Magazine"
            hint="Generate a weekly issue automatically when the calendar crosses into a new week"
          >
            <button
              type="button"
              role="switch"
              aria-checked={autoMagazine}
              onClick={() => setAutoMagazine(!autoMagazine)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none",
                autoMagazine ? "bg-[#dc1e1e]" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transform transition-transform",
                  autoMagazine ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </SettingsRow>
        </SettingsSection>

        {/* ── Token Usage ── */}
        <SettingsSection label="Token Usage">
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { label: "Today", stat: tokenStats.today },
                  { label: "7 Days", stat: tokenStats.last7Days },
                  { label: "Lifetime", stat: tokenStats.lifetime },
                ] as const
              ).map(({ label, stat }) => (
                <div key={label} className="rounded border border-border bg-muted/20 p-3 text-center space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
                  <p className="text-lg font-mono font-bold text-foreground leading-none">{formatTokenCount(stat.total)}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{stat.calls} {stat.calls === 1 ? "call" : "calls"}</p>
                </div>
              ))}
            </div>

            {/* Endpoint breakdown */}
            {tokenStats.lifetime.calls > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Breakdown by endpoint</p>
                {(Object.entries(tokenStats.byEndpoint) as [string, typeof tokenStats.byEndpoint[keyof typeof tokenStats.byEndpoint]][])
                  .filter(([, s]) => s.calls > 0)
                  .sort(([, a], [, b]) => b.totalTokens - a.totalTokens)
                  .map(([key, s]) => (
                    <div key={key} className="flex items-center gap-2 text-[11px]">
                      <span className="w-36 shrink-0 text-muted-foreground truncate">
                        {(ENDPOINT_LABELS as Record<string, string>)[key] ?? key}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#dc1e1e]/60"
                          style={{
                            width: `${Math.round((s.total / (tokenStats.lifetime.total || 1)) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="w-12 text-right font-mono text-foreground shrink-0">{formatTokenCount(s.total)}</span>
                      <span className="w-10 text-right font-mono text-muted-foreground shrink-0">{s.calls}x</span>
                    </div>
                  ))}
              </div>
            )}

            {tokenStats.lifetime.calls === 0 && (
              <p className="text-[11px] text-muted-foreground italic text-center py-2">
                No AI calls logged yet. Usage is recorded the first time you generate content.
              </p>
            )}

            {/* Clear log */}
            {tokenStats.lifetime.calls > 0 && (
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm("Clear the entire token usage log?")) return;
                    setTokenLog([]);
                    toast.success("Token log cleared");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear Log
                </button>
              </div>
            )}
          </div>
        </SettingsSection>

        {/* ── Roster Data ── */}
        <SettingsSection label="Roster Data">
          <SettingsRow
            label="Superstar List"
            hint="Import a custom roster JSON — rivalries, championships, and history are untouched"
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRosterExport}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-border bg-card text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Roster
                </button>
                <label className="flex-1 relative cursor-pointer">
                  <input
                    ref={rosterFileRef}
                    type="file"
                    accept=".json"
                    onChange={handleRosterFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                  <span className="flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-border bg-card text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors w-full pointer-events-none">
                    <Upload className="w-3.5 h-3.5" />
                    Import Roster
                  </span>
                </label>
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-border bg-muted/10">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  Expects a JSON array of superstars — the same format exported from this app or the Roster tab.
                  Only the roster is replaced; everything else stays intact.
                </p>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Universe Backup ── */}
        <SettingsSection label="Universe Backup">
          <SettingsRow
            label="Full Backup"
            hint="Roster, rivalries, championships, canon moments, chat, title reigns — everything"
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleUniverseExport}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-border bg-card text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Universe
                </button>
                <label className="flex-1 relative cursor-pointer">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".json"
                    onChange={handleImportFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full"
                  />
                  <span className="flex items-center justify-center gap-2 px-3 py-2.5 rounded border border-border bg-card text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors w-full pointer-events-none">
                    <Upload className="w-3.5 h-3.5" />
                    Import Universe
                  </span>
                </label>
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded border border-border bg-muted/10">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
                  Export saves a single <span className="font-mono text-foreground/60">.json</span> file of your entire universe.
                  Import restores from that file — you will be asked to confirm before anything is overwritten.
                </p>
              </div>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* ── Danger Zone ── */}
        <div className="rounded-lg border border-destructive/25 bg-destructive/5 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-destructive/20">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-destructive">
              Danger Zone
            </span>
          </div>
          <div className="p-3 space-y-2">
            <button
              type="button"
              onClick={() => setNewSeasonConfirmOpen(true)}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded border border-destructive/40 bg-destructive/5 text-sm font-bold uppercase tracking-wider text-destructive/80 hover:bg-destructive/15 hover:border-destructive/60 hover:text-destructive transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Start New Season
              <span className="ml-auto text-[10px] font-normal normal-case tracking-normal opacity-70">
                Clears PLE schedule only
              </span>
            </button>
            <button
              type="button"
              onClick={() => { setResetConfirmOpen(true); setResetText(""); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 rounded border border-destructive/60 bg-destructive/10 text-sm font-bold uppercase tracking-wider text-destructive hover:bg-destructive hover:text-white hover:border-destructive transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              Factory Reset
              <span className="ml-auto text-[10px] font-normal normal-case tracking-normal opacity-70">
                Clears all data
              </span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Start New Season confirmation dialog ── */}
      <Dialog open={newSeasonConfirmOpen} onOpenChange={setNewSeasonConfirmOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <RotateCcw className="w-5 h-5 text-foreground shrink-0" />
              <DialogTitle className="font-display uppercase tracking-widest text-base text-foreground">
                Start New Season
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              This will advance your universe to{" "}
              <strong className="text-foreground">{nextSeasonMonthLabel} · Week 1</strong>{" "}
              and clear your PLE schedule so you can plan Season {nextSeasonYear + 1} from scratch.
              <br /><br />
              Your roster, rivalries, championships, match history, and all other data are untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setNewSeasonConfirmOpen(false)}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartNewSeason}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Start Season {nextSeasonYear + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Roster import confirmation dialog ── */}
      <Dialog
        open={rosterImportConfirmOpen}
        onOpenChange={(o) => { setRosterImportConfirmOpen(o); if (!o) setPendingRosterData(null); }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-5 h-5 text-foreground shrink-0" />
              <DialogTitle className="font-display uppercase tracking-widest text-base text-foreground">
                Replace Roster
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Loading{" "}
              <strong className="text-foreground font-mono text-xs">{pendingRosterName}</strong>{" "}
              will replace your current{" "}
              <strong className="text-foreground">{roster.length} superstar{roster.length !== 1 ? "s" : ""}</strong>{" "}
              with the{" "}
              <strong className="text-foreground">{pendingRosterData?.length ?? 0} superstar{(pendingRosterData?.length ?? 0) !== 1 ? "s" : ""}</strong>{" "}
              in the file.
              <br /><br />
              Rivalries, championships, canon moments, and all other data are untouched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setRosterImportConfirmOpen(false); setPendingRosterData(null); }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRosterImport}
              className="font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90"
            >
              Load Roster
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Import confirmation dialog ── */}
      <Dialog
        open={importConfirmOpen}
        onOpenChange={(o) => { setImportConfirmOpen(o); if (!o) setPendingImportJson(null); }}
      >
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <Upload className="w-5 h-5 text-foreground shrink-0" />
              <DialogTitle className="font-display uppercase tracking-widest text-base text-foreground">
                Restore Universe
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              Importing{" "}
              <strong className="text-foreground font-mono text-xs">{pendingImportName}</strong>{" "}
              will <strong className="text-foreground">overwrite all current data</strong> — roster,
              rivalries, championships, canon moments, chat history, and settings.
              <br /><br />
              Export your current universe first if you want to keep it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setImportConfirmOpen(false); setPendingImportJson(null); }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmImport}
              className="font-bold uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90"
            >
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Factory reset dialog ── */}
      <Dialog open={resetConfirmOpen} onOpenChange={(o) => { setResetConfirmOpen(o); if (!o) setResetText(""); }}>
        <DialogContent className="bg-card border border-destructive/40 max-w-sm">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <DialogTitle className="text-destructive font-display uppercase tracking-widest text-base">
                Factory Reset
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
              This wipes <strong className="text-foreground">all data</strong> — roster edits,
              championships, stables, rivalries, history, chat, news, and settings.
              The app will reload exactly as if launched for the first time.
              Default wrestlers and photos will be available again.
              <br /><br />
              Type <strong className="text-foreground font-mono">RESET</strong> to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              value={resetText}
              onChange={(e) => setResetText(e.target.value.toUpperCase())}
              placeholder="RESET"
              className="bg-background border-border font-mono uppercase tracking-widest text-center"
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => { setResetConfirmOpen(false); setResetText(""); }}
              className="text-muted-foreground"
            >
              Cancel
            </Button>
            <Button
              disabled={resetText !== "RESET"}
              variant="destructive"
              onClick={handleFactoryReset}
              className="font-bold uppercase tracking-widest"
            >
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

function SettingsSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/20">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <div className="sm:w-32 shrink-0 pt-0.5">
        <p className="text-sm font-bold text-foreground leading-none">{label}</p>
        {hint && (
          <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{hint}</p>
        )}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
