"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PRIMARY_NAV } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function NavPrimary({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex items-center gap-0.5", className)}>
      {PRIMARY_NAV.map((item) => {
        const isActive = item.enabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.label}
            href={item.enabled ? item.href : "#"}
            onClick={onNavigate}
            className={cn(
              "shrink-0 px-3.5 py-2.5 text-[13px] font-bold tracking-wide uppercase transition-colors whitespace-nowrap",
              isActive
                ? "border-b-2 border-volt text-volt"
                : "border-b-2 border-transparent text-white/60 hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
