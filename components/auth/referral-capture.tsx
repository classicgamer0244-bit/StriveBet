"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUI } from "@/hooks/use-ui";

/**
 * Captures ?ref=CODE once at the root and stores it in UIContext for the
 * lifetime of the session, so it's still available if the user browses to
 * another page before opening Register. Must be rendered inside a
 * <Suspense> boundary — useSearchParams() requires one.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();
  const { setReferralCode } = useUI();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) setReferralCode(ref);
  }, [searchParams, setReferralCode]);

  return null;
}
