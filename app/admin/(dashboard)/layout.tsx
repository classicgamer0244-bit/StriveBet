import { OperatorGate } from "@/components/admin/operator-gate";
import { ADMIN_NAV } from "@/lib/constants";

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorGate role="admin" nav={ADMIN_NAV} kind="Admin">
      {children}
    </OperatorGate>
  );
}
