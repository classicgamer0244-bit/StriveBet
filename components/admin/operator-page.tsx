import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export function OperatorPageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  action,
}: {
  title: string;
  description?: string;
  /** Optional "← back" link shown above the title — for pages an admin can
   * otherwise get stranded on with no way back (e.g. a single match's control page). */
  backHref?: string;
  backLabel?: string;
  /** Optional right-aligned action, e.g. a "Create match" button. */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      {backHref && (
        <Link
          href={backHref}
          className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </div>
  );
}

export function OperatorPanel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-4">{children}</div>;
}
