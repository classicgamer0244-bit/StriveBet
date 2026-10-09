"use client";

import { ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const GOALS_LINES = ["0.5", "1.5", "2.5", "3.5", "4.5"] as const;
export type GoalsLine = (typeof GOALS_LINES)[number];

export function GoalsLineSelect({
  value,
  onChange,
  dark = false,
}: {
  value: GoalsLine;
  onChange: (line: GoalsLine) => void;
  dark?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1 rounded-md border px-2.5 py-1.5 text-sm font-bold",
          dark ? "border-white/15 bg-white/10 text-white hover:bg-white/15" : "border-border bg-background text-foreground hover:bg-muted"
        )}
      >
        {value}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center">
        {GOALS_LINES.map((line) => (
          <DropdownMenuItem key={line} onClick={() => onChange(line)} className={line === value ? "bg-accent" : ""}>
            {line}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
