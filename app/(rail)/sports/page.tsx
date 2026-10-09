import { Suspense } from "react";
import { SportsPageClient } from "@/components/sports/sports-page-client";

export default function SportsPage() {
  return (
    <Suspense>
      <SportsPageClient />
    </Suspense>
  );
}
