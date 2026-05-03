import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  useBookerChat,
  useSummarizeChat,
  BookerChatMessageRole,
  type BookerChatMessage,
} from "@workspace/api-client-react";
import {
  useRoster, useChairman, useHistory, useShows,
  useUniverseDate, useEvents, useRivalries, useMemories,
  useChampionships, useStables,
  buildBookerContext, useChatSessions, useActiveChatSessionId,
  type ChatSession,
} from "@/lib/storage";
import { useTokenLog, recordTokenUsage } from "@/lib/tokens";
import { useIssues } from "@/lib/news";
import { CHAIRMEN } from "@/lib/chairmen";
import {
  Send, Loader2, RefreshCcw, Trash2, BookOpen,
  Plus, MessageSquare, Menu, X, ArrowLeft, Maximize2, Pencil, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatToRivalryDialog } from "./RivalryDialogs";
import { cn } from "@/lib/utils";
import { describeApiError } from "@/lib/api-errors";

function makeTitle(firstMessage: string): string {
  const t = firstMessage.trim().slice(0, 52);
  return t.length < firstMessage.trim().length ? t + "…" : t;
}

function createSession(): ChatSession {
  const now = Date.now();
  return { id: crypto.randomUUID(), title: "New Chat", createdAt: now, updatedAt: now, messages: [] };
}

const SUGGESTIONS = [
  "WHAT SHOULD CODY DO AFTER WRESTLEMANIA?",
  "GIVE ME 3 IDEAS FOR LIV MORGAN'S NEXT FEUD",
  "WHO SHOULD HEADLINE SUMMERSLAM?",
  "BUILD A SLOW BURN FOR GUNTHER VS PRIEST",
];

interface ChatProps {
  fullScreen?: boolean;
  onToggleFullScreen?: () => void;
  onRequestBack?: () => void;
}

