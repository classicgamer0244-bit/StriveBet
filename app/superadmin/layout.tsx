import { OperatorGate } from "@/components/admin/operator-gate";
import { SUPERADMIN_NAV } from "@/lib/constants";

export default function SuperadminLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorGate role="superadmin" nav={SUPERADMIN_NAV} kind="Superadmin">
      {children}
    </OperatorGate>
  );
}
