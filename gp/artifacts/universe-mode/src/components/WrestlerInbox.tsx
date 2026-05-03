import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  useRoster,
  useHistory,
  useLocalStorage,
  useUniverseDate,
  useChampionLookup,
  type RivalryEntry,
} from "@/lib/storage";
import { ChampionBeltOverlay } from "@/components/ui/champion-belt-overlay";
import { formatDate } from "@/lib/calendar";
import { Input } from "@/components/ui/input";
import type { Wrestler, StorylineScene, ShowCard, SurpriseScene, PromoScript } from "@workspace/api-client-react";
import {
  useInboxGenerated,
  useInboxArchivedIds,
  useInboxDeletedIds,
  useInboxStarredIds,
  useInboxReplies,
} from "@/lib/inbox";
import type { SenderType } from "@/lib/inbox-templates";
import { InboxComposeReply } from "@/components/InboxComposeReply";
import type { ReplyTarget } from "@/components/InboxComposeReply";

const PX = "'Press Start 2P', monospace";
const BODY = "'Courier New', Courier, monospace";

// ─── Persisted read state ──────────────────────────────────────────────────

export function useInboxReadIds() {
  return useLocalStorage<string[]>("umc.inboxReadIds", []);
}

export function useInboxUnreadCount() {
  const [history] = useHistory();
  const [generated] = useInboxGenerated();
  const [readIds] = useInboxReadIds();
  const [archivedIds] = useInboxArchivedIds();
  const [deletedIds] = useInboxDeletedIds();
  const readSet = new Set(readIds);
  const archivedSet = new Set(archivedIds);
  const deletedSet = new Set(deletedIds);

  const historyUnread = history.filter(
    (e) =>
      e.kind !== "log" &&
      e.kind !== "magazine" &&
      !readSet.has(e.id) &&
      !archivedSet.has(e.id) &&
      !deletedSet.has(e.id)
  ).length;

  const generatedUnread = generated.filter(
    (g) =>
      !readSet.has(g.id) &&
      !archivedSet.has(g.id) &&
      !deletedSet.has(g.id)
  ).length;

  return historyUnread + generatedUnread;
}

// ─── Message type ─────────────────────────────────────────────────────────

export interface InboxMessage {
  id: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  location: string;
  imageUrl?: string;
  wrestlerId?: string;
  senderType?: SenderType;
  templateId?: string;
  isAutoReply?: boolean;
  inReplyToId?: string;
  _timestamp: number;
}

const LOCATION_MAP: Record<string, string> = {
  RAW: "RAW",
  SMACKDOWN: "SmackDown",
  NXT: "NXT",
  FREE_AGENT: "Gorilla Position",
};

const SENDER_TYPE_LABEL: Record<SenderType, string> = {
  TALENT: "Talent",
  FRONT_OFFICE: "Front Office",
  BACKSTAGE: "Backstage",
  PRESS: "Press",
  MARKETING: "Marketing",
  MEDICAL: "Medical",
  SPONSOR: "Sponsor",
  SYSTEM: "System",
};

function wrestlerLocation(w: Wrestler | undefined): string {
  return LOCATION_MAP[w?.brand ?? "FREE_AGENT"] ?? "Gorilla Position";
}

function formatEntryDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function findWrestler(name: string, rosterMap: Map<string, Wrestler>): Wrestler | undefined {
  return rosterMap.get(name.toLowerCase());
}

// ── History-derived message builders ──────────────────────────────────────

function buildStorylineMessage(
  entry: Extract<RivalryEntry, { kind: "storyline" }>,
  rosterMap: Map<string, Wrestler>
): InboxMessage | null {
  const { data } = entry;
  const participants: string[] = data.participants ?? [];
  if (participants.length === 0) return null;
  const sender = participants[0];
  const opponent = participants[1] ?? null;
  const w = findWrestler(sender, rosterMap);
  const alignment = w?.alignment ?? "TWEENER";

  let subject = `RE: ${data.feud}`;
  let body: string;

  if (alignment === "HEEL") {
    body = opponent
      ? `I saw that you went ahead and officially put me in this thing with ${opponent}. Good. You finally made a smart decision. ${data.feud} — that has a ring to it. Just know that when this is over, I come out on top. That's not arrogance, that's a guarantee. Don't mess with the booking or I'll make your life difficult. — ${sender}`
      : `I saw you booked me into ${data.feud}. Fine. But if this isn't main event level by the time it's done, we're going to have a very serious conversation. I'm not carrying dead weight in some forgettable midcard angle. Book me right. — ${sender}`;
  } else if (alignment === "FACE") {
    body = opponent
      ? `GM! Just saw the booking — ${data.feud}. I am FIRED UP. Me and ${opponent} is exactly the kind of match the fans have been waiting for. I'm going to go out there every single week and make this the storyline everyone's talking about. You won't regret this. Let's do it. — ${sender}`
      : `Just read the booking — ${data.feud}. This is exactly the kind of challenge I've been looking for. I'll put everything I've got into this. The fans are going to love it. Thank you for trusting me with this angle. — ${sender}`;
  } else {
    body = opponent
      ? `Interesting choice putting me in this with ${opponent}. I'll be honest — I wasn't sure where things were going creatively, but ${data.feud} has potential. I'm not making any promises about which direction I take this, but I will make it must-see. Expect the unexpected. — ${sender}`
      : `Saw the booking. ${data.feud}. I've got some thoughts on where this could go — some of them you'll like, some of them you might not. Either way, I'll deliver something nobody forgets. — ${sender}`;
  }

  return {
    id: entry.id,
    from: sender,
    subject,
    body,
    date: formatEntryDate(entry.createdAt),
    location: wrestlerLocation(w),
    imageUrl: w?.imageUrl ?? undefined,
    wrestlerId: w?.id,
    senderType: "TALENT",
    _timestamp: entry.createdAt,
  };
}

