import type { Intent } from "@/types/data";

export const BRAND = {
  paper: "#FAF8F5",
  surface: "#F2EDE6",
  border: "#E3DFD6",
  text: "#24221F",
  muted: "#6B6862",
  primary: "#1D4ED8",
  route: "#2E7CCB",
  park: "#A8C9A0",
  water: "#DCEAF6",
  highlight: "#FFB84D",
} as const;

export const MAP_FONT_STACKS = {
  regular: ["Inter Regular"],
} as const;

export interface IntentVisual {
  label: string;
  color: string;
  soft: string;
}

export const INTENT_VISUALS: Record<Intent, IntentVisual> = {
  anything: { label: "Anything", color: BRAND.primary, soft: "#E8EEFC" },
  eat: { label: "Eat", color: "#F07D43", soft: "#FDEDE5" },
  drink: { label: "Drink", color: "#E0483C", soft: "#FBE9E7" },
  coffee: { label: "Coffee", color: "#2E7CCB", soft: "#E7F1FA" },
  culture: { label: "Culture", color: "#7B5AF1", soft: "#EEEAFD" },
  outside: { label: "Outside", color: "#2BA56E", soft: "#E6F5EE" },
  nightlife: { label: "Go out", color: BRAND.highlight, soft: "#FFF3D9" },
};

export const INTENT_ORDER: Intent[] = ["anything", "eat", "drink", "coffee", "culture", "outside", "nightlife"];
