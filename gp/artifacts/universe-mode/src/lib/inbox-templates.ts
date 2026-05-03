import type { Wrestler } from "@workspace/api-client-react";
import type { Championship, RivalryEntry } from "./storage";
import type { UniverseDate, PremiumEvent } from "./calendar";
import { dateToInt, weeksUntil } from "./calendar";

export type SenderType =
  | "TALENT"
  | "FRONT_OFFICE"
  | "BACKSTAGE"
  | "PRESS"
  | "MARKETING"
  | "MEDICAL"
  | "SPONSOR"
  | "SYSTEM";

export interface TemplateContext {
  wrestler?: Wrestler;
  championships: Championship[];
  daysSinceLastBooking: number;
  daysSinceLastMessage: number;
  daysAsChampion: number;
  rosterSize: number;
  currentDate: UniverseDate;
  events?: PremiumEvent[];
  roster?: Wrestler[];
  history?: RivalryEntry[];
}

export interface InboxTemplate {
  id: string;
  senderType: SenderType;
  subject: (ctx: TemplateContext) => string;
  body: (ctx: TemplateContext) => string;
  eligible: (ctx: TemplateContext) => boolean;
  weight: number;
  cooldownDays: number;
}

export interface ReplyTemplate {
  id: string;
  appliesTo: string[];
  label: string;
  body: (ctx: { originalMsg: { from: string; subject: string; templateId?: string; senderType?: SenderType } }) => string;
}

const CITIES = [
  "Dallas", "Boston", "Chicago", "Los Angeles", "Atlanta",
  "Houston", "Seattle", "Denver", "Las Vegas", "Phoenix",
  "Nashville", "Detroit", "Portland", "Minneapolis", "Tampa",
];

const OUTLETS = [
  "The Wrestling Observer",
  "Fightful Select",
  "PWInsider",
  "Mat Report Weekly",
  "Ring Side News",
  "The Torch",
];

const SPONSORS = [
  "ActionFuel Energy",
  "TicketPro",
  "FanView Sports",
  "SportsPulse",
  "Stadium Brand",
];

