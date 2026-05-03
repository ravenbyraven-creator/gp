# Wrestler Inbox — Hand-Off File
## Instructions for the Replit Agent in the other project

Hey agent — add a retro game-style **Inbox tab** to this app. Everything you need is below. Do not change the visual design — just wire it in and connect it to the existing roster data.

---

## STEP 1 — Add the Google Font

In the main HTML file (usually `index.html`), add this line inside `<head>`:

```html
<link rel="stylesheet" media="print" onload="this.media='all'"
      href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap">
```

---

## STEP 2 — Create the component file

Create a new file called `WrestlerInbox.tsx` (put it wherever components live in this project) and paste in the entire block below exactly as-is:

```tsx
import { useState } from "react";

export interface Message {
  id: string;
  from: string;       // wrestler name
  subject: string;    // short subject line
  body: string;       // full message text
  date: string;       // display date e.g. "May 1"
  location: string;   // show name e.g. "RAW" or "SmackDown"
  read: boolean;      // false = unread (shows red dot + blue text)
}

// ─────────────────────────────────────────────
// WIRE YOUR ROSTER HERE
// Replace SAMPLE_MESSAGES with real data from
// your roster. Each entry = one inbox message.
// ─────────────────────────────────────────────
const SAMPLE_MESSAGES: Message[] = [
  {
    id: "1",
    from: "Stone Cold Steve Austin",
    subject: "Watch your back...",
    body: "Listen here, partner. I've been watchin' you real close lately, and I'll tell ya what — you better bring your A-game come Monday. 'Cause Stone Cold Steve Austin don't take prisoners, and he sure as hell don't take kindly to anyone tryin' to snake his spot. And that's the bottom line, 'cause Stone Cold said so.",
    date: "May 1",
    location: "RAW",
    read: false,
  },
  {
    id: "2",
    from: "The Rock",
    subject: "Do you SMELL what The Rock is cooking?",
    body: "Finally... The Rock HAS COME BACK to your inbox. The Rock wants you to know that whatever jabroni plan you're cooking up, it ain't gonna work. You see, The Rock is the most electrifying man in sports entertainment today, and The Rock lays the smackdown on candy asses like you every single day of the week. Know your role and shut your mouth.",
    date: "Apr 30",
    location: "SmackDown",
    read: false,
  },
  {
    id: "3",
    from: "Triple H",
    subject: "The Game never loses",
    body: "You think you can compete with me? I am the cerebral assassin. I have been playing this game longer than you've been in this business. Every move you make, I've already thought ten steps ahead. This isn't a threat — this is a guarantee. I am that damn good.",
    date: "Apr 29",
    location: "RAW",
    read: true,
  },
  {
    id: "4",
    from: "Undertaker",
    subject: "Rest. In. Peace.",
    body: "Your time... is up. You cannot escape what is coming. The Deadman has seen many challengers come and go, and each one has been laid to rest in my yard. Do not make the mistake of stepping into the darkness. You will not find your way out.",
    date: "Apr 28",
    location: "SmackDown",
    read: true,
  },
  {
    id: "5",
    from: "Kurt Angle",
    subject: "It's true, it's DAMN true!",
    body: "Listen up. I'm an Olympic gold medalist with a broken freakin' neck. I've beaten the best in the world. You think you've got what it takes to hang with me? It's true. It's true. You don't. But hey, maybe with some training you could come close. Maybe.",
    date: "Apr 27",
    location: "SmackDown",
    read: true,
  },
  {
    id: "6",
    from: "Shawn Michaels",
    subject: "The Heartbreak Kid wants a word",
    body: "Hey there sugar. HBK here. You know, I've been the showstopper, the main event, Mr. WrestleMania for a reason — nobody does it better than the Heartbreak Kid. Just wanted to drop you a line: when you see me walk through that curtain, you better be ready. Because I'm gonna steal the show. Like I always do.",
    date: "Apr 26",
    location: "RAW",
    read: true,
  },
];

const PX = "'Press Start 2P', monospace";
const BODY_FONT = "'Courier New', Courier, monospace";

export function WrestlerInbox() {
  const [messages, setMessages] = useState<Message[]>(SAMPLE_MESSAGES);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const unread = messages.filter((m) => !m.read).length;

  function openMessage(msg: Message) {
    setSelectedId(msg.id);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, read: true } : m))
    );
  }

  function closeMessage() {
    setSelectedId(null);
  }

  const displayMsg = selected ?? messages[0];

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#3a3a4a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: BODY_FONT,
      }}
    >
      <InboxHeader date={displayMsg.date} location={displayMsg.location} unread={unread} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "8px 12px 6px",
          gap: "6px",
          overflow: "hidden",
        }}
      >
        {selected ? (
          <DetailView message={selected} onBack={closeMessage} />
        ) : (
          <ListView messages={messages} onOpen={openMessage} />
        )}
      </div>

      <InboxFooter showBack={!!selected} />
    </div>
  );
}

function InboxHeader({
  date,
  location,
  unread,
}: {
  date: string;
  location: string;
  unread: number;
}) {
  return (
    <div
      style={{
        background: "linear-gradient(to bottom, #10103a 0%, #050520 100%)",
        borderBottom: "3px solid #000",
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
          background: "#000",
          border: "2px outset #555",
          padding: "4px 8px",
          fontFamily: PX,
          fontSize: "7px",
          color: "#fff",
          letterSpacing: "1px",
        }}
      >
        1P
      </div>

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
            textShadow: "3px 3px 0 #000, 0 0 20px #4444ff",
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
            ★ {unread} NEW {unread === 1 ? "MESSAGE" : "MESSAGES"} ★
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
          fontSize: "7px",
          color: "#fff",
          lineHeight: "1.8",
          letterSpacing: "0.5px",
        }}
      >
        <div>{date}</div>
        <div style={{ color: "#aaa" }}>{location}</div>
      </div>
    </div>
  );
}

function ListView({
  messages,
  onOpen,
}: {
  messages: Message[];
  onOpen: (m: Message) => void;
}) {
  const unread = messages.filter((m) => !m.read);
  const read = messages.filter((m) => m.read);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        flex: 1,
        overflowY: "auto",
      }}
    >
      {unread.length > 0 && <SectionLabel label="NEW MESSAGES" />}
      {unread.map((msg) => (
        <MessageRow key={msg.id} msg={msg} onOpen={onOpen} />
      ))}
      {read.length > 0 && <SectionLabel label="READ MESSAGES" />}
      {read.map((msg) => (
        <MessageRow key={msg.id} msg={msg} onOpen={onOpen} />
      ))}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: PX,
        fontSize: "6px",
        color: "#888",
        padding: "4px 6px 2px",
        letterSpacing: "1px",
      }}
    >
      {label}
    </div>
  );
}

function MessageRow({
  msg,
  onOpen,
}: {
  msg: Message;
  onOpen: (m: Message) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onOpen(msg)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "#b0b0d8" : "#c0c0c0",
        border: hovered ? "2px inset #aaa" : "2px outset #e0e0e0",
        padding: "8px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
        <span
          style={{
            fontFamily: PX,
            fontSize: "6px",
            color: "#555",
            letterSpacing: "0.5px",
            flexShrink: 0,
          }}
        >
          From:
        </span>
        <span
          style={{
            fontFamily: BODY_FONT,
            fontSize: "14px",
            fontWeight: msg.read ? "normal" : "bold",
            color: msg.read ? "#111" : "#0000cc",
          }}
        >
          {!msg.read && (
            <span style={{ color: "#cc0000", marginRight: "6px" }}>●</span>
          )}
          {msg.from}
        </span>
        <span
          style={{
            marginLeft: "auto",
            fontFamily: PX,
            fontSize: "5px",
            color: "#777",
            flexShrink: 0,
          }}
        >
          {msg.date}
        </span>
      </div>
      <div
        style={{
          fontFamily: BODY_FONT,
          fontSize: "12px",
          color: msg.read ? "#555" : "#0000cc",
          textDecoration: msg.read ? "none" : "underline",
          paddingLeft: "2px",
          fontStyle: "italic",
        }}
      >
        {msg.subject}
      </div>
    </div>
  );
}

function DetailView({
  message,
  onBack,
}: {
  message: Message;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          background: "#c0c0c0",
          border: "2px outset #e0e0e0",
          padding: "7px 12px",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: PX,
            fontSize: "6px",
            color: "#444",
            letterSpacing: "0.5px",
          }}
        >
          From:
        </span>
        <span
          style={{
            fontFamily: BODY_FONT,
            fontSize: "15px",
            fontWeight: "bold",
            color: "#111",
          }}
        >
          {message.from}
        </span>
      </div>

      <div
        style={{
          background: "#d4d4d4",
          border: "2px inset #aaa",
          borderTop: "none",
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "8px 14px 6px",
            borderBottom: "1px solid #aaa",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: BODY_FONT,
              fontSize: "14px",
              fontWeight: "bold",
              color: "#0000cc",
              textDecoration: "underline",
            }}
          >
            {message.subject}
          </span>
        </div>

        <div
          style={{
            padding: "14px 16px",
            overflowY: "auto",
            flex: 1,
          }}
        >
          <p
            style={{
              fontFamily: BODY_FONT,
              fontSize: "14px",
              color: "#111",
              lineHeight: "1.9",
              margin: 0,
            }}
          >
            {message.body}
          </p>
        </div>
      </div>
    </div>
  );
}

function InboxFooter({ showBack }: { showBack: boolean }) {
  const buttons = showBack
    ? [
        { key: "← B", label: "BACK" },
        { key: "START", label: "MENU" },
      ]
    : [
        { key: "↑↓", label: "SELECT" },
        { key: "→ A", label: "OPEN" },
        { key: "START", label: "MENU" },
      ];

  return (
    <div
      style={{
        background: "linear-gradient(to bottom, #10103a 0%, #050520 100%)",
        borderTop: "3px solid #000",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        padding: "7px 16px",
        flexShrink: 0,
      }}
    >
      {buttons.map(({ key, label }) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <span
            style={{
              fontFamily: PX,
              fontSize: "6px",
              color: "#fff",
              background: "#222",
              border: "2px outset #555",
              padding: "3px 6px",
            }}
          >
            {key}
          </span>
          <span
            style={{
              fontFamily: PX,
              fontSize: "5px",
              color: "#999",
              letterSpacing: "1px",
            }}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
```

---

## STEP 3 — Add it as a tab

In whatever file controls the app's tabs/navigation, import and add `WrestlerInbox` as a new tab:

```tsx
import { WrestlerInbox } from "./WrestlerInbox"; // adjust path if needed

// Then wherever tabs are rendered, add:
// Tab button: label it "Inbox" or "E-Mail"
// Tab content: <WrestlerInbox />
```

---

## STEP 4 — Wire to the real roster

Find where the roster data lives in this project. Then replace `SAMPLE_MESSAGES` in `WrestlerInbox.tsx` with data mapped from the roster. Each wrestler becomes one message. Example:

```tsx
// If roster looks like: { id, name, show, ... }
const messages: Message[] = roster.map((wrestler, i) => ({
  id: String(wrestler.id),
  from: wrestler.name,
  subject: "A message from " + wrestler.name,
  body: "Hey GM, just checking in.",
  date: "May 1",
  location: wrestler.show ?? "RAW",
  read: false,
}));
```

Pass it as a prop or replace the array directly — either works.

---

That's everything. No extra packages needed beyond React.
