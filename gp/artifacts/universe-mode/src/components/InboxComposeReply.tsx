import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useHistory, useRivalries, useUniverseDate, useRoster } from "@/lib/storage";
import type { RivalryEntry } from "@/lib/storage";
import { useInboxGenerated, useInboxReplies } from "@/lib/inbox";
import type { GeneratedInboxMessage, GMReply } from "@/lib/inbox";
import { REPLY_TEMPLATES } from "@/lib/inbox-templates";
import type { SenderType } from "@/lib/inbox-templates";
import { compareDate } from "@/lib/rivalry";

const PX = "'Press Start 2P', monospace";
const BODY = "'Courier New', Courier, monospace";

export interface ReplyTarget {
  id: string;
  from: string;
  subject: string;
  templateId?: string;
  senderType?: SenderType;
  fromWrestlerId?: string;
}

interface InboxComposeReplyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ReplyTarget;
  onMarkRead: (id: string) => void;
}

export function InboxComposeReply({
  open,
  onOpenChange,
  message,
  onMarkRead,
}: InboxComposeReplyProps) {
  const [history, setHistory] = useHistory();
  const [rivalries, setRivalries] = useRivalries();
  const [universeDate] = useUniverseDate();
  const [roster] = useRoster();
  const [inboxGenerated, setInboxGenerated] = useInboxGenerated();
  const [replies, setReplies] = useInboxReplies();

  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");

  if (message.senderType === "SYSTEM") return null;

  const templateId = message.templateId ?? "";

  const applicableReplies = REPLY_TEMPLATES.filter(
    (rt) =>
      rt.appliesTo.includes("*") ||
      rt.appliesTo.includes(templateId) ||
      rt.appliesTo.some((a) => a.endsWith("*") && templateId.startsWith(a.slice(0, -1)))
  );

  const selectedReply = applicableReplies.find((r) => r.id === selectedReplyId) ?? null;

  function buildReplyText(): string {
    if (selectedReply?.id === "reply.custom" || selectedReplyId === null) {
      return customText.trim();
    }
    const bodyFn = selectedReply?.body;
    if (!bodyFn) return customText.trim();
    return bodyFn({ originalMsg: message });
  }

  function handleSend() {
    const replyText = buildReplyText();

    // "reply.silence" — no text, but still file a note
    const isSilent = selectedReplyId === "reply.silence";

    if (!isSilent && !replyText) {
      toast.error("Write something first");
      return;
    }

    const noteText = isSilent
      ? `[GM to ${message.from}] (no reply sent)`
      : `[GM Reply to ${message.from}] ${replyText}`;

    const note: RivalryEntry = {
      kind: "log",
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      universeDate,
      text: noteText,
    };

    setHistory((prev) => [...prev, note]);

    // Append note to the most recent active rivalry involving the sender (if talent)
    if (message.fromWrestlerId || message.senderType === "TALENT") {
      const fromName = message.from.toLowerCase();
      // RivalrySide stores wrestler ids only (no Wrestler objects), so we
      // cannot access .wrestlers — check the id list directly, falling back
      // to a roster name lookup when fromWrestlerId is absent.
      const activeRivalries = rivalries
        .filter((r) => r.status === "ACTIVE")
        .filter((r) =>
          r.sides?.some((side) => {
            if (message.fromWrestlerId) {
              return side.wrestlerIds.includes(message.fromWrestlerId);
            }
            return side.wrestlerIds.some((id) => {
              const w = roster.find((wr) => wr.id === id);
              return w?.name?.toLowerCase() === fromName;
            });
          })
        )
        .slice()
        .sort((a, b) => compareDate(b.lastActivityDate, a.lastActivityDate));

      if (activeRivalries.length > 0) {
        const target = activeRivalries[0];
        setRivalries((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? { ...r, historyEntryIds: [...(r.historyEntryIds ?? []), note.id] }
              : r
          )
        );
      }
    }

    // Save GMReply
    const gmReply: GMReply = {
      id: crypto.randomUUID(),
      messageId: message.id,
      templateId: selectedReplyId ?? "reply.custom",
      bodyText: replyText,
      createdNightNoteId: note.id,
      at: Date.now(),
    };
    setReplies((prev) => [...prev, gmReply]);

    // Generate auto-reply if talent sender (and not silent treatment)
    if (message.senderType === "TALENT" && !isSilent) {
      const w = roster.find(
        (r) => r.id === message.fromWrestlerId || r.name === message.from
      );
      const alignment = w?.alignment ?? "TWEENER";
      let ackText: string;
      if (alignment === "HEEL") {
        ackText = `Good. Don't waste my time. — ${message.from}`;
      } else if (alignment === "FACE") {
        ackText = `Appreciate it. Won't let you down. — ${message.from}`;
      } else {
        ackText = `We will see how this plays out. — ${message.from}`;
      }

      const autoReply: GeneratedInboxMessage = {
        id: crypto.randomUUID(),
        senderType: "TALENT",
        fromName: message.from,
        fromWrestlerId: message.fromWrestlerId,
        subject: `Re: ${message.subject}`,
        body: ackText,
        templateId: "auto.reply",
        generatedAt: Date.now(),
        universeDate,
        isAutoReply: true,
        inReplyToId: message.id,
      };

      setInboxGenerated((prev) => {
        const combined = [autoReply, ...prev];
        return combined.slice(0, 300);
      });
    }

    // Mark original as read
    onMarkRead(message.id);

    toast.success("Reply filed as canon.", {
      description: `${message.from} acknowledged.`,
    });

    // Reset state and close
    setSelectedReplyId(null);
    setCustomText("");
    onOpenChange(false);
  }

  function handleCancel() {
    setSelectedReplyId(null);
    setCustomText("");
    onOpenChange(false);
  }

  const showCustomTextarea =
    selectedReplyId === "reply.custom" || selectedReplyId === "reply.silence" || selectedReplyId === null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col"
        style={{ background: "#0d0d0d", borderColor: "#222", padding: 0 }}
      >
        <div
          style={{
            background: "#111",
            borderBottom: "1px solid #222",
            padding: "20px 20px 16px",
            flexShrink: 0,
          }}
        >
          <SheetHeader>
            <div
              style={{
                fontFamily: PX,
                fontSize: "8px",
                color: "#dc1e1e",
                letterSpacing: "2px",
                marginBottom: "8px",
              }}
            >
              REPLY AS GM
            </div>
            <SheetTitle
              style={{
                fontFamily: BODY,
                fontSize: "16px",
                color: "#fff",
                textAlign: "left",
                fontWeight: "bold",
              }}
            >
              {message.from}
            </SheetTitle>
            <div
              style={{
                fontFamily: BODY,
                fontSize: "12px",
                color: "#666",
                fontStyle: "italic",
                marginTop: "2px",
              }}
            >
              {message.subject}
            </div>
          </SheetHeader>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          <div
            style={{
              fontFamily: PX,
              fontSize: "6px",
              color: "#555",
              letterSpacing: "1px",
              marginBottom: "8px",
            }}
          >
            SELECT A RESPONSE
          </div>

          {applicableReplies.map((rt) => {
            const isSelected = selectedReplyId === rt.id;
            return (
              <button
                key={rt.id}
                type="button"
                onClick={() => setSelectedReplyId(isSelected ? null : rt.id)}
                style={{
                  background: isSelected ? "#1a0808" : "#141414",
                  borderTop: `1px solid ${isSelected ? "#dc1e1e" : "#222"}`,
                  borderRight: `1px solid ${isSelected ? "#dc1e1e" : "#222"}`,
                  borderBottom: `1px solid ${isSelected ? "#dc1e1e" : "#222"}`,
                  borderLeft: `3px solid ${isSelected ? "#dc1e1e" : "transparent"}`,
                  padding: "10px 14px",
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: "3px",
                  fontFamily: BODY,
                  fontSize: "13px",
                  color: isSelected ? "#fff" : "#999",
                  transition: "all 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#333";
                    e.currentTarget.style.color = "#ccc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.borderColor = "#222";
                    e.currentTarget.style.color = "#999";
                  }
                }}
              >
                {rt.label}
              </button>
            );
          })}

          <div style={{ marginTop: "12px" }}>
            <div
              style={{
                fontFamily: PX,
                fontSize: "6px",
                color: "#555",
                letterSpacing: "1px",
                marginBottom: "8px",
              }}
            >
              CUSTOM NOTE
            </div>
            <Textarea
              placeholder="Write your own reply..."
              value={customText}
              onChange={(e) => {
                setCustomText(e.target.value);
                if (e.target.value && selectedReplyId !== "reply.custom") {
                  setSelectedReplyId("reply.custom");
                }
              }}
              rows={4}
              style={{
                background: "#0a0a0a",
                border: "1px solid #222",
                color: "#ccc",
                fontFamily: BODY,
                fontSize: "13px",
                resize: "vertical",
                borderRadius: "3px",
              }}
            />
          </div>
        </div>

        <SheetFooter
          style={{
            background: "#0d0d0d",
            borderTop: "1px solid #1e1e1e",
            padding: "14px 20px",
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-end",
            gap: "10px",
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={handleCancel}
            style={{
              fontFamily: PX,
              fontSize: "6px",
              background: "transparent",
              border: "1px solid #333",
              padding: "8px 14px",
              cursor: "pointer",
              color: "#666",
              letterSpacing: "1px",
              borderRadius: "3px",
            }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleSend}
            style={{
              fontFamily: PX,
              fontSize: "7px",
              background: "#dc1e1e",
              border: "1px solid #b01818",
              padding: "8px 18px",
              cursor: "pointer",
              color: "#fff",
              letterSpacing: "1px",
              borderRadius: "3px",
              fontWeight: "bold",
            }}
          >
            SEND
          </button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
