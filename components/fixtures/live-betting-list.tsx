import type { Fixture } from "@/types";
import { groupFixturesByLeague } from "@/data/selectors";
import { CompetitionGroup } from "./competition-group";
import { MobileFixtureList } from "./mobile-fixture-list";
import { EmptyState } from "@/components/common/empty-state";

export function LiveBettingList({ fixtures, dark = false }: { fixtures: Fixture[]; dark?: boolean }) {
  if (fixtures.length === 0) {
    return <EmptyState title="No live matches right now" description="Check back soon, or browse upcoming fixtures instead." />;
  }

  const groups = groupFixturesByLeague(fixtures);

  return (
    <>
      <div className="hidden overflow-x-auto lg:block">
        {groups.map((group) => (
          <CompetitionGroup key={group.leagueId} leagueName={group.leagueName} fixtures={group.fixtures} dark={dark} />
        ))}
      </div>
      <div className="lg:hidden">
        <MobileFixtureList fixtures={fixtures} dark={dark} hideDateLabel />
      </div>
    </>
  );
}
