export const FONT_OPTIONS = [
  {
    key: "default",
    label: "Default",
    family: "'Oswald', sans-serif",
    sample: "GORILLA POSITION",
  },
  {
    key: "righteous",
    label: "Righteous",
    family: "'Righteous', sans-serif",
    sample: "GORILLA POSITION",
  },
  {
    key: "oblata",
    label: "Oblata Display",
    family: "'Oblata Display', serif",
    sample: "GORILLA POSITION",
  },
  {
    key: "gradzy",
    label: "Gradzy",
    family: "'Gradzy', sans-serif",
    sample: "GORILLA POSITION",
  },
  {
    key: "masking",
    label: "Masking Renta",
    family: "'Masking Renta', sans-serif",
    sample: "GORILLA POSITION",
  },
];

export const FONT_FAMILIES: Record<string, string> = Object.fromEntries(
  FONT_OPTIONS.map((f) => [f.key, f.family]),
);
