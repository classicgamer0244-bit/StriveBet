"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

/** A small Client Component wrapper so Server Component pages (like the
 * match detail pages) can render a "Create match" button without importing
 * components/ui/button.tsx into the server bundle — it unconditionally
 * imports Radix's Slot, which calls createContext() at module scope and
 * throws outside a Client Component boundary, even when asChild is unused. */
export function CreateMatchLink() {
  return (
    <Button asChild size="sm" className="gap-1.5">
      <Link href="/admin/matches/new">
        <Plus className="size-4" />
        Create match
      </Link>
    </Button>
  );
}
