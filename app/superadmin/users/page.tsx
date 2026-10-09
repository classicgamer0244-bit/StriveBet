"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { UsersTable } from "@/components/admin/users-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { User } from "@/types";

export default function SuperadminUsersPage() {
  const table = useServerTable<User>({ endpoint: "/api/superadmin/users" });

  return (
    <div>
      <OperatorPageHeader title="Users" description="Every player on the platform. Suspend or restore access." />
      <UsersTable table={table} manageable showReferrer />
    </div>
  );
}
