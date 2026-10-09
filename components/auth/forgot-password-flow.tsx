"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountryCodeSelect } from "./country-code-select";
import { PasswordChecklist, isPasswordValid } from "./password-checklist";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";

type Step = "phone" | "reset";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

export function ForgotPasswordFlow() {
  const { refreshBalance } = useAuth();
  const { setAuthModalTab, closeAuthModal } = useUI();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;
  const canSubmit = code.trim().length === 6 && isPasswordValid(newPassword) && passwordsMatch && !isBusy;

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (phone.trim().length < 6 || isBusy) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }
      setStep("reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim(), newPassword }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        setError(data?.error ?? "Invalid or expired code.");
        return;
      }
      await refreshBalance();
      closeAuthModal();
      setAuthModalTab("login");
      setStep("phone");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsBusy(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={handleRequestCode} className="flex flex-col gap-4">
        <p className="text-center text-sm text-muted-foreground">
          Enter the mobile number on your account and we&apos;ll text you a verification code.
        </p>
        <div className="flex">
          <CountryCodeSelect />
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Mobile Number"
            inputMode="numeric"
            className="rounded-l-none"
          />
        </div>
        {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}
        <Button type="submit" disabled={phone.trim().length < 6 || isBusy} className="h-11 w-full text-base">
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Send Code"}
        </Button>
        <button
          type="button"
          onClick={() => setAuthModalTab("login")}
          className="text-center text-sm text-muted-foreground hover:text-foreground"
        >
          Back to login
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleReset} className="flex flex-col gap-4">
      <p className="text-center text-sm text-muted-foreground">
        Enter the code sent to your number and choose a new password.
      </p>

      <Input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="6-digit code"
        inputMode="numeric"
        maxLength={6}
        className="text-center text-lg tracking-[0.3em]"
      />

      <div className="relative">
        <Input
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          type={showPassword ? "text" : "password"}
          placeholder="New Password"
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

      <div className="relative">
        <Input
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          type={showConfirm ? "text" : "password"}
          placeholder="Confirm New Password"
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShowConfirm((v) => !v)}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={showConfirm ? "Hide password" : "Show password"}
        >
          {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {confirmPassword.length > 0 && !passwordsMatch && (
        <p className="text-sm font-medium text-destructive">Passwords do not match.</p>
      )}

      <PasswordChecklist password={newPassword} />

      {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full text-base">
        {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Reset Password"}
      </Button>
      <button
        type="button"
        onClick={() => { setStep("phone"); setError(null); }}
        className="text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Use a different number
      </button>
    </form>
  );
}
