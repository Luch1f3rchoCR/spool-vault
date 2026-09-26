import tokens from "@/app/brand/proper-brand-tokens.json";

// Visual identity only. Technical identifiers, sender addresses and URLs stay unchanged.
export const brand = {
  name: tokens.name,
  ...tokens.copy,
  colors: tokens.colors,
  wordmark: "/brand/proper-v1/proper-wordmark-dark.svg",
  wordmarkLight: "/brand/proper-v1/proper-wordmark-light.svg",
  icon: "/brand/proper-v1/proper-appicon-dark.svg"
} as const;
