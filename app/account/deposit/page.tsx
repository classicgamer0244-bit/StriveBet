import { Suspense } from "react";
import { DepositForm } from "@/components/account/deposit-form";

export default function DepositPage() {
  return (
    <div>
      <h1 className="hidden lg:block mb-3 text-lg font-bold text-foreground">Deposit</h1>
      <Suspense>
        <DepositForm />
      </Suspense>
    </div>
  );
}
