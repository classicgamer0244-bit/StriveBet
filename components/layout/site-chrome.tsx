"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/header/header";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BetslipMobileDrawer } from "@/components/betslip/betslip-mobile-drawer";
import { AccountStatusGate } from "@/components/common/account-status-gate";
import { ScrollToTop } from "@/components/layout/scroll-to-top";
import { isOperatorPath } from "@/lib/layout/operator-path";
import { cn } from "@/lib/utils";

/**
 * The betting-site chrome: a fixed navy sidebar on desktop, a navy top bar,
 * and the page content on a rounded light "canvas" framed by the two.
 * Suppressed on operator paths (/admin, /superadmin), which bring their own
 * dark dashboard shell.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (isOperatorPath(pathname)) {
    return <>{children}</>;
  }

  // The sports page has its own league sidebar, so the app sidebar shrinks
  // to an icon rail there to leave room for the match list.
  const compactSidebar = pathname.startsWith("/sports");

  return (
    <>
      <ScrollToTop />
      <AppSidebar compact={compactSidebar} />
      <div className={cn("flex min-h-full flex-1 flex-col bg-navy", compactSidebar ? "lg:pl-[72px]" : "lg:pl-[72px] xl:pl-60")}>
        <Header />
        <div className="flex flex-1 flex-col bg-background lg:rounded-tl-3xl">
          <div className="flex-1 pb-20 lg:pb-0">
            <AccountStatusGate>{children}</AccountStatusGate>
          </div>
          <Footer />
        </div>
      </div>
      <MobileBottomNav />
      <BetslipMobileDrawer />
    </>
  );
}
