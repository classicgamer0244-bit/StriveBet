"use client";

import { useState } from "react";
import type { Team } from "@/types";
import { cn } from "@/lib/utils";

function proxyUrl(src: string): string {
  return `/api/logo?src=${encodeURIComponent(src)}`;
}

export function TeamCrest({
  team,
  containerClassName = "size-14",
  imageSize = 40,
  textClassName = "text-sm",
  fallback = "initials",
}: {
  team: Team;
  containerClassName?: string;
  imageSize?: number;
  textClassName?: string;
  /** "initials" — show team initials in a muted circle (default)
   *  "skeleton" — show a muted circle with no text (used on featured cards
   *               while the logo detail-fetch is still in flight) */
  fallback?: "initials" | "skeleton";
}) {
  const [failed, setFailed] = useState(false);

  if (team.logoUrl && !failed) {
    return (
      <span className={cn("flex shrink-0 items-center justify-center", containerClassName)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={proxyUrl(team.logoUrl)}
          alt={team.name}
          width={imageSize}
          height={imageSize}
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      </span>
    );
  }

  if (fallback === "skeleton") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-muted animate-pulse",
          containerClassName
        )}
      />
    );
  }

  // initials fallback
  const initials = team.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground",
        containerClassName,
        textClassName
      )}
    >
      {initials}
    </span>
  );
}
