import type { Fixture } from "@/types";
import { groupFixturesByLeague } from "@/data/selectors";
import { CompetitionGroup } from "@/components/fixtures/competition-group";
import { MobileAzMenuLayout } from "./mobile-az-menu-layout";
import { EmptyState } from "@/components/common/empty-state";

export function SportsFixtureList({ fixtures, title }: { fixtures: Fixture[]; title: string }) {
  const groups = groupFixturesByLeague(fixtures);

  return (
    <>
      <div className="hidden rounded-lg border border-border bg-card lg:block">
        <div className="border-b border-border px-4 py-3">
          <h1 className="text-base font-bold text-foreground">{title}</h1>
        </div>
        {groups.length === 0 ? (
          <EmptyState title="No fixtures match these filters" description="Try widening the start-time filter or clearing the league filter." />
        ) : (
          <div className="overflow-x-auto">
            {groups.map((group) => (
              <CompetitionGroup
                key={group.leagueId}
                leagueName={group.leagueName}
                fixtures={group.fixtures}
                showGoalsColumn
                groupByDate
              />
            ))}
          </div>
        )}
      </div>
      <div className="lg:hidden">
        <MobileAzMenuLayout fixtures={fixtures} />
      </div>
    </>
  );
}
