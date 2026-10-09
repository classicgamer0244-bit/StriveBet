"use client";

import { useAuth } from "@/hooks/use-auth";
import { Logo } from "@/components/brand/logo";

export function PageLoader() {
  const { authLoading } = useAuth();

  if (!authLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-5 bg-navy">
      <Logo className="animate-pulse [&>span]:text-3xl" markClassName="size-12" />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-primary to-volt [animation:shimmer_1.2s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}
