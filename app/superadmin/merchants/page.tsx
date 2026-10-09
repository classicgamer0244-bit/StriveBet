import { OperatorPageHeader } from "@/components/admin/operator-page";
import { MerchantsManager } from "@/components/admin/merchants-manager";

export default function SuperadminMerchantsPage() {
  return (
    <div>
      <OperatorPageHeader title="Merchants" description="Create, approve and suspend admin accounts." />
      <MerchantsManager />
    </div>
  );
}
