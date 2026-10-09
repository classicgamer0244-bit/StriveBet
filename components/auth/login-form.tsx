"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CountryCodeSelect } from "./country-code-select";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";

export function LoginForm() {
  const { login, isBusy, error } = useAuth();
  const { closeAuthModal, setAuthModalTab } = useUI();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const canSubmit = phone.trim().length === 10 && password.length > 0 && !isBusy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const ok = await login(phone, password);
    if (ok) closeAuthModal();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex">
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
          className="rounded-l-none"
        />
      </div>

      <div className="relative">
        <Input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type={showPassword ? "text" : "password"}
          placeholder="Password"
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

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox checked={rememberMe} onCheckedChange={(v) => setRememberMe(v === true)} />
          Remember me
        </label>
        <button
          type="button"
          className="text-sm font-medium text-[#1F6BFF] hover:underline"
          onClick={() => setAuthModalTab("forgot-password")}
        >
          Forgot Password?
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <Checkbox checked={keepSignedIn} onCheckedChange={(v) => setKeepSignedIn(v === true)} />
        Keep me signed in
      </label>

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full text-base">
        {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Login"}
      </Button>
    </form>
  );
}