function buildShowMessage(
  entry: Extract<RivalryEntry, { kind: "show" }>,
  rosterMap: Map<string, Wrestler>
): InboxMessage | null {
  const { data } = entry;
  const matches: { match: string; result: string }[] = data.matches ?? [];
  if (matches.length === 0) return null;

  const mainEvent = matches[matches.length - 1];
  const firstNameMatch = mainEvent.match ?? matches[0].match;
  const parts = firstNameMatch.split(/\s+vs\.?\s+/i);
  const senderName = parts[0]?.trim().replace(/\s*—.*$/, "").trim() ?? "";
  const w = senderName ? findWrestler(senderName, rosterMap) : undefined;
  const alignment = w?.alignment ?? "FACE";

  const showDisplayName = data.showName ?? "the show";
  let body: string;

  if (alignment === "HEEL") {
    body = `${showDisplayName}. Interesting card you put together. My match is going to be the highlight of the night whether you planned for it or not. Just make sure you don't bury me with a bad segment placement. I carry this show every single week and I expect that to be reflected in how I'm positioned. — ${senderName || "Your Main Event"}`;
  } else if (alignment === "FACE") {
    body = `Saw the card for ${showDisplayName} — this is going to be a great night! The fans are going to get exactly what they paid for. I'll make sure my match delivers, I promise you that. Ready to go out there and steal the show. Let's have a great one. — ${senderName || "Your Talent"}`;
  } else {
    body = `${showDisplayName} looks solid. I've got no complaints about how I'm positioned this week. I'll show up, do my thing, and make sure people remember this episode. That's all I can promise. — ${senderName || "Your Talent"}`;
  }

  return {
    id: entry.id,
    from: senderName || "Talent Relations",
    subject: `Re: ${showDisplayName} Card`,
    body,
    date: formatEntryDate(entry.createdAt),
    location: wrestlerLocation(w),
    imageUrl: w?.imageUrl ?? undefined,
    wrestlerId: w?.id,
    senderType: "TALENT",
    _timestamp: entry.createdAt,
  };
}

function buildSurpriseMessage(
  entry: Extract<RivalryEntry, { kind: "surprise" }>,
  rosterMap: Map<string, Wrestler>
): InboxMessage | null {
  const { data } = entry;
  const headline = data.headline ?? "Something happened";

  const firstBeat: string = (data.beats?.[0]?.text ?? "");
  const nameGuess =
    rosterMap.size > 0
      ? [...rosterMap.values()].find(
          (w) =>
            headline.toUpperCase().includes(w.name.toUpperCase()) ||
            firstBeat.toUpperCase().includes(w.name.toUpperCase())
        )
      : undefined;

  const sender = nameGuess?.name ?? "Anonymous";
  const w = nameGuess;

  return {
    id: entry.id,
    from: sender,
    subject: `Re: Tonight's Incident`,
    body: `GM — I'm sure you saw what happened. "${headline}". I just want you to know I had nothing to do with the planning of that. Or maybe I did. Either way, things are going to get very interesting from here. Watch your back and watch the show closely. You're going to want to remember where this all started. — ${sender}`,
    date: formatEntryDate(entry.createdAt),
    location: wrestlerLocation(w),
    imageUrl: w?.imageUrl ?? undefined,
    wrestlerId: w?.id,
    senderType: "TALENT",
    _timestamp: entry.createdAt,
  };
}

