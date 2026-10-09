"use client";

import { Lock } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { AccountSidebar } from "@/components/account/account-sidebar";
import { AccountSubPageHeader } from "@/components/account/account-sub-page-header";

function LoggedOutAccountPrompt() {
  const { openLogin } = useUI();

  return (
    <div className="mx-auto flex max-w-350 flex-col items-center gap-3 px-4 py-24 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Lock className="size-6" />
      </div>
      <h1 className="text-lg font-bold text-foreground">Log in to view your account</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        You need to be signed in to see your balance, deposits, and account settings.
      </p>
      <Button onClick={openLogin} className="mt-2">
        Login
      </Button>
    </div>
  );
}

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { isLoggedIn } = useAuth();
  const pathname = usePathname();
  const isTicketDetails = pathname.startsWith("/account/bet-history/");

  if (!isLoggedIn) {
    return <LoggedOutAccountPrompt />;
  }

  if (isTicketDetails) {
    return (
      <>
        <AccountSubPageHeader />
        <div className="mx-auto flex max-w-350 flex-col gap-4 lg:flex-row lg:items-start lg:px-6 lg:py-4">
          <AccountSidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </>
    );
  }

  return (
    <>
      <AccountSubPageHeader />
      <div className="mx-auto flex max-w-350 flex-col gap-4 lg:flex-row lg:items-start lg:px-6 lg:py-4">
        <AccountSidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
