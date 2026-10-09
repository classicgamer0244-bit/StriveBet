import { Suspense } from "react";
import { SportsSidebar } from "@/components/sports/sports-sidebar";

export default function SportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <Suspense fallback={<div className="hidden w-64 shrink-0 lg:block" />}>
        <SportsSidebar />
      </Suspense>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
