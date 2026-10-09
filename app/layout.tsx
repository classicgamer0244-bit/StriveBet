import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { SiteChrome } from "@/components/layout/site-chrome";
import { AuthModal } from "@/components/auth/auth-modal";
import { SearchOverlay } from "@/components/search/search-overlay";
import { WinCelebrationModal } from "@/components/bets/win-celebration-modal";
import { Toaster } from "@/components/ui/sonner";
import { PageLoader } from "@/components/layout/page-loader";
import { BRAND_NAME } from "@/lib/constants";
import { ServiceWorkerRegistration } from "@/components/common/service-worker-registration";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://strivebet.vercel.app";
const DESCRIPTION = "Ghana's #1 sports betting platform. Bet on football, basketball, tennis and more with live odds, instant payouts and the best markets.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${BRAND_NAME} — Ghana's #1 Sports Betting Platform`,
    template: `%s | ${BRAND_NAME}`,
  },
  description: DESCRIPTION,
  keywords: ["sports betting", "live betting", "football betting", "Ghana betting", "online betting", "StriveBet", "bet online Ghana", "odds"],
  authors: [{ name: BRAND_NAME }],
  creator: BRAND_NAME,
  publisher: BRAND_NAME,
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  icons: {
    icon: [
      { url: "/logo.png", type: "image/png" },
    ],
    apple: "/logo.png",
    shortcut: "/logo.png",
  },
  openGraph: {
    type: "website",
    locale: "en_GH",
    url: SITE_URL,
    siteName: BRAND_NAME,
    title: `${BRAND_NAME} — Ghana's #1 Sports Betting Platform`,
    description: DESCRIPTION,
    images: [{ url: "/logo.png", width: 512, height: 512, alt: `${BRAND_NAME} Logo` }],
  },
  twitter: {
    card: "summary",
    title: `${BRAND_NAME} — Ghana's #1 Sports Betting Platform`,
    description: DESCRIPTION,
    images: ["/logo.png"],
  },
  alternates: { canonical: SITE_URL },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0B1230",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background">
        <Providers>
          <ServiceWorkerRegistration />
          <PageLoader />
          <SiteChrome>{children}</SiteChrome>
          <AuthModal />
          <SearchOverlay />
          <WinCelebrationModal />
          <Toaster position="top-center" />
        </Providers>
      </body>
    </html>
  );
}