const LEGEND_NAMES = [
  "a Hall of Famer", "an old-school legend", "a veteran of the game",
  "one of the all-time greats", "a living legend",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function champName(ctx: TemplateContext): string {
  if (ctx.championships.length === 0) return "the champion";
  return ctx.championships[0].currentChampionIds?.[0] ?? "the champion";
}

function firstVacantTitle(ctx: TemplateContext): Championship | undefined {
  return ctx.championships.find(
    (c) => c.active !== false && (!c.currentChampionIds || c.currentChampionIds.length === 0)
  );
}

function nearestPLE(ctx: TemplateContext): { event: PremiumEvent; weeks: number } | undefined {
  if (!ctx.events) return undefined;
  let best: { event: PremiumEvent; weeks: number } | undefined;
  for (const e of ctx.events) {
    const w = weeksUntil(e, ctx.currentDate);
    if (w >= 4 && w <= 6) {
      if (!best || w < best.weeks) best = { event: e, weeks: w };
    }
  }
  return best;
}

// ─── 30+ Talent + Non-Talent Templates ──────────────────────────────────────

export const INBOX_TEMPLATES: InboxTemplate[] = [

  // ── Talent templates ──────────────────────────────────────────────────────

  {
    id: "talent.idle.complaint",
    senderType: "TALENT",
    weight: 8,
    cooldownDays: 14,
    eligible: (ctx) => ctx.daysSinceLastBooking >= 21 && ctx.championships.length === 0,
    subject: () => "We need to talk about my booking",
    body: (ctx) => `GM — I have been watching my career rust on the bench. ${ctx.daysSinceLastBooking >= 999 ? "You have not booked me once since I arrived." : `It has been ${ctx.daysSinceLastBooking} days since I last had anything meaningful on TV.`} I did not sign here to sit in the locker room. Get me on television and give me something to work with. I will deliver, but you have to give me the chance. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.idle.injuryReturn",
    senderType: "TALENT",
    weight: 9,
    cooldownDays: 21,
    eligible: (ctx) => ctx.wrestler!.status === "INJURED" && ctx.daysSinceLastBooking >= 28,
    subject: () => "Cleared to compete",
    body: (ctx) => `GM — doc cleared me yesterday. I am ready to go. However long I was out, I used every day of it getting better and sharper. I am not asking to ease back in. Give me a match, give me a promo, give me something. I want back in the building. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.champ.brag",
    senderType: "TALENT",
    weight: 6,
    cooldownDays: 30,
    eligible: (ctx) => ctx.daysAsChampion >= 30 && ctx.championships.length > 0,
    subject: (ctx) => `Day ${ctx.daysAsChampion} — still nobody close`,
    body: (ctx) => `${ctx.daysAsChampion} days and nobody has even come close. I am not just holding this title, I am redefining what it means to be champion. The locker room knows it. The fans know it. You know it. Find me a real challenger. I am bored of winning this easily. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.champ.threat",
    senderType: "TALENT",
    weight: 5,
    cooldownDays: 35,
    eligible: (ctx) => ctx.daysAsChampion >= 60 && ctx.championships.length > 0,
    subject: (ctx) => `${ctx.daysAsChampion} days — record territory incoming`,
    body: (ctx) => `Going to break the all-time reign record at this rate. I just want to make sure you have that on your radar. This is not arrogance, this is math. Plan the milestone accordingly. A reign like this deserves a proper celebration. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.contender.titleShot",
    senderType: "TALENT",
    weight: 7,
    cooldownDays: 21,
    eligible: (ctx) =>
      ctx.championships.length === 0 &&
      (ctx.wrestler!.role === "MAIN_EVENTER" || ctx.wrestler!.role === "UPPER_MIDCARD"),
    subject: () => "I have earned a title shot",
    body: (ctx) => `GM — I have done everything you have asked. I have won the matches, cut the promos, put in the time. I have earned a shot at the gold. Do not make me ask twice. Set it up or I will start making noise about it publicly. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.freeAgent.signMe",
    senderType: "TALENT",
    weight: 6,
    cooldownDays: 56,
    eligible: (ctx) => ctx.wrestler!.brand === "FREE_AGENT" && ctx.daysSinceLastBooking >= 56,
    subject: () => "Interested in joining the roster",
    body: (ctx) => `GM — I have been watching what you are building and I want in. I am not going to pitch myself all day. You know what I can do. Sign me, put me somewhere with a purpose, and I will make you look good. Ball is in your court. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.heel.allianceOffer",
    senderType: "TALENT",
    weight: 5,
    cooldownDays: 28,
    eligible: (ctx) =>
      ctx.wrestler!.alignment === "HEEL" &&
      (ctx.roster ?? []).some(
        (w) =>
          w.alignment === "HEEL" &&
          w.id !== ctx.wrestler!.id &&
          w.brand === ctx.wrestler!.brand
      ),
    subject: () => "A proposition",
    body: (ctx) => {
      const partner = (ctx.roster ?? []).find(
        (w) => w.alignment === "HEEL" && w.id !== ctx.wrestler!.id && w.brand === ctx.wrestler!.brand
      );
      return `You and me on the same page could break this place. I have been watching the board and there is an obvious move here that nobody is making. Put me together with the right people and watch what happens. Think about it. — ${ctx.wrestler!.name}`;
    },
  },

  {
    id: "talent.face.thankYou",
    senderType: "TALENT",
    weight: 6,
    cooldownDays: 14,
    eligible: (ctx) =>
      ctx.wrestler!.alignment === "FACE" && ctx.daysSinceLastBooking <= 14,
    subject: () => "Thank you",
    body: (ctx) => `GM — just wanted to say thanks for the booking. I know you have a million things going on, but what we put together out there mattered. The fans felt it and so did I. I am not taking this for granted. Ready to keep building. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.tweener.swerveHint",
    senderType: "TALENT",
    weight: 5,
    cooldownDays: 21,
    eligible: (ctx) =>
      ctx.wrestler!.alignment === "TWEENER" && ctx.daysSinceLastBooking <= 21,
    subject: () => "I have an idea",
    body: (ctx) => `GM — I have an idea you are not going to like at first. Trust me on it. I know where this character needs to go next and it is not where anyone expects. Give me five minutes in your office and I will sell you on it. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.gimmick.changePitch",
    senderType: "TALENT",
    weight: 4,
    cooldownDays: 42,
    eligible: (ctx) =>
      ctx.wrestler!.role === "MIDCARD" ||
      ctx.wrestler!.role === "LOWER_MIDCARD" ||
      ctx.wrestler!.role === "JOBBER",
    subject: () => "Time for a new look",
    body: (ctx) => `GM — I have been thinking about this for a while and it is time for a change. The current direction is not connecting the way either of us hoped. I have something in mind that I think breaks through. Can we find time to talk? — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.tradeRequest",
    senderType: "TALENT",
    weight: 4,
    cooldownDays: 28,
    eligible: (ctx) =>
      (ctx.wrestler!.brand === "RAW" || ctx.wrestler!.brand === "SMACKDOWN") &&
      ctx.daysSinceLastBooking >= 14,
    subject: () => "Requesting a brand change",
    body: (ctx) => `GM — been thinking about this for a while. A different brand might wake me up creatively. I am not unhappy, I just think a fresh environment could unlock something in me. Put in a word with the other side. I will make it worth everyone's time. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.retirement.hint",
    senderType: "TALENT",
    weight: 3,
    cooldownDays: 90,
    eligible: (ctx) =>
      Boolean(
        ctx.wrestler!.notes &&
          (ctx.wrestler!.notes.toLowerCase().includes("hall of famer") ||
            ctx.wrestler!.notes.toLowerCase().includes("legend"))
      ),
    subject: () => "Got a few years left",
    body: (ctx) => `GM — I have been in this business long enough to know the road gets shorter every year. I still have something to give, but I want to make the time I have left count. Let us do something worth remembering. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.anniversary",
    senderType: "TALENT",
    weight: 3,
    cooldownDays: 365,
    eligible: (ctx) => ctx.currentDate.year > 0 && ctx.daysSinceLastBooking <= 60,
    subject: () => "One year in",
    body: (ctx) => `GM — one year ago today, I made the decision to be here. Best call either of us made. A lot has happened and I am not done yet. Whatever comes next, I am committed. — ${ctx.wrestler!.name}`,
  },

  {
    id: "talent.match.postmatch",
    senderType: "TALENT",
    weight: 7,
    cooldownDays: 7,
    eligible: (ctx) => ctx.daysSinceLastBooking <= 7,
    subject: () => "After last night",
    body: (ctx) => {
      const w = ctx.wrestler!;
      if (w.alignment === "HEEL") {
        return `I hope you watched last night because that is what it looks like when you actually invest in someone's booking. I carried that whole segment. You are welcome. — ${w.name}`;
      }
      if (w.alignment === "FACE") {
        return `Last night was everything I work toward. The crowd was incredible and I left everything out there. Thank you for putting me in that position. Ready for whatever is next. — ${w.name}`;
      }
      return `Last night happened the way it happened for a reason. I am sure you have questions. I have answers. When you are ready to talk, you know where to find me. — ${w.name}`;
    },
  },

  {
    id: "talent.promo.followup",
    senderType: "TALENT",
    weight: 6,
    cooldownDays: 10,
    eligible: (ctx) => ctx.daysSinceLastBooking <= 10 && (ctx.wrestler!.alignment === "FACE" || ctx.wrestler!.alignment === "HEEL"),
    subject: () => "About the promo time",
    body: (ctx) => {
      const w = ctx.wrestler!;
      if (w.alignment === "HEEL") {
        return `Do not schedule me in a three-minute slot again. I need time on that microphone to make what I am doing land. Cut the fluff from the card and give me that time. — ${w.name}`;
      }
      return `I wanted to say thank you for the microphone time. I have been working on something and I finally got to say it. The crowd responded exactly how I hoped. Let us keep building. — ${w.name}`;
    },
  },

  {
    id: "talent.paycheck.complaint",
    senderType: "TALENT",
    weight: 3,
    cooldownDays: 60,
    eligible: (ctx) =>
      ctx.daysSinceLastBooking >= 30 &&
      ctx.championships.length === 0 &&
      ctx.rosterSize > 10,
    subject: () => "Need to discuss my deal",
    body: (ctx) => `GM — not looking to create a problem here but I need to understand my value in this organization. The booking does not reflect what we talked about when I signed. I believe in what you are doing here. I just need to see that belief go both ways. — ${ctx.wrestler!.name}`,
  },

  // ── Front Office templates ─────────────────────────────────────────────────

  {
    id: "fo.ple.warning",
    senderType: "FRONT_OFFICE",
    weight: 9,
    cooldownDays: 28,
    eligible: (ctx) => {
      if (!ctx.events) return false;
      return ctx.events.some((e) => {
        const w = weeksUntil(e, ctx.currentDate);
        return w >= 4 && w <= 6;
      });
    },
    subject: (ctx) => {
      const info = nearestPLE(ctx);
      return info ? `${info.event.name} is ${info.weeks} weeks out` : "Premium event approaching";
    },
    body: (ctx) => {
      const info = nearestPLE(ctx);
      if (!info) return "A premium event is approaching. We need a main event locked in.";
      return `Heads up: ${info.event.name} is ${info.weeks} weeks out. We need a main event and at least two fully developed undercard matches. Get the booking locked in this week. — Adam Pearce`;
    },
  },

  {
    id: "fo.vacant.belt",
    senderType: "FRONT_OFFICE",
    weight: 8,
    cooldownDays: 14,
    eligible: (ctx) => Boolean(firstVacantTitle(ctx)),
    subject: (ctx) => {
      const t = firstVacantTitle(ctx);
      return t ? `${t.name} is sitting vacant` : "Vacant title needs attention";
    },
    body: (ctx) => {
      const t = firstVacantTitle(ctx);
      if (!t) return "A title is vacant. Book a tournament or number one contender match.";
      return `${t.name} is sitting vacant and it looks bad on television. We need either a tournament or a clear number one contender match set up this week. Do not let this linger. — Triple H`;
    },
  },

  {
    id: "fo.morale.low",
    senderType: "FRONT_OFFICE",
    weight: 5,
    cooldownDays: 21,
    eligible: (ctx) => {
      if (!ctx.history) return false;
      const recent = ctx.history.filter(
        (h) =>
          h.universeDate &&
          dateToInt(ctx.currentDate) - dateToInt(h.universeDate) <= 14
      );
      return recent.length < 3;
    },
    subject: () => "Locker room temperature",
    body: () => `The locker room is asking when the next big angle is coming. We have had a quiet couple of weeks and people are starting to wonder what the plan is. Give us something to work with before morale becomes an issue. — Adam Pearce`,
  },

  {
    id: "fo.roster.meeting",
    senderType: "FRONT_OFFICE",
    weight: 4,
    cooldownDays: 30,
    eligible: (ctx) => ctx.rosterSize > 15,
    subject: () => "Roster meeting scheduled",
    body: () => `Setting up a full roster meeting before next week's show. Anything specific you want addressed? Let me know so I can get it on the agenda. — Adam Pearce`,
  },

  // ── Backstage templates ────────────────────────────────────────────────────

  {
    id: "backstage.morale.high",
    senderType: "BACKSTAGE",
    weight: 6,
    cooldownDays: 21,
    eligible: (ctx) => {
      if (!ctx.history) return false;
      const recent = ctx.history.filter(
        (h) =>
          h.universeDate &&
          dateToInt(ctx.currentDate) - dateToInt(h.universeDate) <= 14 &&
          (h.kind === "storyline" || h.kind === "show")
      );
      return recent.length >= 3;
    },
    subject: () => "Locker room is buzzing",
    body: () => `Locker room morale is the highest it has been all year. Whatever you have been booking is landing. People are excited to come to work. Keep doing what you are doing. — Bruce Pritchard`,
  },

  {
    id: "backstage.tension",
    senderType: "BACKSTAGE",
    weight: 5,
    cooldownDays: 28,
    eligible: (ctx) => {
      if (!ctx.roster) return false;
      const heels = ctx.roster.filter((w) => w.alignment === "HEEL");
      return heels.length >= 2;
    },
    subject: () => "Word from the back",
    body: (ctx) => {
      const heels = (ctx.roster ?? []).filter((w) => w.alignment === "HEEL");
      if (heels.length < 2) return "Word is there is some tension backstage. Could be storyline material.";
      const a = heels[0].name;
      const b = heels[1].name;
      return `Word is ${a} and ${b} got into it backstage last week. Nobody knows the details but the room felt it. Could be real heat, could be worked. Either way, there is something there if you want to use it. — Bruce Pritchard`;
    },
  },

  {
    id: "backstage.veteran.advice",
    senderType: "BACKSTAGE",
    weight: 4,
    cooldownDays: 35,
    eligible: (ctx) => ctx.rosterSize >= 5,
    subject: () => "Old school perspective",
    body: (ctx) => {
      const legend = pickRandom(LEGEND_NAMES);
      const w = (ctx.roster ?? []).find((r) => r.status !== "INJURED");
      const name = w?.name ?? "one of your newer stars";
      return `Old school says ${name} reminds them of ${legend} at the same point in their career. Might be worth noting when you are mapping out the next six months. — Bruce Pritchard`;
    },
  },

  {
    id: "backstage.locker.report",
    senderType: "BACKSTAGE",
    weight: 4,
    cooldownDays: 21,
    eligible: (ctx) => ctx.rosterSize > 10,
    subject: () => "Weekly locker room report",
    body: () => `Everyone showed up, no incidents. Crowd energy was good and it carried into the back. A few folks asking about long-term plans but nothing I cannot manage. I will keep you posted. — Bruce Pritchard`,
  },

  // ── Press templates ────────────────────────────────────────────────────────

  {
    id: "press.interview.request",
    senderType: "PRESS",
    weight: 6,
    cooldownDays: 21,
    eligible: (ctx) => {
      if (!ctx.history) return false;
      const recent = ctx.history.filter(
        (h) =>
          h.universeDate &&
          dateToInt(ctx.currentDate) - dateToInt(h.universeDate) <= 14
      );
      return recent.length > 0;
    },
    subject: (ctx) => {
      const outlet = pickRandom(OUTLETS);
      return `${outlet} interview request`;
    },
    body: (ctx) => {
      const outlet = pickRandom(OUTLETS);
      const w = (ctx.roster ?? []).find((r) => r.status !== "INJURED");
      const talent = w?.name ?? "your top talent";
      return `${outlet} wants 15 minutes with ${talent} before next week's show. They are doing a piece on the current landscape and want a first-person perspective. Your call on whether to approve. — Media Relations`;
    },
  },

  {
    id: "press.controversy",
    senderType: "PRESS",
    weight: 4,
    cooldownDays: 35,
    eligible: (ctx) => {
      const heelChamp = ctx.championships.find(
        (c) =>
          c.active !== false &&
          c.currentChampionIds &&
          c.currentChampionIds.length > 0
      );
      return Boolean(heelChamp);
    },
    subject: () => "Reporter working on a piece",
    body: (ctx) => {
      const outlet = pickRandom(OUTLETS);
      const c = ctx.championships.find(
        (c) => c.active !== false && c.currentChampionIds && c.currentChampionIds.length > 0
      );
      const title = c?.name ?? "the championship";
      return `${outlet} is working on a piece questioning whether the current direction with ${title} is good for business. They want a comment. I recommend letting it run — the heat could be useful. — Media Relations`;
    },
  },

  // ── Marketing templates ────────────────────────────────────────────────────

  {
    id: "mkt.merch.up",
    senderType: "MARKETING",
    weight: 6,
    cooldownDays: 28,
    eligible: (ctx) => ctx.championships.length > 0,
    subject: (ctx) => {
      const c = ctx.championships[0];
      return `Merch numbers in — ${c.name} holding strong`;
    },
    body: (ctx) => {
      const c = ctx.championships[0];
      const pct = 10 + Math.floor(Math.random() * 35);
      return `Merch numbers are in. ${c.name} merch is up ${pct}% this month. Fans are invested in the current champion. Good time to push the online catalog and consider a limited run item. — Marketing Dept`;
    },
  },

  {
    id: "mkt.house.show",
    senderType: "MARKETING",
    weight: 5,
    cooldownDays: 14,
    eligible: () => true,
    subject: () => `House show update — ${pickRandom(CITIES)}`,
    body: () => {
      const city = pickRandom(CITIES);
      const w2 = (Math.random() > 0.5) ? "sold out" : "near capacity";
      return `House show in ${city} was ${w2}. Crowd was hot from the first bell and stayed through the dark match. Good signs for the direction we are heading. — Marketing Dept`;
    },
  },

  {
    id: "mkt.social.trending",
    senderType: "MARKETING",
    weight: 4,
    cooldownDays: 21,
    eligible: (ctx) => ctx.daysSinceLastBooking <= 14,
    subject: () => "Trending online",
    body: () => `Last week's show is generating strong social engagement. A few specific moments are being clipped and shared. Let us identify what is working and lean into it on next week's card. — Marketing Dept`,
  },

  // ── Medical templates ──────────────────────────────────────────────────────

  {
    id: "med.cleared",
    senderType: "MEDICAL",
    weight: 8,
    cooldownDays: 30,
    eligible: (ctx) =>
      ctx.wrestler?.status === "INJURED" && ctx.daysSinceLastBooking >= 28,
    subject: (ctx) => `${ctx.wrestler?.name ?? "Talent"} cleared to compete`,
    body: (ctx) => {
      const name = ctx.wrestler?.name ?? "The talent";
      return `${name} passed final medical clearance this morning. Cleared to return to full competition. Recommend a gradual re-introduction to the card but they are physically ready. — Dr. Sampson`;
    },
  },

  {
    id: "med.precaution",
    senderType: "MEDICAL",
    weight: 4,
    cooldownDays: 21,
    eligible: (ctx) => ctx.rosterSize > 5 && Math.random() < 0.4,
    subject: (ctx) => {
      const w = (ctx.roster ?? []).find((r) => r.status !== "INJURED");
      return w ? `Precautionary note — ${w.name}` : "Medical precautionary note";
    },
    body: (ctx) => {
      const w = (ctx.roster ?? []).find((r) => r.status !== "INJURED");
      const name = w?.name ?? "One of your talent";
      return `${name} is dealing with a minor knock from last week. Nothing serious but recommend a lighter card assignment next week as a precaution. Will re-evaluate by end of week. — Dr. Sampson`;
    },
  },

  // ── Sponsor templates ──────────────────────────────────────────────────────

  {
    id: "sponsor.appearance",
    senderType: "SPONSOR",
    weight: 5,
    cooldownDays: 28,
    eligible: (ctx) =>
      ctx.wrestler?.alignment === "FACE" &&
      (ctx.wrestler?.role === "MAIN_EVENTER" || ctx.wrestler?.role === "UPPER_MIDCARD"),
    subject: (ctx) => `Appearance request — ${ctx.wrestler?.name ?? "Talent"}`,
    body: (ctx) => {
      const sponsor = pickRandom(SPONSORS);
      const name = ctx.wrestler?.name ?? "your talent";
      return `${sponsor} is requesting ${name} for a fan meet-and-greet appearance next month. The deal pays well and the exposure is good. Let me know if we want to proceed and I will get the contracts drafted. — Talent Relations`;
    },
  },

  // ── System templates ───────────────────────────────────────────────────────

  {
    id: "system.year.mark",
    senderType: "SYSTEM",
    weight: 10,
    cooldownDays: 365,
    eligible: (ctx) => ctx.currentDate.week === 1 && ctx.currentDate.month === 1 && ctx.currentDate.year > 0,
    subject: (ctx) => `Year ${ctx.currentDate.year + 1} of your Universe begins`,
    body: (ctx) => `Year ${ctx.currentDate.year + 1} of your Universe begins this week. The slate is as clean as it gets. Make it count.`,
  },

  {
    id: "system.reign.milestone",
    senderType: "SYSTEM",
    weight: 8,
    cooldownDays: 30,
    eligible: (ctx) =>
      ctx.championships.length > 0 &&
      (ctx.daysAsChampion === 30 ||
        ctx.daysAsChampion === 60 ||
        ctx.daysAsChampion === 100 ||
        ctx.daysAsChampion === 200 ||
        ctx.daysAsChampion === 365),
    subject: (ctx) => {
      const c = ctx.championships[0];
      return `${ctx.daysAsChampion}-day reign — ${c.name}`;
    },
    body: (ctx) => {
      const c = ctx.championships[0];
      const name = ctx.wrestler?.name ?? "The champion";
      return `${name} has held the ${c.name} for ${ctx.daysAsChampion} days. A landmark in any era. Make sure it gets the recognition it deserves on the next show.`;
    },
  },

  {
    id: "system.magazine.hot",
    senderType: "SYSTEM",
    weight: 4,
    cooldownDays: 7,
    eligible: (ctx) => {
      if (!ctx.history) return false;
      return ctx.history.some((h) => h.kind === "magazine");
    },
    subject: () => "New issue off the presses",
    body: (ctx) => {
      const mags = (ctx.history ?? []).filter((h) => h.kind === "magazine");
      const latest = mags[mags.length - 1];
      const num = latest && latest.kind === "magazine" ? latest.data.issueNumber : "latest";
      return `Issue #${num} just hit the stands. Check the News tab to read it in full.`;
    },
  },

  {
    id: "system.roster.milestone",
    senderType: "SYSTEM",
    weight: 5,
    cooldownDays: 90,
    eligible: (ctx) =>
      ctx.rosterSize === 10 ||
      ctx.rosterSize === 25 ||
      ctx.rosterSize === 50 ||
      ctx.rosterSize === 100,
    subject: (ctx) => `${ctx.rosterSize}-superstar roster`,
    body: (ctx) => `Your roster just hit ${ctx.rosterSize} superstars. A deep card creates real booking opportunities. Now is a good time to audit who needs a direction.`,
  },
];

