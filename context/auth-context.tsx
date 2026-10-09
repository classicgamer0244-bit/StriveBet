"use client";

import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AdminAccount, User } from "@/types";

export interface RegisterInput {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  password: string;
  referralCode?: string;
}

/** Normalizes `user`/`admin` into one shape for player-facing UI (balance
 * pill, betslip, deposit/withdraw forms, bet history) — admins/superadmins
 * can do everything a player can, on top of their merchant dashboard. */
export interface PlayerView {
  kind: "user" | "admin";
  id: string;
  displayName: string;
  phone: string;
  countryCode?: string;
  balance: number;
  currency: string;
  depositsSinceReset: number;
  penaltyDepositRequired: boolean;
  hasWonBet: boolean;
}

export interface AuthContextValue {
  user: User | null;
  /** Set instead of `user` when the signed-in phone belongs to an admin/superadmin
   * account. Players and staff share one login path but never one session — a
   * session is exactly one kind, so `user` and `admin` are never both non-null. */
  admin: AdminAccount | null;
  /** `user` or `admin`, whichever is active, normalized to one shape. */
  player: PlayerView | null;
  /** True for either a player or a staff session — both can use the
   * player-facing site (balance, betslip, deposits, bet history). */
  isLoggedIn: boolean;
  /** True until the initial /api/auth/me check resolves. */
  authLoading: boolean;
  balanceVisible: boolean;
  isBusy: boolean;
  error: string | null;
  login: (phone: string, password: string) => Promise<boolean>;
  register: (input: RegisterInput) => Promise<boolean>;
  logout: () => Promise<void>;
  toggleBalanceVisible: () => void;
  /** Re-fetches the current session from the server — used both for the
   * account page's manual refresh icon and to resync `user`/`admin` after
   * actions (like a forgot-password reset) that sign someone in outside this
   * context. */
  refreshBalance: () => Promise<void>;
  /** Applies a balance pushed down the my-bets SSE stream (see
   * context/open-bets-context.tsx) without a round trip. This is what makes a
   * settlement payout appear in the header within a couple of seconds; before
   * it existed, nothing refreshed the balance unless the player navigated or
   * the win modal happened to fire, so money that HAD been credited still
   * looked like it was missing. */
  applyPushedBalance: (balance: number) => void;
  updateProfile: (patch: Partial<Pick<User, "firstName" | "lastName" | "email" | "gender">>) => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [admin, setAdmin] = useState<AdminAccount | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [balanceVisible, setBalanceVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("balanceVisible") !== "false";
  });
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applySession(data: { kind: "user" | "admin" | null; account: User | AdminAccount | null } | null) {
    setUser(data?.kind === "user" ? (data.account as User) : null);
    setAdmin(data?.kind === "admin" ? (data.account as AdminAccount) : null);
  }

  const refreshBalance = useCallback(async () => {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const data = await readJson(res);
    applySession(data);
  }, []);

  const applyPushedBalance = useCallback((balance: number) => {
    // Patches only the balance on whichever session is active, leaving every
    // other field alone. Bails when unchanged so a 2s stream of identical
    // frames doesn't re-render the tree.
    setUser((prev) => (prev && prev.balance !== balance ? { ...prev, balance } : prev));
    setAdmin((prev) => (prev && prev.balance !== balance ? { ...prev, balance } : prev));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await readJson(res);
      if (!cancelled) {
        applySession(data);
        setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (phone: string, password: string) => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data?.error ?? "Login failed. Please try again.");
        return false;
      }
      applySession(data);
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data?.error ?? "Registration failed. Please try again.");
        return false;
      }
      setUser(data.user);
      setAdmin(null);
      return true;
    } catch {
      setError("Something went wrong. Please try again.");
      return false;
    } finally {
      setIsBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setAdmin(null);
  }, []);

  const toggleBalanceVisible = useCallback(() => {
    setBalanceVisible((v) => {
      const next = !v;
      localStorage.setItem("balanceVisible", String(next));
      return next;
    });
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, "firstName" | "lastName" | "email" | "gender">>) => {
      setIsBusy(true);
      try {
        const res = await fetch("/api/users/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = await readJson(res);
        if (!res.ok) return false;
        setUser(data.user);
        return true;
      } finally {
        setIsBusy(false);
      }
    },
    []
  );

  const player = useMemo<PlayerView | null>(() => {
    if (user) {
      return {
        kind: "user",
        id: user.id,
        displayName: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.phone,
        phone: user.phone,
        countryCode: user.countryCode,
        balance: user.balance,
        currency: user.currency,
        depositsSinceReset: user.depositsSinceReset,
        penaltyDepositRequired: user.penaltyDepositRequired,
        hasWonBet: user.hasWonBet ?? false,
      };
    }
    if (admin) {
      return {
        kind: "admin",
        id: admin.id,
        displayName: admin.displayName,
        phone: admin.phone,
        balance: admin.balance,
        currency: admin.currency,
        depositsSinceReset: admin.depositsSinceReset,
        penaltyDepositRequired: admin.penaltyDepositRequired,
        hasWonBet: false,
      };
    }
    return null;
  }, [user, admin]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      admin,
      player,
      isLoggedIn: player !== null,
      authLoading,
      balanceVisible,
      isBusy,
      error,
      login,
      register,
      logout,
      toggleBalanceVisible,
      refreshBalance,
      applyPushedBalance,
      updateProfile,
    }),
    [user, admin, player, authLoading, balanceVisible, isBusy, error, login, register, logout, toggleBalanceVisible, refreshBalance, applyPushedBalance, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
