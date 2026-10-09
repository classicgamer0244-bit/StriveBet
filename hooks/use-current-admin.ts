"use client";

import { useAuth } from "@/hooks/use-auth";
import type { AdminAccount } from "@/types";

/** Thin adapter over the shared auth session — kept as its own hook so admin
 * dashboard components can name what they need without reaching into the
 * player-shaped `useAuth()` fields. Backed by the same context as `login()`,
 * so it reflects a fresh staff sign-in immediately, with no separate poll. */
export function useCurrentAdmin(): { currentAdmin: AdminAccount | null; hydrated: boolean; refresh: () => void } {
  const { admin, authLoading, refreshBalance } = useAuth();
  return { currentAdmin: admin, hydrated: !authLoading, refresh: refreshBalance };
}
