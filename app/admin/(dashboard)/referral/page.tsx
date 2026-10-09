import { OperatorPageHeader } from "@/components/admin/operator-page";
import { ReferralPanel } from "@/components/admin/referral-panel";

export default function AdminReferralPage() {
  return (
    <div>
      <OperatorPageHeader title="Referral Link" description="Share this to register users under your account." />
      <ReferralPanel />
    </div>
  );
}
