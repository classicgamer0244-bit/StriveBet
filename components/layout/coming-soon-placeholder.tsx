import { Construction } from "lucide-react";

export function ComingSoonPlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-600">
        <Construction className="size-6" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        This section is coming soon. We&apos;re still building it out. Check back shortly.
      </p>
    </div>
  );
}
