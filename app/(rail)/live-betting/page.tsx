import { LiveViewTabs, type LiveViewKey } from "@/components/live/live-view-tabs";
import { LiveHeroBanner } from "@/components/live/live-hero-banner";
import { MultiView } from "@/components/live/multi-view";
import { SingleView } from "@/components/live/single-view";
import { ScheduleView } from "@/components/live/schedule-view";

const TITLES: Record<LiveViewKey, string> = {
  multi: "Multi View",
  single: "Single View",
  schedule: "Schedule",
};

export default async function LiveBettingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const view = (params.view ?? "multi") as LiveViewKey;

  return (
    <div className="overflow-hidden rounded-2xl shadow-lg shadow-navy/10">
      <LiveViewTabs active={view} />
      <div className="bg-navy">
        <LiveHeroBanner title={TITLES[view] ?? TITLES.multi} />
        {view === "single" ? <SingleView /> : view === "schedule" ? <ScheduleView /> : <MultiView />}
      </div>
    </div>
  );
}
