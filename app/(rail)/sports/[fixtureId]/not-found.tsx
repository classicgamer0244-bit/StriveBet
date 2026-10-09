import Link from "next/link";

export default function FixtureNotFound() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      <h2 className="text-lg font-semibold text-foreground">Fixture not found</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        This match may have finished or the link is incorrect.
      </p>
      <Link href="/sports" className="text-sm font-semibold text-primary-600 hover:underline">
        Back to Sports
      </Link>
    </div>
  );
}
