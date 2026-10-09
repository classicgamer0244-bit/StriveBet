import { AccountInfoCard } from "@/components/account/account-info-card";
import { MobileAccountHub } from "@/components/account/mobile-account-hub";

export default function AccountInfoPage() {
  return (
    <>
      <div className="hidden lg:block">
        <AccountInfoCard />
      </div>
      <MobileAccountHub />
    </>
  );
}
