import Link from "next/link";
import { BRAND_NAME } from "@/lib/constants";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions",
};

const SECTIONS = [
  {
    title: "1. Acceptance of Terms",
    body: `By accessing or using ${BRAND_NAME}, you agree to be bound by these Terms and Conditions. If you do not agree, please do not use our platform. We reserve the right to update these terms at any time, and continued use of the platform constitutes acceptance of any changes.`,
  },
  {
    title: "2. Eligibility",
    body: `You must be at least 18 years of age to register and place bets on ${BRAND_NAME}. By creating an account, you confirm that you are of legal age and that gambling is lawful in your jurisdiction. We reserve the right to request proof of age at any time and to suspend accounts pending verification.`,
  },
  {
    title: "3. Account Registration",
    body: `Each user may hold only one account. You are responsible for maintaining the confidentiality of your login credentials. Any activity carried out under your account is your responsibility. Please notify us immediately if you suspect unauthorised access to your account.`,
  },
  {
    title: "4. Deposits & Withdrawals",
    body: `All deposits and withdrawals are processed in Ghanaian Cedis (GHS). The minimum deposit amount is GHS 400. Withdrawals can only be made to the mobile money number registered on your account. ${BRAND_NAME} does not charge transaction fees on deposits, but your network provider may apply charges.`,
  },
  {
    title: "5. Betting Rules",
    body: `All bets are final once confirmed. ${BRAND_NAME} reserves the right to void bets in the event of obvious errors in odds, system faults, or fraudulent activity. Winnings will be credited to your account balance upon settlement of the relevant event. We reserve the right to limit or refuse bets at our discretion.`,
  },
  {
    title: "6. Bonuses & Promotions",
    body: `Bonuses and promotional offers are subject to their own specific terms and wagering requirements. ${BRAND_NAME} reserves the right to withdraw or modify any promotion at any time. Abuse of bonuses, including the use of multiple accounts, will result in account suspension and forfeiture of winnings.`,
  },
  {
    title: "7. Responsible Gaming",
    body: `${BRAND_NAME} is committed to promoting responsible gambling. We offer tools such as deposit limits and self-exclusion to help you stay in control. If you believe you have a gambling problem, please contact us or reach out to a professional support organisation. Gambling should be entertaining — never chase losses.`,
  },
  {
    title: "8. Privacy & Data",
    body: `We collect and process your personal data in accordance with our Privacy Policy. Your data is used solely for account management, transaction processing, and regulatory compliance. We do not sell your personal information to third parties.`,
  },
  {
    title: "9. Prohibited Activities",
    body: `The following are strictly prohibited: use of automated betting software or bots, collusion, match-fixing, money laundering, and any form of fraud. Violation of these rules will result in immediate account suspension, forfeiture of funds, and may be reported to the relevant authorities.`,
  },
  {
    title: "10. Limitation of Liability",
    body: `${BRAND_NAME} shall not be liable for any loss or damage arising from the use of our platform, including but not limited to loss of winnings due to technical failures, delays, or interruptions. We make no warranties regarding the uninterrupted availability of our services.`,
  },
  {
    title: "11. Governing Law",
    body: `These Terms and Conditions are governed by the laws of the Republic of Ghana. ${BRAND_NAME} operates under a licence issued by the Gaming Commission of Ghana (GCG). Any disputes shall be subject to the exclusive jurisdiction of the courts of Ghana.`,
  },
  {
    title: "12. Contact Us",
    body: `If you have any questions about these Terms and Conditions, please contact our support team through the platform. We aim to respond to all enquiries within 24 hours.`,
  },
];

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-foreground">Terms &amp; Conditions</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated: January 2025</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
          Welcome to {BRAND_NAME}. Please read these Terms and Conditions carefully before using our platform.
          These terms govern your use of our website, mobile application, and all related services.
        </p>

        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="mb-2 text-sm font-bold text-foreground">{section.title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link href="/" className="text-sm font-semibold text-primary hover:underline">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
