"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

export const LIVE_VIEWS = [
  { key: "multi", label: "Multi View" },
  { key: "single", label: "Single View" },
  { key: "schedule", label: "Schedule" },
] as const;

export type LiveViewKey = (typeof LIVE_VIEWS)[number]["key"];

export function LiveViewTabs({ active }: { active: LiveViewKey }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleClick(view: LiveViewKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", view);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-1 border-b border-white/5 bg-navy p-2">
      {LIVE_VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => handleClick(v.key)}
          className={cn(
            "rounded-xl px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors",
            active === v.key
              ? "bg-volt text-navy"
              : "text-white/55 hover:bg-white/5 hover:text-white"
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}
