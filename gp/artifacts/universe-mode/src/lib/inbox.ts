import { useLocalStorage } from "./storage";
import type { Championship, TitleReign, RivalryEntry } from "./storage";
import type { Wrestler } from "@workspace/api-client-react";
import type { UniverseDate, PremiumEvent } from "./calendar";
import { dateToInt } from "./calendar";
import type { InboxTemplate, TemplateContext } from "./inbox-templates";

export type { SenderType } from "./inbox-templates";

export interface GeneratedInboxMessage {
  id: string;
  senderType: import("./inbox-templates").SenderType;
  fromName: string;
  fromWrestlerId?: string;
  subject: string;
  body: string;
  templateId: string;
  generatedAt: number;
  universeDate: UniverseDate;
  isAutoReply?: boolean;
  inReplyToId?: string;
}

export interface GMReply {
  id: string;
  messageId: string;
  templateId: string;
  bodyText: string;
  createdNightNoteId?: string;
  at: number;
}

export function useInboxGenerated() {
  return useLocalStorage<GeneratedInboxMessage[]>("umc.inboxGenerated", []);
}

export function useInboxArchivedIds() {
  return useLocalStorage<string[]>("umc.inboxArchivedIds", []);
}

export function useInboxDeletedIds() {
  return useLocalStorage<string[]>("umc.inboxDeletedIds", []);
}

export function useInboxStarredIds() {
  return useLocalStorage<string[]>("umc.inboxStarredIds", []);
}

export function useInboxLastFire() {
  return useLocalStorage<Record<string, number>>("umc.inboxLastFire", {});
}

export function useInboxReplies() {
  return useLocalStorage<GMReply[]>("umc.inboxReplies", []);
}

// ─── Scheduler ───────────────────────────────────────────────────────────────

function weightedPick<T>(items: Array<{ item: T; weight: number }>): T | undefined {
  if (items.length === 0) return undefined;
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const { item, weight } of items) {
    r -= weight;
    if (r <= 0) return item;
  }
  return items[items.length - 1].item;
}

function getNonTalentSenderName(senderType: import("./inbox-templates").SenderType): string {
  switch (senderType) {
    case "FRONT_OFFICE": return Math.random() < 0.5 ? "Adam Pearce" : "Triple H";
    case "BACKSTAGE": return "Bruce Pritchard";
    case "PRESS": return "Media Relations";
    case "MARKETING": return "Marketing Dept";
    case "MEDICAL": return "Dr. Sampson";
    case "SPONSOR": return "Talent Relations";
    case "SYSTEM": return "Universe System";
    default: return "Unknown";
  }
}

type EligibleSlot = {
  template: InboxTemplate;
  fromName: string;
  fromWrestlerId?: string;
  senderType: import("./inbox-templates").SenderType;
  ctx: TemplateContext;
};