function buildPromoMessage(
  entry: Extract<RivalryEntry, { kind: "promo" }>,
  rosterMap: Map<string, Wrestler>
): InboxMessage | null {
  const { data } = entry;
  const name: string = (data as Record<string, unknown>).wrestlerName as string ?? "";
  if (!name) return null;
  const w = findWrestler(name, rosterMap);
  const alignment = w?.alignment ?? "TWEENER";

  let body: string;
  const headline: string = (data as Record<string, unknown>).headline as string ?? "the promo";

  if (alignment === "HEEL") {
    body = `Did you catch my promo? "${headline}" — that's what I call mic work. Nobody in that locker room can touch me on the stick. If you want ratings, you put me in front of that microphone every single week. I'm the most entertaining thing on this show and everyone knows it. — ${name}`;
  } else if (alignment === "FACE") {
    body = `GM, I just wanted to say thank you for the promo time tonight. I meant every word I said out there. "${headline}" — that came straight from the heart. The crowd felt it too. This is why I do this. Ready to keep building on this momentum. — ${name}`;
  } else {
    body = `I cut the promo you asked for. "${headline}". I went somewhere unexpected with it — hope that's okay. Sometimes you have to trust the moment. Let me know how the crowd responded. I have a feeling this is going to change some things. — ${name}`;
  }

  return {
    id: entry.id,
    from: name,
    subject: `After my promo...`,
    body,
    date: formatEntryDate(entry.createdAt),
    location: wrestlerLocation(w),
    imageUrl: w?.imageUrl ?? undefined,
    wrestlerId: w?.id,
    senderType: "TALENT",
    _timestamp: entry.createdAt,
  };
}

export function buildMessages(
  history: RivalryEntry[],
  rosterMap: Map<string, Wrestler>
): InboxMessage[] {
  const msgs: InboxMessage[] = [];
  for (const entry of history) {
    let msg: InboxMessage | null = null;
    if (entry.kind === "storyline")
      msg = buildStorylineMessage(entry as Extract<RivalryEntry, { kind: "storyline" }>, rosterMap);
    else if (entry.kind === "show")
      msg = buildShowMessage(entry as Extract<RivalryEntry, { kind: "show" }>, rosterMap);
    else if (entry.kind === "surprise")
      msg = buildSurpriseMessage(entry as Extract<RivalryEntry, { kind: "surprise" }>, rosterMap);
    else if (entry.kind === "promo")
      msg = buildPromoMessage(entry as Extract<RivalryEntry, { kind: "promo" }>, rosterMap);
    if (msg) msgs.push(msg);
  }
  return msgs;
}

// ─── Folder type ─────────────────────────────────────────────────────────

type Folder = "all" | "unread" | "starred" | "archived";

// ─── Component ────────────────────────────────────────────────────────────

