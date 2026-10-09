import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function DisabledNavItem({ label, className }: { label: string; className?: string }) {
  return (
    <span
      aria-disabled="true"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 px-1 py-2 text-sm font-medium text-muted-foreground/60 select-none cursor-not-allowed",
        className
      )}
    >
      {label}
      <Badge variant="secondary" className="h-4 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground/70">
        Soon
      </Badge>
    </span>
  );
}
