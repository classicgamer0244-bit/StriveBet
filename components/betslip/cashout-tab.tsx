import { EmptyState } from "@/components/common/empty-state";

export function CashoutTab() {
  return (
    <EmptyState
      title="No cashout-eligible bets"
      description="Once you place a bet on a live match, you'll be able to cash out early from here."
    />
  );
}
