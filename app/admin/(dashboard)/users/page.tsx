"use client";

import { OperatorPageHeader } from "@/components/admin/operator-page";
import { UsersTable } from "@/components/admin/users-table";
import { useServerTable } from "@/hooks/use-server-table";
import type { User } from "@/types";

export default function AdminUsersPage() {
  const table = useServerTable<User>({ endpoint: "/api/admin/users" });

  return (
    <div>
      <OperatorPageHeader title="My Users" description="Players referred under your account, and their balances." />
      <UsersTable table={table} />
    </div>
  );
}