// ─── 20+ Reply Templates ──────────────────────────────────────────────────────

export const REPLY_TEMPLATES: ReplyTemplate[] = [
  {
    id: "reply.titleShot.nextPLE",
    appliesTo: ["talent.contender.titleShot", "talent.idle.complaint"],
    label: "Title shot at next PLE",
    body: ({ originalMsg }) =>
      `Acknowledged. Title shot is yours at the next premium event. Bring it. — GM`,
  },

  {
    id: "reply.titleShot.earnIt",
    appliesTo: ["talent.contender.titleShot"],
    label: "Earn it on the mic next week",
    body: ({ originalMsg }) =>
      `Cut a promo on next week's show. Sell me on you. Then we talk gold. — GM`,
  },

  {
    id: "reply.timeOff",
    appliesTo: ["talent.idle.complaint", "talent.tradeRequest", "talent.paycheck.complaint"],
    label: "Take a week off, come back hungry",
    body: ({ originalMsg }) =>
      `Take next week dark. Come back swinging. We will reassess after that. — GM`,
  },

  {
    id: "reply.brandTrade.approved",
    appliesTo: ["talent.tradeRequest"],
    label: "Trade approved",
    body: ({ originalMsg }) =>
      `Done. New brand starts next show. Make a statement on debut. — GM`,
  },

  {
    id: "reply.brandTrade.denied",
    appliesTo: ["talent.tradeRequest"],
    label: "Trade denied, more screen time coming",
    body: ({ originalMsg }) =>
      `Staying put. But you are getting more TV time. Watch the next card. — GM`,
  },

  {
    id: "reply.gimmick.approved",
    appliesTo: ["talent.gimmick.changePitch"],
    label: "New look approved",
    body: ({ originalMsg }) =>
      `Pitch is approved. We will roll out the new direction next month. Get creative. — GM`,
  },

  {
    id: "reply.gimmick.denied",
    appliesTo: ["talent.gimmick.changePitch"],
    label: "Stay the course",
    body: ({ originalMsg }) =>
      `Not the right time for a change. Stay the course for now. We revisit in sixty days. — GM`,
  },

  {
    id: "reply.alliance.approved",
    appliesTo: ["talent.heel.allianceOffer"],
    label: "Form the alliance",
    body: ({ originalMsg }) =>
      `Do it. Both of you on next week's show. I want a statement, not a handshake. — GM`,
  },

  {
    id: "reply.alliance.denied",
    appliesTo: ["talent.heel.allianceOffer"],
    label: "Not yet",
    body: ({ originalMsg }) =>
      `Not the right time. Your value is higher as a solo act right now. Stay unpredictable. — GM`,
  },

  {
    id: "reply.cutPromo",
    appliesTo: ["*"],
    label: "Cut a promo Monday",
    body: ({ originalMsg }) =>
      `Mic time next show. Make it count. I want the crowd talking about it all week. — GM`,
  },

  {
    id: "reply.acknowledge",
    appliesTo: ["*"],
    label: "Noted",
    body: ({ originalMsg }) =>
      `Heard you. Standing by. — GM`,
  },

  {
    id: "reply.silence",
    appliesTo: ["*"],
    label: "No reply (silent treatment)",
    body: () => "",
  },

  {
    id: "reply.fo.book",
    appliesTo: ["fo.ple.warning", "fo.vacant.belt", "fo.morale.low", "fo.roster.meeting"],
    label: "On it — booking decision this week",
    body: ({ originalMsg }) =>
      `Booking decision is coming this week. Stand by. — GM`,
  },

  {
    id: "reply.press.approve",
    appliesTo: ["press.interview.request", "press.controversy"],
    label: "Approve interview",
    body: ({ originalMsg }) =>
      `Approved. They get fifteen minutes pre-show, no off-limits topics. Use it. — GM`,
  },

  {
    id: "reply.press.decline",
    appliesTo: ["press.interview.request", "press.controversy"],
    label: "Decline",
    body: ({ originalMsg }) =>
      `Decline. We are not talking to press this week. Let the in-ring work do the talking. — GM`,
  },

  {
    id: "reply.medical.holdUntilCleared",
    appliesTo: ["med.precaution"],
    label: "Lighter card next week",
    body: ({ originalMsg }) =>
      `Lighter card it is. Do not risk it. Health first, angles second. — GM`,
  },

  {
    id: "reply.medical.welcomeBack",
    appliesTo: ["med.cleared", "talent.idle.injuryReturn"],
    label: "Welcome back — big angle waiting",
    body: ({ originalMsg }) =>
      `Welcome back. There is a big angle waiting. Come talk Friday and we will map it out. — GM`,
  },

  {
    id: "reply.sponsor.accept",
    appliesTo: ["sponsor.appearance"],
    label: "Accept appearance",
    body: ({ originalMsg }) =>
      `Accept. Confirm logistics with talent relations and get the date locked in. — GM`,
  },

  {
    id: "reply.sponsor.decline",
    appliesTo: ["sponsor.appearance"],
    label: "Decline (character protection)",
    body: ({ originalMsg }) =>
      `Decline. Not available for outside commitments this month. Character protection takes priority. — GM`,
  },

  {
    id: "reply.system.acknowledge",
    appliesTo: ["system.year.mark", "system.reign.milestone", "system.magazine.hot", "system.roster.milestone"],
    label: "Acknowledged",
    body: () => `Logged. — GM`,
  },

  {
    id: "reply.idle.bigPushIncoming",
    appliesTo: ["talent.idle.complaint", "talent.freeAgent.signMe", "talent.paycheck.complaint"],
    label: "Big push incoming",
    body: ({ originalMsg }) =>
      `You are getting a push. It starts next week. Do not fumble it. — GM`,
  },

  {
    id: "reply.champ.realChallenger",
    appliesTo: ["talent.champ.brag", "talent.champ.threat"],
    label: "Real challenger incoming",
    body: ({ originalMsg }) =>
      `Challenge accepted. I am building your next real challenger right now. Enjoy the quiet while it lasts. — GM`,
  },

  {
    id: "reply.custom",
    appliesTo: ["*"],
    label: "Custom note...",
    body: () => "",
  },
];