export function WrestlerInbox() {
  const [roster] = useRoster();
  const [history] = useHistory();
  const [readIds, setReadIds] = useInboxReadIds();
  const [generated] = useInboxGenerated();
  const [archivedIds, setArchivedIds] = useInboxArchivedIds();
  const [deletedIds, setDeletedIds] = useInboxDeletedIds();
  const [starredIds, setStarredIds] = useInboxStarredIds();
  const [universeDate] = useUniverseDate();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [folder, setFolder] = useState<Folder>("all");
  const [senderFilter, setSenderFilter] = useState<Set<SenderType>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);

  const rosterMap = useMemo(
    () => new Map(roster.map((w) => [w.name.toLowerCase(), w])),
    [roster]
  );

  const historyMsgs = useMemo(() => buildMessages(history, rosterMap), [history, rosterMap]);

  const generatedMsgs = useMemo((): InboxMessage[] => {
    return generated.map((g) => {
      const w = g.fromWrestlerId
        ? roster.find((r) => r.id === g.fromWrestlerId)
        : undefined;
      const locationLabel = w
        ? wrestlerLocation(w)
        : SENDER_TYPE_LABEL[g.senderType] ?? "Gorilla Position";
      return {
        id: g.id,
        from: g.fromName,
        subject: g.subject,
        body: g.body,
        date: formatEntryDate(g.generatedAt),
        location: locationLabel,
        imageUrl: w?.imageUrl ?? undefined,
        wrestlerId: g.fromWrestlerId,
        senderType: g.senderType,
        templateId: g.templateId,
        isAutoReply: g.isAutoReply,
        inReplyToId: g.inReplyToId,
        _timestamp: g.generatedAt,
      };
    });
  }, [generated, roster]);

  const allMessages = useMemo(() => {
    const combined = [...historyMsgs, ...generatedMsgs];
    combined.sort((a, b) => b._timestamp - a._timestamp);
    return combined;
  }, [historyMsgs, generatedMsgs]);

  const readSet = useMemo(() => new Set(readIds), [readIds]);
  const archivedSet = useMemo(() => new Set(archivedIds), [archivedIds]);
  const deletedSet = useMemo(() => new Set(deletedIds), [deletedIds]);
  const starredSet = useMemo(() => new Set(starredIds), [starredIds]);

  const visibleMessages = useMemo(() => {
    let msgs = allMessages.filter((m) => !deletedSet.has(m.id));

    if (folder === "archived") {
      msgs = msgs.filter((m) => archivedSet.has(m.id));
    } else {
      msgs = msgs.filter((m) => !archivedSet.has(m.id));
      if (folder === "unread") msgs = msgs.filter((m) => !readSet.has(m.id));
      if (folder === "starred") msgs = msgs.filter((m) => starredSet.has(m.id));
    }

    if (senderFilter.size > 0) {
      msgs = msgs.filter((m) => m.senderType && senderFilter.has(m.senderType));
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      msgs = msgs.filter(
        (m) =>
          m.from.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.body.toLowerCase().includes(q)
      );
    }

    // Sort: starred first, then unread, then by timestamp desc
    msgs.sort((a, b) => {
      const aStarred = starredSet.has(a.id) ? 0 : 1;
      const bStarred = starredSet.has(b.id) ? 0 : 1;
      if (aStarred !== bStarred) return aStarred - bStarred;
      const aUnread = !readSet.has(a.id) ? 0 : 1;
      const bUnread = !readSet.has(b.id) ? 0 : 1;
      if (aUnread !== bUnread) return aUnread - bUnread;
      return b._timestamp - a._timestamp;
    });

    return msgs;
  }, [allMessages, folder, senderFilter, search, deletedSet, archivedSet, readSet, starredSet]);

  const counts = useMemo(() => {
    const nonDeleted = allMessages.filter((m) => !deletedSet.has(m.id));
    const nonDeletedNonArchived = nonDeleted.filter((m) => !archivedSet.has(m.id));
    return {
      unread: nonDeletedNonArchived.filter((m) => !readSet.has(m.id)).length,
      starred: nonDeletedNonArchived.filter((m) => starredSet.has(m.id)).length,
      archived: nonDeleted.filter((m) => archivedSet.has(m.id)).length,
    };
  }, [allMessages, deletedSet, archivedSet, readSet, starredSet]);

  const selected = visibleMessages.find((m) => m.id === selectedId) ?? null;

  function markRead(id: string) {
    if (!readSet.has(id)) setReadIds((prev) => [...prev, id]);
  }

  function openMessage(msg: InboxMessage) {
    setSelectedId(msg.id);
    markRead(msg.id);
  }

  function closeMessage() {
    setSelectedId(null);
  }

  function toggleStar(id: string) {
    setStarredIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleArchive(id: string) {
    setArchivedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function doDelete(id: string) {
    setDeletedIds((prev) => [...prev, id]);
    if (selectedId === id) setSelectedId(null);
    setConfirmDeleteId(null);
  }

  function openReply(msg: InboxMessage) {
    if (msg.senderType === "SYSTEM") return;
    setReplyTarget({
      id: msg.id,
      from: msg.from,
      subject: msg.subject,
      templateId: msg.templateId,
      senderType: msg.senderType,
      fromWrestlerId: msg.wrestlerId,
    });
    setReplyOpen(true);
  }

  // ── Bulk actions ───────────────────────────────────────────────────────
  function bulkMarkRead() {
    setReadIds((prev) => [...new Set([...prev, ...selectedIds])]);
    setSelectedIds(new Set());
    toast.success(`Marked ${selectedIds.size} as read`);
  }

  function bulkStar() {
    setStarredIds((prev) => [...new Set([...prev, ...selectedIds])]);
    setSelectedIds(new Set());
    toast.success(`Starred ${selectedIds.size} messages`);
  }

  function bulkArchive() {
    setArchivedIds((prev) => [...new Set([...prev, ...selectedIds])]);
    setSelectedIds(new Set());
    toast.success(`Archived ${selectedIds.size} messages`);
  }

  function bulkDelete() {
    setDeletedIds((prev) => [...new Set([...prev, ...selectedIds])]);
    if (selectedId && selectedIds.has(selectedId)) setSelectedId(null);
    const count = selectedIds.size;
    setSelectedIds(new Set());
    toast.success(`Deleted ${count} messages`);
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleMessages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleMessages.map((m) => m.id)));
    }
  }

  function toggleSelectOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const formattedDate = formatDate(universeDate);

  const SENDER_TYPES: SenderType[] = [
    "TALENT", "FRONT_OFFICE", "BACKSTAGE", "PRESS", "MARKETING", "MEDICAL", "SYSTEM",
  ];

  function toggleSenderFilter(st: SenderType) {
    setSenderFilter((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0d0d0d",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: BODY,
      }}
    >
      <InboxHeader formattedDate={formattedDate} unread={counts.unread} />

      {/* Search bar */}
      <div style={{ padding: "8px 12px 0", flexShrink: 0 }}>
        <Input
          type="text"
          placeholder="Search messages..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#0a0a0a",
            border: "1px solid #222",
            color: "#ccc",
            fontFamily: BODY,
            fontSize: "13px",
            height: "32px",
            borderRadius: "3px",
          }}
        />
      </div>

      {/* Folder chips */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 12px 0",
          flexShrink: 0,
          overflowX: "auto",
          flexWrap: "nowrap",
        }}
      >
        {(["all", "unread", "starred", "archived"] as Folder[]).map((f) => {
          const count =
            f === "unread"
              ? counts.unread
              : f === "starred"
              ? counts.starred
              : f === "archived"
              ? counts.archived
              : undefined;
          const active = folder === f;
          return (
            <FolderChip
              key={f}
              label={f === "all" ? "ALL" : f.toUpperCase()}
              count={count}
              active={active}
              onClick={() => {
                setFolder(f);
                setSelectedId(null);
              }}
            />
          );
        })}

        <div
          style={{
            width: "1px",
            background: "#222",
            margin: "0 4px",
            flexShrink: 0,
            alignSelf: "stretch",
          }}
        />

        {SENDER_TYPES.map((st) => (
          <FolderChip
            key={st}
            label={
              st === "FRONT_OFFICE"
                ? "FRONT OFFICE"
                : st === "TALENT"
                ? "TALENT"
                : SENDER_TYPE_LABEL[st].toUpperCase()
            }
            active={senderFilter.has(st)}
            onClick={() => toggleSenderFilter(st)}
            dim
          />
        ))}
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          totalVisible={visibleMessages.length}
          onSelectAll={toggleSelectAll}
          onMarkRead={bulkMarkRead}
          onStar={bulkStar}
          onArchive={bulkArchive}
          onDelete={bulkDelete}
          onCancel={() => setSelectedIds(new Set())}
        />
      )}

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "6px 12px 6px",
          gap: "6px",
          overflow: "hidden",
        }}
      >
        {selected ? (
          <DetailView
            message={selected}
            onBack={closeMessage}
            isStarred={starredSet.has(selected.id)}
            isArchived={archivedSet.has(selected.id)}
            onStar={() => toggleStar(selected.id)}
            onArchive={() => toggleArchive(selected.id)}
            onDelete={() => {
              if (confirmDeleteId === selected.id) {
                doDelete(selected.id);
              } else {
                setConfirmDeleteId(selected.id);
                setTimeout(() => setConfirmDeleteId(null), 3000);
              }
            }}
            onReply={() => openReply(selected)}
            confirmingDelete={confirmDeleteId === selected.id}
          />
        ) : visibleMessages.length === 0 ? (
          <EmptyState folder={folder} hasSearch={Boolean(search)} />
        ) : (
          <ListView
            messages={visibleMessages}
            readSet={readSet}
            starredSet={starredSet}
            archivedSet={archivedSet}
            selectedIds={selectedIds}
            confirmDeleteId={confirmDeleteId}
            onOpen={openMessage}
            onToggleSelect={toggleSelectOne}
            onStar={toggleStar}
            onArchive={toggleArchive}
            onDelete={(id) => {
              if (confirmDeleteId === id) {
                doDelete(id);
              } else {
                setConfirmDeleteId(id);
                setTimeout(() => setConfirmDeleteId(null), 3000);
              }
            }}
            onReply={openReply}
          />
        )}
      </div>

      {replyTarget && (
        <InboxComposeReply
          open={replyOpen}
          onOpenChange={setReplyOpen}
          message={replyTarget}
          onMarkRead={markRead}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function InboxHeader({
  formattedDate,
  unread,
}: {
  formattedDate: string;
  unread: number;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(to bottom, #111 0%, #080808 100%)",
        borderBottom: "1px solid #1e1e1e",
        display: "flex",
        alignItems: "center",
        height: "56px",
        flexShrink: 0,
        padding: "0 10px",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: PX,
            fontSize: "16px",
            color: "#ffffff",
            letterSpacing: "6px",
            textShadow: "2px 2px 0 #000",
            fontStyle: "italic",
          }}
        >
          E-Mail
        </div>
        {unread > 0 && (
          <div
            style={{
              fontFamily: PX,
              fontSize: "5px",
              color: "#ffcc00",
              marginTop: "3px",
              letterSpacing: "1px",
            }}
          >
            {unread} NEW {unread === 1 ? "MESSAGE" : "MESSAGES"}
          </div>
        )}
      </div>
      <div
        style={{
          marginLeft: "auto",
          background: "#000",
          border: "2px outset #555",
          padding: "6px 10px",
          textAlign: "right",
          fontFamily: PX,
          fontSize: "6px",
          color: "#fff",
          letterSpacing: "0.5px",
        }}
      >
        {formattedDate}
      </div>
    </div>
  );
}

function FolderChip({
  label,
  count,
  active,
  onClick,
  dim,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
  dim?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        fontFamily: PX,
        fontSize: "5px",
        background: active ? "#1a0606" : "transparent",
        border: `1px solid ${active ? "#dc1e1e" : dim ? "#1e1e1e" : "#2a2a2a"}`,
        color: active ? "#dc1e1e" : dim ? "#555" : "#666",
        padding: "4px 8px",
        cursor: "pointer",
        letterSpacing: "1px",
        borderRadius: "2px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = "#444";
          e.currentTarget.style.color = "#aaa";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.borderColor = dim ? "#1e1e1e" : "#2a2a2a";
          e.currentTarget.style.color = dim ? "#555" : "#666";
        }
      }}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          style={{
            marginLeft: "5px",
            background: active ? "#dc1e1e" : "#2a2a2a",
            color: active ? "#fff" : "#888",
            padding: "1px 4px",
            borderRadius: "2px",
            fontSize: "5px",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function BulkActionBar({
  count,
  totalVisible,
  onSelectAll,
  onMarkRead,
  onStar,
  onArchive,
  onDelete,
  onCancel,
}: {
  count: number;
  totalVisible: number;
  onSelectAll: () => void;
  onMarkRead: () => void;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        background: "#111",
        borderBottom: "1px solid #222",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 12px",
        flexShrink: 0,
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontFamily: PX,
          fontSize: "6px",
          color: "#dc1e1e",
          letterSpacing: "0.5px",
        }}
      >
        {count} selected
      </span>
      <button
        type="button"
        onClick={onSelectAll}
        style={bulkBtnStyle}
      >
        {count === totalVisible ? "DESELECT ALL" : "SELECT ALL"}
      </button>
      <div style={{ width: "1px", height: "12px", background: "#222" }} />
      <button type="button" onClick={onMarkRead} style={bulkBtnStyle}>MARK READ</button>
      <button type="button" onClick={onStar} style={bulkBtnStyle}>STAR</button>
      <button type="button" onClick={onArchive} style={bulkBtnStyle}>ARCHIVE</button>
      <button
        type="button"
        onClick={onDelete}
        style={{ ...bulkBtnStyle, color: "#dc1e1e", borderColor: "#dc1e1e33" }}
      >
        DELETE
      </button>
      <button
        type="button"
        onClick={onCancel}
        style={{ ...bulkBtnStyle, marginLeft: "auto" }}
      >
        CANCEL
      </button>
    </div>
  );
}

