import type { Game } from "@/types";

export const games: Game[] = [
  { id: "sporty-hero", name: "Sporty Hero", category: "Mini Games" },
  { id: "spin-da-bottle", name: "Spin da' Bottle", category: "Mini Games" },
  { id: "red-black", name: "Red Black", category: "Mini Games" },
  { id: "lucky-numbers", name: "Lucky Numbers", category: "Mini Games" },
  { id: "coin-flip", name: "Coin Flip", category: "Mini Games" },
  { id: "dice-duel", name: "Dice Duel", category: "Mini Games", comingSoon: true },
  { id: "crash-x", name: "Crash X", category: "Crash Games", comingSoon: true },
  { id: "aviator-plus", name: "Aviator Plus", category: "Crash Games", comingSoon: true },
  { id: "rocket-run", name: "Rocket Run", category: "Crash Games", comingSoon: true },
  { id: "penalty-shootout", name: "Penalty Shootout", category: "Instant Sports" },
  { id: "keno-blitz", name: "Keno Blitz", category: "Instant Sports", comingSoon: true },
  { id: "wheel-of-fortune", name: "Wheel of Fortune", category: "Instant Sports", comingSoon: true },
];

export const gameCategories = ["Mini Games", "Crash Games", "Instant Sports"] as const;
