import { Suspense } from "react";
import { SportCategoryNav } from "@/components/sports/sport-category-nav";
import { RightRail } from "@/components/layout/right-rail";

export default function RailLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px] px-3 lg:px-6">
      <Suspense fallback={null}>
        <SportCategoryNav />
      </Suspense>
      <div className="flex flex-col gap-6 py-4 lg:flex-row lg:items-start lg:py-6">
        <div className="min-w-0 flex-1">{children}</div>
        <aside className="w-full shrink-0 lg:w-80">
          <RightRail />
        </aside>
      </div>
    </div>
  );
}
