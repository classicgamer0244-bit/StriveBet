"use client";

import { useContext } from "react";
import { BetslipContext } from "@/context/betslip-context";

export function useBetslip() {
  const ctx = useContext(BetslipContext);
  if (!ctx) throw new Error("useBetslip must be used within BetslipProvider");
  return ctx;
}
