import type { Show } from "@workspace/api-client-react";
import smackdownBg from "@assets/smackdown-2005-06_1777488510139.jpg";
import rawBg from "@assets/raw-2002-06_1777487992501.jpg";

export const SEED_SHOWS: Show[] = [
  {
    id: "raw",
    name: "Monday Night Raw",
    night: "Monday",
    vibe:
      "Flagship Monday night show. Long-form storytelling, big in-ring promos, marquee main events. Edgy, mainstream, sports-entertainment.",
    imageUrl: rawBg,
  },
  {
    id: "smackdown",
    name: "Friday Night SmackDown",
    night: "Friday",
    vibe:
      "Friday night blue brand. Slightly more wrestling-forward than Raw, character-driven, family-friendly main event window.",
    imageUrl: smackdownBg,
  },
];
