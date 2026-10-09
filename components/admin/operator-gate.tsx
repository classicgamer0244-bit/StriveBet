"use client";

import { useRouter } from "next/navigation";
import { Lock, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentAdmin } from "@/hooks/use-current-admin";
import { useUI } from "@/hooks/use-ui";
import { AwaitingApprovalScreen } from "./awaiting-approval-screen";
import { OperatorSidebar } from "./operator-sidebar";
import type { NavItem } from "@/lib/constants";

/**
 * Dark operator shell + role/status gate. Wraps the whole admin/superadmin
 * subtree in `.dark` so it reads as a console distinct from the betting site.
 */
export function OperatorGate({
  role,
  nav,
  kind,
  children,
}: {
  role: "admin" | "superadmin";
  nav: NavItem[];
  kind: "Admin" | "Superadmin";
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { openLogin } = useUI();
  const { hydrated, currentAdmin } = useCurrentAdmin();

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-350 px-3 py-4 lg:px-6">{renderBody()}</div>
    </div>
  );

  function renderBody() {
    if (!hydrated) {
      return (
        <div className="flex flex-col gap-4 lg:flex-row">
          <Skeleton className="h-64 w-full lg:w-64" />
          <Skeleton className="h-96 flex-1" />
        </div>
      );
    }

    if (!currentAdmin) {
      return <NotAuthorized reason="signin" onGo={openLogin} />;
    }

    if (currentAdmin.role !== role) {
      return (
        <NotAuthorized
          reason="role"
          onGo={() => router.push(currentAdmin.role === "superadmin" ? "/superadmin" : "/admin")}
        />
      );
    }

    if (currentAdmin.status === "pending") return <AwaitingApprovalScreen />;
    if (currentAdmin.status === "suspended") return <SuspendedOperator />;

    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <OperatorSidebar nav={nav} kind={kind} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }
}

function NotAuthorized({ reason, onGo }: { reason: "signin" | "role"; onGo: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Lock className="size-6" />
      </div>
      <h1 className="text-lg font-bold text-foreground">
        {reason === "signin" ? "Staff sign-in required" : "Wrong dashboard for your role"}
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        {reason === "signin"
          ? "Log in with your phone number and password to access this console."
          : "Your account belongs to a different dashboard."}
      </p>
      <Button onClick={onGo} className="mt-2">
        {reason === "signin" ? "Sign in" : "Go to my dashboard"}
      </Button>
    </div>
  );
}

function SuspendedOperator() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <Ban className="size-6" />
      </div>
      <h1 className="text-lg font-bold text-foreground">This merchant account is suspended</h1>
      <p className="max-w-sm text-sm text-muted-foreground">Contact the superadmin to restore access.</p>
    </div>
  );
}