export function generateInboxMessagesOnAdvance(args: {
  roster: Wrestler[];
  championships: Championship[];
  history: RivalryEntry[];
  events: PremiumEvent[];
  prior: UniverseDate;
  next: UniverseDate;
  lastFire: Record<string, number>;
  templates: InboxTemplate[];
  titleReigns?: TitleReign[];
}): {
  newMessages: GeneratedInboxMessage[];
  nextLastFire: Record<string, number>;
} {
  const { roster, championships, history, events, next, lastFire, templates, titleReigns = [] } = args;
  const nextDay = dateToInt(next);

  // Compute daysSinceLastBooking per wrestler name
  const lastBookingDay = new Map<string, number>();
  for (const entry of history) {
    if (!entry.universeDate) continue;
    const d = dateToInt(entry.universeDate);
    const names: string[] = [];
    if (entry.kind === "storyline") {
      for (const n of entry.data.participants ?? []) names.push(n);
    } else if (entry.kind === "show") {
      for (const m of entry.data.matches ?? []) {
        m.match.split(/\s+vs\.?\s+/i).forEach((n) =>
          names.push(n.trim().replace(/\s*—.*$/, "").trim())
        );
      }
    } else if (entry.kind === "promo") {
      const n = (entry.data as Record<string, unknown>).wrestlerName;
      if (typeof n === "string" && n) names.push(n);
    }
    for (const rawName of names) {
      const key = rawName.toLowerCase();
      const prev = lastBookingDay.get(key);
      if (prev === undefined || prev < d) lastBookingDay.set(key, d);
    }
  }

  // Compute daysAsChampion per wrestler id
  const champDays = new Map<string, number>();
  if (titleReigns.length > 0) {
    for (const reign of titleReigns) {
      if (reign.lostDate || !reign.wrestlerId) continue;
      const wonDay = dateToInt(reign.wonDate);
      champDays.set(reign.wrestlerId, nextDay - wonDay);
    }
  } else {
    for (const c of championships) {
      if (c.active === false) continue;
      for (const id of c.currentChampionIds ?? []) {
        if (!champDays.has(id)) champDays.set(id, 30);
      }
    }
  }

  const rosterSize = roster.length;

  const eligible: EligibleSlot[] = [];

  for (const template of templates) {
    const cooldownPassed = (name: string): boolean => {
      const lastD = lastFire[`${template.id}:${name}`];
      if (lastD === undefined) return true;
      return nextDay - lastD >= template.cooldownDays;
    };

    if (template.senderType === "TALENT") {
      for (const w of roster) {
        if (!cooldownPassed(w.name)) continue;
        const lastBookDay = lastBookingDay.get(w.name.toLowerCase());
        const daysLastBooking = lastBookDay !== undefined ? nextDay - lastBookDay : 999;
        const daysLastMsg = (() => {
          const d = lastFire[`${template.id}:${w.name}`];
          return d !== undefined ? nextDay - d : 999;
        })();
        const wChampionships = championships.filter(
          (c) =>
            c.active !== false &&
            (c.currentChampionIds ?? []).includes(w.id ?? "")
        );
        const ctx: TemplateContext = {
          wrestler: w,
          championships: wChampionships,
          daysSinceLastBooking: daysLastBooking,
          daysSinceLastMessage: daysLastMsg,
          daysAsChampion: champDays.get(w.id ?? "") ?? 0,
          rosterSize,
          currentDate: next,
          events,
          roster,
          history,
        };
        if (template.eligible(ctx)) {
          eligible.push({
            template,
            fromName: w.name,
            fromWrestlerId: w.id,
            senderType: "TALENT",
            ctx,
          });
        }
      }
    } else {
      const senderName = getNonTalentSenderName(template.senderType);
      if (!cooldownPassed(senderName)) continue;
      const daysLastMsg = (() => {
        const d = lastFire[`${template.id}:${senderName}`];
        return d !== undefined ? nextDay - d : 999;
      })();
      const ctx: TemplateContext = {
        championships,
        daysSinceLastBooking: 0,
        daysSinceLastMessage: daysLastMsg,
        daysAsChampion: 0,
        rosterSize,
        currentDate: next,
        events,
        roster,
        history,
      };
      if (template.eligible(ctx)) {
        eligible.push({
          template,
          fromName: senderName,
          senderType: template.senderType,
          ctx,
        });
      }
    }
  }

  if (eligible.length === 0) {
    return { newMessages: [], nextLastFire: { ...lastFire } };
  }

  const MAX = 3;
  const chosen: EligibleSlot[] = [];
  const usedTemplateIds = new Set<string>();
  const usedWrestlerNames = new Set<string>();

  // Guarantee at least 1 non-talent message if any is eligible
  const nonTalentPool = eligible.filter((e) => e.senderType !== "TALENT");
  if (nonTalentPool.length > 0) {
    const pick = weightedPick(nonTalentPool.map((e) => ({ item: e, weight: e.template.weight })));
    if (pick) {
      chosen.push(pick);
      usedTemplateIds.add(pick.template.id);
    }
  }

  // Fill remaining slots from all eligible
  while (chosen.length < MAX) {
    const pool = eligible.filter(
      (e) =>
        !usedTemplateIds.has(e.template.id) &&
        !usedWrestlerNames.has(e.fromName)
    );
    if (pool.length === 0) break;
    const pick = weightedPick(pool.map((e) => ({ item: e, weight: e.template.weight })));
    if (!pick) break;
    chosen.push(pick);
    usedTemplateIds.add(pick.template.id);
    if (pick.senderType === "TALENT") usedWrestlerNames.add(pick.fromName);
  }

  const nextLastFire = { ...lastFire };
  const newMessages: GeneratedInboxMessage[] = [];

  for (const slot of chosen) {
    const msg: GeneratedInboxMessage = {
      id: crypto.randomUUID(),
      senderType: slot.senderType,
      fromName: slot.fromName,
      fromWrestlerId: slot.fromWrestlerId,
      subject: slot.template.subject(slot.ctx),
      body: slot.template.body(slot.ctx),
      templateId: slot.template.id,
      generatedAt: Date.now(),
      universeDate: next,
    };
    newMessages.push(msg);
    nextLastFire[`${slot.template.id}:${slot.fromName}`] = nextDay;
  }

  return { newMessages, nextLastFire };
}
