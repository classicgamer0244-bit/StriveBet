"use client";

import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";

export function UserCard() {
  const { player } = useAuth();
  if (!player) return null;

  const rawPhone = player.phone ?? "";
  const maskedPhone = rawPhone.length >= 6
    ? rawPhone.slice(0, 2) + "*".repeat(rawPhone.length - 5) + rawPhone.slice(-3)
    : rawPhone;

  const formattedBalance = player.balance.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
      <div className="size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-[#1F6BFF]/30">
        <Image
          src="https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=96&h=96&fit=crop&crop=face"
          alt="Profile"
          width={44}
          height={44}
          className="object-cover"
        />
      </div>
      <div className="min-w-0">
        <p className="truncate font-bold text-foreground">
          {maskedPhone || player.displayName}
        </p>
        <p className="text-xs text-muted-foreground">Balance</p>
        <p className="font-bold text-[#1F6BFF] tabular-nums">
          {player.currency} {formattedBalance}
        </p>
      </div>
    </div>
  );
}
