"use client";

import { Suspense, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/context/auth-context";
import { BetslipProvider } from "@/context/betslip-context";
import { UIProvider } from "@/context/ui-context";
import { OpenBetsProvider } from "@/context/open-bets-context";
import { LiveFeedProvider } from "@/context/live-feed-context";
import { ReferralCapture } from "@/components/auth/referral-capture";

export function Providers({ children }: { children: ReactNode }) {
  return (
    // Light by default; once a player picks a theme it is saved in
    // localStorage and kept until they change it again. The OS setting is
    // deliberately ignored so the site never flips on its own.
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="strivebet-theme" disableTransitionOnChange>
    <AuthProvider>
      <OpenBetsProvider>
        <LiveFeedProvider>
          <BetslipProvider>
            <UIProvider>
              <Suspense fallback={null}>
                <ReferralCapture />
              </Suspense>
              {children}
            </UIProvider>
          </BetslipProvider>
        </LiveFeedProvider>
      </OpenBetsProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}
