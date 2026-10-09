"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";
import { RegisterStepAccountInfo } from "./register-step-account-info";
import { RegisterStepDone } from "./register-step-done";

const STEPS = [
  { key: "account-info", label: "Account Info" },
  { key: "done", label: "Done" },
] as const;

function StepIndicator({ current }: { current: string }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center justify-center gap-2 py-1">
      {STEPS.map((step, i) => (
        <div key={step.key} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={cn(
                "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                i <= currentIndex ? "bg-[#1F6BFF] text-white" : "bg-muted text-muted-foreground"
              )}
            >
              {i < currentIndex ? <Check className="size-3.5" /> : i + 1}
            </div>
            <span className={cn("text-[11px] font-medium", i <= currentIndex ? "text-foreground" : "text-muted-foreground")}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={cn("mb-4 h-0.5 w-8 rounded", i < currentIndex ? "bg-[#1F6BFF]" : "bg-muted")} />
          )}
        </div>
      ))}
    </div>
  );
}

export function RegisterStepper() {
  const { register, isBusy, error } = useAuth();
  const { registerStep, setRegisterStep, closeAuthModal, referralCode, setReferralCode } = useUI();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [referralInput, setReferralInput] = useState(referralCode ?? "");

  async function handleContinue() {
    const ok = await register({
      firstName,
      lastName,
      phone,
      email: email.trim() || undefined,
      password,
      referralCode: referralInput || undefined,
    });
    if (ok) setRegisterStep("done");
  }

  function handleDone() {
    closeAuthModal();
    setRegisterStep("account-info");
  }

  return (
    <div className="flex flex-col gap-5">
      <StepIndicator current={registerStep} />

      {registerStep === "account-info" && (
        <RegisterStepAccountInfo
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          email={email}
          setEmail={setEmail}
          phone={phone}
          setPhone={setPhone}
          password={password}
          setPassword={setPassword}
          referralCode={referralInput}
          setReferralCode={(v) => {
            setReferralInput(v);
            setReferralCode(v || null);
          }}
          referralPrefilled={Boolean(referralCode)}
          isBusy={isBusy}
          error={error}
          onContinue={handleContinue}
        />
      )}

      {registerStep === "done" && <RegisterStepDone onContinue={handleDone} />}
    </div>
  );
}