const bulkBtnStyle: React.CSSProperties = {
  fontFamily: PX,
  fontSize: "5px",
  background: "transparent",
  border: "1px solid #2a2a2a",
  color: "#777",
  padding: "4px 8px",
  cursor: "pointer",
  letterSpacing: "0.5px",
  borderRadius: "2px",
};

function EmptyState({ folder, hasSearch }: { folder: Folder; hasSearch: boolean }) {
  let msg: string;
  if (hasSearch) msg = "NO MESSAGES MATCH YOUR SEARCH";
  else if (folder === "archived") msg = "NO ARCHIVED MESSAGES";
  else if (folder === "starred") msg = "NO STARRED MESSAGES";
  else if (folder === "unread") msg = "ALL CAUGHT UP";
  else msg = "NO MESSAGES YET";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
        padding: "24px",
      }}
    >
      <div
        style={{
          fontFamily: PX,
          fontSize: "8px",
          color: "#888",
          letterSpacing: "1px",
          textAlign: "center",
          lineHeight: "2",
        }}
      >
        {msg}
      </div>
      {folder === "all" && !hasSearch && (
        <div
          style={{
            fontFamily: PX,
            fontSize: "6px",
            color: "#555",
            letterSpacing: "1px",
            textAlign: "center",
            lineHeight: "2.5",
            maxWidth: "320px",
          }}
        >
          YOUR INBOX REACTS TO CANON MOMENTS<br />
          AND ADVANCES. PLAN A SHOW OR<br />
          ADVANCE TIME TO WAKE THE LOCKER ROOM.
        </div>
      )}
    </div>
  );
}

