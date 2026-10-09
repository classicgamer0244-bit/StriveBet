"use client";

import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import type { AdminFixture } from "@/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { MatchStatusBadge } from "./match-status-badge";

const STATUS_ORDER: Record<AdminFixture["status"], number> = { live: 0, halftime: 0, upcoming: 1, finished: 2, cancelled: 3 };

export function MatchList({
  fixtures,
  showOwner = false,
  ownerName,
  basePath = "/admin/matches",
  showCreate = true,
}: {
  fixtures: AdminFixture[];
  showOwner?: boolean;
  ownerName?: (id: string) => string;
  basePath?: string;
  showCreate?: boolean;
}) {
  const sorted = [...fixtures].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.simKickoffTs - a.simKickoffTs
  );

  return (
    <div className="flex flex-col gap-3">
      {showCreate && (
        <div className="flex justify-end">
          <Button asChild className="gap-1.5">
            <Link href="/admin/matches/new">
              <Plus className="size-4" />
              Create match
            </Link>
          </Button>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState title="No matches yet" description="Create your first simulated match to get players betting." />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          {sorted.map((f) => (
            <Link
              key={f.id}
              href={`${basePath}/${f.id}`}
              className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <MatchStatusBadge status={f.status} minute={f.minute} />
                  <span className="truncate text-xs text-muted-foreground">{f.leagueName}</span>
                </div>
                <p className="truncate text-sm font-semibold text-foreground">
                  {f.homeTeam.name} vs {f.awayTeam.name}
                </p>
                {showOwner && ownerName && (
                  <p className="truncate text-xs text-muted-foreground">Merchant: {ownerName(f.ownerAdminId)}</p>
                )}
              </div>
              {f.status !== "upcoming" && f.score && (
                <span className="shrink-0 rounded-md bg-muted px-2.5 py-1 text-sm font-bold tabular-nums text-foreground">
                  {f.score.home} - {f.score.away}
                </span>
              )}
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