export function Chat({ fullScreen, onToggleFullScreen, onRequestBack }: ChatProps) {
  const [sessions, setSessions] = useChatSessions();
  const [activeId, setActiveId] = useActiveChatSessionId();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [input, setInput] = useState("");
  const [saveToRivalryText, setSaveToRivalryText] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const [roster] = useRoster();
  const [chairman] = useChairman();
  const [history] = useHistory();
  const [shows] = useShows();
  const [universeDate] = useUniverseDate();
  const [events] = useEvents();
  const [rivalries] = useRivalries();
  const [memories] = useMemories();
  const [issues] = useIssues();
  const [championships] = useChampionships();
  const [stables] = useStables();

  const currentChairman = chairman || CHAIRMEN[0];
  const activeRivalriesCount = history.filter(h => h.kind === "storyline").length;
  const chatMutation = useBookerChat();
  const summarizeMutation = useSummarizeChat();
  const [tokenLog, setTokenLog] = useTokenLog();

  // Hybrid memory constants:
  // RECENT_WINDOW — number of full messages always sent to the AI.
  // ARCHIVE_TRIGGER — once un-archived messages exceed this, compress the overflow.
  const RECENT_WINDOW = 8;
  const ARCHIVE_TRIGGER = 12;

  // Resolve active session — create one if none exist yet
  const activeSession: ChatSession | undefined = sessions.find(s => s.id === activeId) ?? sessions[0];

  useEffect(() => {
    if (!activeSession && sessions.length === 0) return;
    if (!activeId && sessions.length > 0) {
      setActiveId(sessions[0].id);
    }
  }, [sessions, activeId, setActiveId]);

  useEffect(() => {
    if (!activeSession) return;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeSession?.messages, chatMutation.isPending]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 128) + "px";
  }, [input]);

  const updateSession = (id: string, updater: (s: ChatSession) => ChatSession) => {
    setSessions(prev => prev.map(s => s.id === id ? updater(s) : s));
  };

  const startEditing = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditingTitle(s.title);
    setTimeout(() => {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }, 0);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const trimmed = editingTitle.trim();
    if (trimmed) updateSession(editingId, s => ({ ...s, title: trimmed }));
    setEditingId(null);
    setEditingTitle("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); commitEdit(); }
    if (e.key === "Escape") { setEditingId(null); setEditingTitle(""); }
  };

  const handleNewChat = () => {
    const newSession = createSession();
    setSessions(prev => [newSession, ...prev]);
    setActiveId(newSession.id);
    setSidebarOpen(false);
    setInput("");
  };

  const handleSelectSession = (id: string) => {
    setActiveId(id);
    setSidebarOpen(false);
    setInput("");
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
    if (activeId === id) {
      const remaining = sessions.filter(s => s.id !== id);
      setActiveId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleSend = (overrideInput?: string) => {
    const textToSend = overrideInput ?? input;
    if (!textToSend.trim() || chatMutation.isPending) return;

    // If no session exists yet, create one
    let sessionId = activeSession?.id;
    if (!sessionId) {
      const newSession = createSession();
      setSessions(prev => [newSession, ...prev]);
      setActiveId(newSession.id);
      sessionId = newSession.id;
    }

    const newMessage: BookerChatMessage = { role: BookerChatMessageRole.user, content: textToSend.trim() };
    const currentMessages = activeSession?.messages ?? [];
    const updatedMessages = [...currentMessages, newMessage];

    // Update stored session (full history preserved for display)
    setSessions(prev => prev.map(s => {
      if (s.id !== sessionId) return s;
      const title = s.messages.length === 0 ? makeTitle(textToSend) : s.title;
      return { ...s, title, messages: updatedMessages, updatedAt: Date.now() };
    }));
    setInput("");

    // Build the "recent" slice for the API call.
    // Only the last RECENT_WINDOW un-archived messages are sent in full;
    // older history is already captured in activeSession.summary.
    const archivedCount = activeSession?.archivedCount ?? 0;
    const unarchivedMessages = updatedMessages.slice(archivedCount);
    const recentToSend = unarchivedMessages.slice(-RECENT_WINDOW);

    const context = buildBookerContext(roster, currentChairman, history, shows, universeDate, events, rivalries, memories, issues, championships, stables);
    chatMutation.mutate(
      {
        data: {
          messages: recentToSend,
          sessionSummary: activeSession?.summary || undefined,
          ...context,
        },
      },
      {
        onSuccess: (data) => {
          recordTokenUsage(tokenLog, setTokenLog, "chat", data._usage);
          const assistantMsg: BookerChatMessage = { role: BookerChatMessageRole.assistant, content: data.message };

          // All messages after this reply (for archive calculation)
          const allMessages = [...updatedMessages, assistantMsg];

          setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return { ...s, messages: allMessages, updatedAt: Date.now() };
          }));

          // Lazy archiving: if un-archived messages exceed ARCHIVE_TRIGGER, compress the overflow.
          // We keep the last RECENT_WINDOW in full; everything else gets folded into the summary.
          const currentArchived = activeSession?.archivedCount ?? 0;
          const totalUnarchived = allMessages.length - currentArchived;

          if (totalUnarchived > ARCHIVE_TRIGGER) {
            const newArchivedEnd = allMessages.length - RECENT_WINDOW;
            const toArchive = allMessages.slice(currentArchived, newArchivedEnd);

            // If there is an existing summary, prepend it as context so the new
            // summary merges both old memory and the newly archived messages.
            const existingSummary = activeSession?.summary;
            const toArchiveWithContext: BookerChatMessage[] = [
              ...(existingSummary
                ? [{ role: BookerChatMessageRole.user, content: `PREVIOUS MEMORY: ${existingSummary}` }]
                : []),
              ...toArchive,
            ];

            summarizeMutation.mutate(
              { data: { messages: toArchiveWithContext } },
              {
                onSuccess: (summaryData) => {
                  recordTokenUsage(tokenLog, setTokenLog, "summarize", summaryData._usage);
                  if (!summaryData.summary) return;
                  setSessions(prev => prev.map(s => {
                    if (s.id !== sessionId) return s;
                    return { ...s, summary: summaryData.summary, archivedCount: newArchivedEnd };
                  }));
                },
              }
            );
          }
        },
        onError: (error) => {
          const assistantMsg: BookerChatMessage = {
            role: BookerChatMessageRole.assistant,
            content: `Creative is unavailable right now.\n\n${describeApiError(error)}\n\nYour message is still saved here. You can retry when the AI server is back, or save a manual canon moment from the Creative Desk.`,
          };
          setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return { ...s, messages: [...s.messages, assistantMsg], updatedAt: Date.now() };
          }));
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearSession = () => {
    if (!activeSession) return;
    if (!confirm("Clear this chat session?")) return;
    updateSession(activeSession.id, s => ({
      ...s, messages: [], title: "New Chat", updatedAt: Date.now(),
      summary: undefined, archivedCount: undefined,
    }));
  };

  const currentMessages = activeSession?.messages ?? [];
  const lastUserMsg = [...currentMessages].reverse().find(m => m.role === "user")?.content;

  return (
    <div className={cn("flex h-full overflow-hidden", fullScreen ? "rounded-none" : "rounded-xl border border-border bg-card shadow-sm")}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(sidebarOpen || fullScreen) && (
          <>
            {/* Mobile backdrop */}
            {!fullScreen && sidebarOpen && (
              <motion.div
                key="backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 z-30 md:hidden"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <motion.aside
              key="sidebar"
              initial={{ x: -260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -260, opacity: 0 }}
              transition={{ type: "tween", duration: 0.18 }}
              className={cn(
                "flex flex-col shrink-0 border-r border-border bg-muted/20 overflow-hidden",
                fullScreen
                  ? "w-64 relative"
                  : "w-64 absolute md:relative inset-y-0 left-0 z-40 md:z-auto"
              )}
            >
              {/* Sidebar header */}
              <div className="flex items-center justify-between px-3 py-3 border-b border-border">
                <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">Chats</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleNewChat}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    aria-label="New chat"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {!fullScreen && (
                    <button
                      type="button"
                      onClick={() => setSidebarOpen(false)}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground md:hidden"
                      aria-label="Close sidebar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Session list */}
              <div className="flex-1 overflow-y-auto py-2 space-y-0.5 px-2">
                {sessions.length === 0 && (
                  <p className="text-[11px] text-muted-foreground px-2 py-4 text-center">No chats yet.</p>
                )}
                {sessions.map(s => (
                  <div
                    key={s.id}
                    onClick={() => editingId !== s.id && handleSelectSession(s.id)}
                    className={cn(
                      "group w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors cursor-pointer",
                      s.id === activeSession?.id
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />

                    {editingId === s.id ? (
                      <div className="flex-1 flex items-center gap-1 min-w-0">
                        <input
                          ref={editInputRef}
                          value={editingTitle}
                          onChange={e => setEditingTitle(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          onBlur={commitEdit}
                          onClick={e => e.stopPropagation()}
                          className="flex-1 min-w-0 bg-background border border-border rounded px-1.5 py-0.5 text-xs font-medium text-foreground focus:outline-none focus:border-foreground/50"
                        />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); commitEdit(); }}
                          className="p-0.5 rounded hover:text-foreground text-muted-foreground transition-colors"
                          aria-label="Save title"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-xs font-medium">{s.title}</span>
                        <button
                          type="button"
                          onClick={(e) => startEditing(s, e)}
                          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 p-0.5 rounded hover:text-foreground text-muted-foreground transition-all"
                          aria-label="Rename chat"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 p-0.5 rounded hover:text-destructive transition-all"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main chat area ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 bg-card">
        {/* Chat header bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/20 shrink-0">
          {/* Sidebar toggle / back button */}
          {fullScreen ? (
            <button
              type="button"
              onClick={onRequestBack}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSidebarOpen(v => !v)}
              className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          {/* Context line */}
          <div className="flex-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase truncate">
            {activeSession?.title !== "New Chat" && activeSession?.title
              ? <span className="text-foreground">{activeSession.title}</span>
              : <>Booking as <span className="text-foreground">{currentChairman.name}</span> · {roster.length} superstars · {activeRivalriesCount} rivalries</>
            }
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {currentMessages.length > 0 && (
              <Button
                variant="ghost" size="sm"
                onClick={handleClearSession}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 px-2"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Clear
              </Button>
            )}
            {onToggleFullScreen && (
              <button
                type="button"
                onClick={onToggleFullScreen}
                className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label={fullScreen ? "Exit full screen" : "Full screen"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
              <h2 className="text-2xl font-display font-bold uppercase tracking-widest text-foreground mb-2">
                Talk to your creative team.
              </h2>
              <p className="text-muted-foreground mb-8">
                Ask about your roster, plan your next PLE, or workshop a storyline.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-xs font-semibold uppercase tracking-wider px-3 py-2 border border-border rounded-full hover:bg-muted hover:text-foreground text-muted-foreground transition-colors bg-background"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {currentMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-5 py-3",
                      msg.role === "user"
                        ? "bg-foreground text-background font-medium"
                        : "bg-muted/30 border border-border text-foreground"
                    )}
                  >
                    <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                      {msg.content}
                    </div>
                  </div>
                  {msg.role === "assistant" && (
                    <button
                      type="button"
                      onClick={() => setSaveToRivalryText(msg.content)}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold tracking-widest uppercase text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
                    >
                      <BookOpen className="w-3 h-3" />
                      Save to Rivalry
                    </button>
                  )}
                </motion.div>
              ))}

              {chatMutation.isPending && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-muted/30 border border-border rounded-2xl px-5 py-4 flex gap-1">
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4 }} className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.2 }} className="w-2 h-2 rounded-full bg-muted-foreground" />
                    <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1.4, delay: 0.4 }} className="w-2 h-2 rounded-full bg-muted-foreground" />
                  </div>
                </motion.div>
              )}

              {chatMutation.isError && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center mt-4">
                  <button
                    onClick={() => lastUserMsg && handleSend(lastUserMsg)}
                    className="bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full flex items-center gap-2 transition-colors"
                  >
                    <RefreshCcw className="w-3 h-3" /> CREATIVE OVERRULED — TAP TO RETRY
                  </button>
                </motion.div>
              )}
            </>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-background border-t border-border shrink-0">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Creative..."
              className="w-full bg-muted/20 border border-border rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-foreground resize-none min-h-[52px] max-h-32 overflow-y-auto"
              rows={1}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="absolute right-2 bottom-2 w-9 h-9 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
            >
              {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <div className="text-center mt-2 text-[10px] text-muted-foreground">
            Shift + Enter for new line
          </div>
        </div>
      </div>

      <ChatToRivalryDialog
        open={saveToRivalryText !== null}
        onOpenChange={(v) => { if (!v) setSaveToRivalryText(null); }}
        text={saveToRivalryText ?? ""}
      />
    </div>
  );
}
