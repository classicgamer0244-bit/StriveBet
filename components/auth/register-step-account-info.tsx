"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCodeSelect } from "./country-code-select";
import { PasswordChecklist, isPasswordValid } from "./password-checklist";

export interface RegisterStepAccountInfoProps {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  referralCode: string;
  setReferralCode: (v: string) => void;
  referralPrefilled: boolean;
  isBusy: boolean;
  error: string | null;
  onContinue: () => void;
}

export function RegisterStepAccountInfo({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  email,
  setEmail,
  phone,
  setPhone,
  password,
  setPassword,
  referralCode,
  setReferralCode,
  referralPrefilled,
  isBusy,
  error,
  onContinue,
}: RegisterStepAccountInfoProps) {
  const [showPassword, setShowPassword] = useState(false);

  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    phone.trim().length === 10 &&
    isPasswordValid(password) &&
    !isBusy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) onContinue();
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex gap-2">
        <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="flex-1 min-w-0" />
        <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="flex-1 min-w-0" />
      </div>

      <div className="flex items-stretch">
        <CountryCodeSelect />
        <Input
          value={phone}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
            setPhone(digits);
          }}
          placeholder="Mobile Number"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          className="rounded-l-none min-w-0"
        />
      </div>

      <Input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        placeholder="Email (optional)"
      />

      <div>
        <div className="relative">
          <Input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            placeholder="Set Password"
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <PasswordChecklist password={password} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Strive ID <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Input
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value)}
          placeholder="Enter Strive ID"
          readOnly={referralPrefilled}
          className={referralPrefilled ? "bg-muted text-muted-foreground" : ""}
        />
      </div>

      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full text-base">
        {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Create New Account"}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        By creating an account, you agree to our{" "}
        <span className="font-medium text-[#1F6BFF]">Terms &amp; Conditions</span> and confirm that you are at
        least 18 years old or over and all information given is true.
      </p>
    </form>
  );
}
