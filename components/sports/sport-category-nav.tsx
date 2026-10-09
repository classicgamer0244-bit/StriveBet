"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSports } from "@/data/selectors";
import { SPORT_ICONS } from "@/lib/sport-icons";
import { cn } from "@/lib/utils";

const MORE_SPORTS = ["Rugby", "Volleyball", "Table Tennis", "MMA", "Golf", "Darts", "Snooker", "Boxing"];
const FILTERABLE_PATHS = ["/sports", "/live-betting"];

/**
 * Sport filter pills shown above the content on rail pages. The home page
 * has its own sport tiles, so the bar is omitted there.
 */
export function SportCategoryNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const sports = getSports();

  if (pathname === "/") return null;

  const isFilterable = FILTERABLE_PATHS.includes(pathname);
  const activeSport = searchParams.get("sport") ?? "football";

  function handleSportClick(slug: string) {
    if (isFilterable) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sport", slug);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    } else {
      router.push(`/sports?sport=${slug}`);
    }
  }

  return (
    <div className="pt-4 lg:pt-6">
      <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-card p-1.5 shadow-sm ring-1 ring-border [scrollbar-width:none]">
        {sports.map((sport) => {
          const Icon = SPORT_ICONS[sport.slug];
          const isActive = isFilterable && activeSport === sport.slug;
          return (
            <button
              key={sport.slug}
              onClick={() => handleSportClick(sport.slug)}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold whitespace-nowrap transition-colors",
                isActive ? "bg-navy text-white" : "text-foreground/65 hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className={cn("size-4", isActive && "text-volt")} />
              {sport.name}
            </button>
          );
        })}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-xl px-3.5 py-2 text-sm font-bold whitespace-nowrap text-foreground/65 hover:bg-muted hover:text-foreground">
            More
            <ChevronDown className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {MORE_SPORTS.map((label) => (
              <DropdownMenuItem key={label} disabled>
                {label}
                <span className="ml-auto text-[10px] text-muted-foreground">Soon</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
