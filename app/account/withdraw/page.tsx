import { WithdrawForm } from "@/components/account/withdraw-form";

export default function WithdrawPage() {
  return (
    <div>
      <h1 className="hidden lg:block mb-3 text-lg font-bold text-foreground">Withdraw</h1>
      <WithdrawForm />
    </div>
  );
}
