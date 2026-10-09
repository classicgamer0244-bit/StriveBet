import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: LucideIcon;
  accent?: "default" | "success" | "primary";
}) {
  const accentClass =
    accent === "success" ? "text-success" : accent === "primary" ? "text-primary" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase">{label}</span>
        {Icon && <Icon className="size-4 text-muted-foreground" />}
      </div>
      <p className={`mt-2 text-lg font-extrabold tabular-nums ${accentClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
