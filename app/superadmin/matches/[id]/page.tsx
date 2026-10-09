import { OperatorPageHeader } from "@/components/admin/operator-page";
import { LiveScoreControl } from "@/components/admin/live-score-control";
import { MatchStakesPanel } from "@/components/admin/match-stakes-panel";

export default async function SuperadminMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <OperatorPageHeader
        title="Match control"
        description="Oversee and, if needed, control this match."
        backHref="/superadmin/matches"
        backLabel="Back to matches"
      />
      <div className="flex flex-col gap-4">
        <LiveScoreControl fixtureId={id} />
        <MatchStakesPanel fixtureId={id} />
      </div>
    </div>
  );
}
