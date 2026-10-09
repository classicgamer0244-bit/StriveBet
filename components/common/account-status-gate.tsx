"use client";

import { Ban } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

/**
 * Blocks the betting UI for a suspended player. A suspended user who is logged
 * in sees this instead of the site body.
 */
export function AccountStatusGate({ children }: { children: React.ReactNode }) {
  const { authLoading, user, admin, logout } = useAuth();

  if (!authLoading && (user?.status === "suspended" || admin?.status === "suspended")) {
    return (
      <div className="mx-auto flex max-w-350 flex-col items-center gap-3 px-4 py-24 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <Ban className="size-6" />
        </div>
        <h1 className="text-lg font-bold text-foreground">Your account has been suspended</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Betting, deposits and withdrawals are disabled on this account. Please contact support if you believe this is
          a mistake.
        </p>
        <Button variant="outline" onClick={logout} className="mt-2">
          Log out
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
