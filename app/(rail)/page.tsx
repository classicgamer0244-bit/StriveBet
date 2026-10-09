import { HomeHero } from "@/components/home/home-hero";
import { SportTiles } from "@/components/home/sport-tiles";
import { LiveNowStrip } from "@/components/home/live-now-strip";
import { FeaturedFixtures, HighlightsSection } from "@/components/home/home-page-client";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6 pb-4">
      <HomeHero />
      <SportTiles />
      <LiveNowStrip />
      <FeaturedFixtures />
      <HighlightsSection />
    </div>
  );
}
