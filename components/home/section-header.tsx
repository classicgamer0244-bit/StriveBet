import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  icon: Icon,
  href,
  actionLabel = "View all",
  badge,
  live = false,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  href?: string;
  actionLabel?: string;
  badge?: React.ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-foreground">
        {live ? (
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-live" />
          </span>
        ) : (
          Icon && (
            <span className="flex size-8 items-center justify-center rounded-xl bg-navy text-volt">
              <Icon className="size-4" />
            </span>
          )
        )}
        {title}
        {badge}
      </h2>
      {href && (
        <Link
          href={href}
          className="flex shrink-0 items-center gap-0.5 rounded-full bg-card px-3 py-1.5 text-xs font-bold text-foreground shadow-sm ring-1 ring-border transition-colors hover:bg-navy hover:text-white"
        >
          {actionLabel}
          <ChevronRight className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
