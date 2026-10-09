"use client";

import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function AwaitingApprovalScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Clock className="size-6" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Your merchant account is awaiting approval</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        A superadmin needs to approve your account before you can access your dashboard, post matches, and share your
        referral link. You&apos;ll get access as soon as you&apos;re approved.
      </p>
      <Button
        variant="outline"
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="mt-2"
      >
        Log out
      </Button>
    </div>
  );
}
