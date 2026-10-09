import { OperatorPageHeader } from "@/components/admin/operator-page";
import { LiveScoreControl } from "@/components/admin/live-score-control";
import { MatchStakesPanel } from "@/components/admin/match-stakes-panel";
import { CreateMatchLink } from "@/components/admin/create-match-link";

export default async function AdminMatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div>
      <OperatorPageHeader
        title="Match control"
        description="Run the clock, adjust the score, and settle bets."
        backHref="/admin/matches"
        backLabel="Back to matches"
        action={<CreateMatchLink />}
      />
      <div className="flex flex-col gap-4">
        <LiveScoreControl fixtureId={id} />
        <MatchStakesPanel fixtureId={id} />
      </div>
    </div>
  );
}