function ListView({
  messages,
  readSet,
  starredSet,
  archivedSet,
  selectedIds,
  confirmDeleteId,
  onOpen,
  onToggleSelect,
  onStar,
  onArchive,
  onDelete,
  onReply,
}: {
  messages: InboxMessage[];
  readSet: Set<string>;
  starredSet: Set<string>;
  archivedSet: Set<string>;
  selectedIds: Set<string>;
  confirmDeleteId: string | null;
  onOpen: (m: InboxMessage) => void;
  onToggleSelect: (id: string) => void;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (m: InboxMessage) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        flex: 1,
        overflowY: "auto",
      }}
    >
      {messages.map((m) => (
        <MessageRow
          key={m.id}
          msg={m}
          isRead={readSet.has(m.id)}
          isStarred={starredSet.has(m.id)}
          isArchived={archivedSet.has(m.id)}
          isSelected={selectedIds.has(m.id)}
          confirmingDelete={confirmDeleteId === m.id}
          onOpen={onOpen}
          onToggleSelect={onToggleSelect}
          onStar={onStar}
          onArchive={onArchive}
          onDelete={onDelete}
          onReply={onReply}
        />
      ))}
    </div>
  );
}

function MessageRow({
  msg,
  isRead,
  isStarred,
  isArchived,
  isSelected,
  confirmingDelete,
  onOpen,
  onToggleSelect,
  onStar,
  onArchive,
  onDelete,
  onReply,
}: {
  msg: InboxMessage;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isSelected: boolean;
  confirmingDelete: boolean;
  onOpen: (m: InboxMessage) => void;
  onToggleSelect: (id: string) => void;
  onStar: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (m: InboxMessage) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const champLookup = useChampionLookup();
  const championships = champLookup.get(msg.wrestlerId ?? "") ?? [];

  const isSystem = msg.senderType === "SYSTEM";
  const isAutoReply = msg.isAutoReply;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: isSelected ? "#120808" : hovered ? "#1e1e1e" : "#141414",
        borderTop: `1px solid ${isSelected ? "#dc1e1e44" : hovered ? "#333" : "#222"}`,
        borderRight: `1px solid ${isSelected ? "#dc1e1e44" : hovered ? "#333" : "#222"}`,
        borderBottom: `1px solid ${isSelected ? "#dc1e1e44" : hovered ? "#333" : "#222"}`,
        borderLeft: `3px solid ${isStarred ? "#ffcc00" : !isRead ? "#dc1e1e" : "transparent"}`,
        padding: "7px 10px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexShrink: 0,
        borderRadius: "3px",
        transition: "background 0.1s, border-color 0.1s",
      }}
    >
      {/* Checkbox */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(msg.id);
        }}
        style={{
          width: "14px",
          height: "14px",
          border: `1px solid ${isSelected ? "#dc1e1e" : "#333"}`,
          background: isSelected ? "#dc1e1e" : "transparent",
          flexShrink: 0,
          borderRadius: "2px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {isSelected && (
          <span style={{ color: "#fff", fontSize: "9px", lineHeight: 1 }}>x</span>
        )}
      </div>

      {/* Avatar */}
      <div
        style={{ position: "relative", flexShrink: 0 }}
        onClick={() => onOpen(msg)}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            border: "1px solid #2a2a2a",
            background: "#1a1a1a",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "3px",
          }}
        >
          {msg.imageUrl ? (
            <img
              src={msg.imageUrl}
              alt={msg.from}
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
            />
          ) : (
            <span
              style={{
                fontFamily: PX,
                fontSize: "8px",
                color: isSystem ? "#444" : "#333",
              }}
            >
              {msg.from.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <ChampionBeltOverlay championships={championships} size="sm" />
      </div>

      {/* Content */}
      <div
        style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}
        onClick={() => onOpen(msg)}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span
            style={{
              fontFamily: BODY,
              fontSize: "13px",
              fontWeight: isRead ? "normal" : "bold",
              color: isRead ? "#888" : "#fff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {msg.from}
            {isAutoReply && (
              <span style={{ fontFamily: PX, fontSize: "5px", color: "#555", marginLeft: "6px", letterSpacing: "0.5px" }}>
                [auto-reply]
              </span>
            )}
          </span>
          <span
            style={{
              marginLeft: "auto",
              fontFamily: PX,
              fontSize: "5px",
              color: "#555",
              flexShrink: 0,
            }}
          >
            {msg.date}
          </span>
        </div>
        <div
          style={{
            fontFamily: BODY,
            fontSize: "12px",
            color: isRead ? "#555" : "#aaa",
            fontStyle: "italic",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {msg.subject}
        </div>
        {msg.senderType && msg.senderType !== "TALENT" && (
          <div style={{ fontFamily: PX, fontSize: "4px", color: "#444", letterSpacing: "0.5px" }}>
            {SENDER_TYPE_LABEL[msg.senderType]}
          </div>
        )}
      </div>

      {/* Action cluster — visible on hover or always on touch */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          alignItems: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.1s",
          flexShrink: 0,
        }}
      >
        {!isSystem && (
          <ActionIcon
            title="Reply"
            onClick={(e) => {
              e.stopPropagation();
              onReply(msg);
            }}
            color="#888"
          >
            R
          </ActionIcon>
        )}
        <ActionIcon
          title={isStarred ? "Unstar" : "Star"}
          onClick={(e) => {
            e.stopPropagation();
            onStar(msg.id);
          }}
          color={isStarred ? "#ffcc00" : "#888"}
        >
          {isStarred ? "S" : "s"}
        </ActionIcon>
        <ActionIcon
          title={isArchived ? "Unarchive" : "Archive"}
          onClick={(e) => {
            e.stopPropagation();
            onArchive(msg.id);
          }}
          color="#888"
        >
          A
        </ActionIcon>
        <ActionIcon
          title={confirmingDelete ? "Tap again to delete" : "Delete"}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(msg.id);
          }}
          color={confirmingDelete ? "#dc1e1e" : "#888"}
        >
          X
        </ActionIcon>
      </div>
    </div>
  );
}

function ActionIcon({
  children,
  title,
  onClick,
  color,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
  color: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        fontFamily: PX,
        fontSize: "6px",
        background: "transparent",
        border: "1px solid #2a2a2a",
        color,
        width: "20px",
        height: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        borderRadius: "2px",
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function DetailView({
  message,
  onBack,
  isStarred,
  isArchived,
  onStar,
  onArchive,
  onDelete,
  onReply,
  confirmingDelete,
}: {
  message: InboxMessage;
  onBack: () => void;
  isStarred: boolean;
  isArchived: boolean;
  onStar: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onReply: () => void;
  confirmingDelete: boolean;
}) {
  const champLookup = useChampionLookup();
  const championships = champLookup.get(message.wrestlerId ?? "") ?? [];
  const isSystem = message.senderType === "SYSTEM";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
        borderRadius: "4px",
        border: "1px solid #222",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#141414",
          borderBottom: "1px solid #222",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              border: "1px solid #2a2a2a",
              background: "#1a1a1a",
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "3px",
            }}
          >
            {message.imageUrl ? (
              <img
                src={message.imageUrl}
                alt={message.from}
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
              />
            ) : (
              <span style={{ fontFamily: PX, fontSize: "12px", color: "#444" }}>
                {message.from.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <ChampionBeltOverlay championships={championships} size="sm" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontFamily: PX, fontSize: "6px", color: "#555", letterSpacing: "0.5px" }}>From:</span>
            <span style={{ fontFamily: BODY, fontSize: "15px", fontWeight: "bold", color: "#fff" }}>
              {message.from}
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            <span style={{ fontFamily: PX, fontSize: "5px", color: "#555" }}>{message.location}</span>
            <span style={{ fontFamily: PX, fontSize: "5px", color: "#444" }}>{message.date}</span>
            {message.senderType && message.senderType !== "TALENT" && (
              <span style={{ fontFamily: PX, fontSize: "5px", color: "#444" }}>
                {SENDER_TYPE_LABEL[message.senderType]}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onBack}
          style={{
            fontFamily: PX,
            fontSize: "6px",
            background: "transparent",
            border: "1px solid #333",
            padding: "5px 10px",
            cursor: "pointer",
            color: "#888",
            letterSpacing: "1px",
            borderRadius: "3px",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#555";
            e.currentTarget.style.color = "#ccc";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#333";
            e.currentTarget.style.color = "#888";
          }}
        >
          BACK
        </button>
      </div>

      {/* Subject */}
      <div
        style={{
          background: "#0d0d0d",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 16px 8px",
            borderBottom: "1px solid #1e1e1e",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: BODY,
              fontSize: "14px",
              fontWeight: "bold",
              color: "#ccc",
            }}
          >
            {message.subject}
          </span>
          {message.isAutoReply && (
            <span style={{ fontFamily: PX, fontSize: "5px", color: "#555", marginLeft: "10px" }}>
              [auto-reply]
            </span>
          )}
        </div>

        {/* Body */}
        <div
          style={{
            padding: "16px 18px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <p
            style={{
              fontFamily: BODY,
              fontSize: "14px",
              color: "#aaa",
              lineHeight: "1.9",
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {message.body}
          </p>
        </div>
      </div>

      {/* Footer action bar */}
      <div
        style={{
          background: "#0d0d0d",
          borderTop: "1px solid #1e1e1e",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onStar}
          style={{
            ...detailActionStyle,
            borderColor: isStarred ? "#ffcc00" : "#2a2a2a",
            color: isStarred ? "#ffcc00" : "#666",
          }}
        >
          {isStarred ? "UNSTAR" : "STAR"}
        </button>
        <button
          type="button"
          onClick={onArchive}
          style={{ ...detailActionStyle, color: "#666" }}
        >
          {isArchived ? "UNARCHIVE" : "ARCHIVE"}
        </button>
        <button
          type="button"
          onClick={onDelete}
          style={{
            ...detailActionStyle,
            color: confirmingDelete ? "#dc1e1e" : "#666",
            borderColor: confirmingDelete ? "#dc1e1e" : "#2a2a2a",
          }}
        >
          {confirmingDelete ? "CONFIRM DELETE" : "DELETE"}
        </button>
        {!isSystem && (
          <button
            type="button"
            onClick={onReply}
            style={{
              ...detailActionStyle,
              marginLeft: "auto",
              background: "#dc1e1e",
              border: "1px solid #b01818",
              color: "#fff",
              padding: "5px 16px",
            }}
          >
            REPLY
          </button>
        )}
      </div>
    </div>
  );
}

const detailActionStyle: React.CSSProperties = {
  fontFamily: PX,
  fontSize: "5px",
  background: "transparent",
  border: "1px solid #2a2a2a",
  padding: "5px 10px",
  cursor: "pointer",
  letterSpacing: "0.5px",
  borderRadius: "2px",
};
