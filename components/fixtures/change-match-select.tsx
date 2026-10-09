"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Fixture } from "@/types";

export function ChangeMatchSelect({ fixtures, currentId }: { fixtures: Fixture[]; currentId: string }) {
  const router = useRouter();

  if (fixtures.length <= 1) return null;

  return (
    <Select value={currentId} onValueChange={(id) => router.push(`/sports/${id}`)}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Change match" />
      </SelectTrigger>
      <SelectContent>
        {fixtures.map((f) => (
          <SelectItem key={f.id} value={f.id}>
            {f.homeTeam.name} vs {f.awayTeam.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
