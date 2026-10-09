import { OperatorPageHeader } from "@/components/admin/operator-page";
import { MatchForm } from "@/components/admin/match-form";

export default function NewMatchPage() {
  return (
    <div>
      <OperatorPageHeader title="Create match" description="Set up a simulated match for your players to bet on." />
      <MatchForm />
    </div>
  );
}
