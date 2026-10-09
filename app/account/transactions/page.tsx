import { MyTransactionsList } from "@/components/account/my-transactions-list";

export default function TransactionsPage() {
  return (
    <div className="lg:px-0">
      <h1 className="hidden lg:block mb-3 text-lg font-bold text-foreground">Transactions</h1>
      <MyTransactionsList />
    </div>
  );
}
