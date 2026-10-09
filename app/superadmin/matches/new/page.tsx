import { OperatorPageHeader } from "@/components/admin/operator-page";
import { MatchForm } from "@/components/admin/match-form";

export default function SuperadminNewMatchPage() {
  return (
    <div>
      <OperatorPageHeader
        title="Create match"
        description="Set up a simulated match for players to bet on."
        backHref="/superadmin/matches"
        backLabel="Back to matches"
      />
      <MatchForm basePath="/superadmin/matches" />
    </div>
  );
}
