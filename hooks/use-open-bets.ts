"use client";

import { useContext } from "react";
import { OpenBetsContext } from "@/context/open-bets-context";

export function useOpenBets() {
  const ctx = useContext(OpenBetsContext);
  if (!ctx) throw new Error("useOpenBets must be used within OpenBetsProvider");
  return ctx;
}
