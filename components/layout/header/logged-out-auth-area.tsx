"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/use-auth";
import { useUI } from "@/hooks/use-ui";

export function LoggedOutAuthArea() {
  const { login, isBusy, error } = useAuth();
  const { openLogin, openRegister, openForgotPassword } = useUI();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);

  const [showPassword, setShowPassword] = useState(false);

  async function handleQuickLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !password) return;
    const ok = await login(phone, password);
    if (ok) {
      setPhone("");
      setPassword("");
    }
  }

  return (
    <>
      {/* Desktop: inline quick-login */}
      <form onSubmit={handleQuickLogin} className="hidden items-center gap-2 lg:flex">
        <div className="flex h-9 items-center overflow-hidden rounded-full border border-white/10 bg-white/5">
          <span className="border-r border-white/10 pl-3.5 pr-2 text-xs font-bold text-volt">+233</span>
          <input
            value={phone}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
              setPhone(digits);
            }}
            placeholder="Mobile Number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            className="w-32 bg-transparent px-2 text-sm text-white placeholder:text-white/40 outline-none"
          />
        </div>
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            className="h-9 w-32 rounded-full border border-white/10 bg-white/5 px-3.5 pr-8 text-sm text-white placeholder:text-white/40 outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-white/70 hover:text-white"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        {error && <span className="max-w-40 text-xs font-medium text-red-100">{error}</span>}
        <label className="hidden items-center gap-1.5 whitespace-nowrap text-xs text-white/60 2xl:flex">
          <Checkbox
            checked={keepSignedIn}
            onCheckedChange={(v) => setKeepSignedIn(v === true)}
            className="border-white/50 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#1F6BFF]"
          />
          Keep me signed in
        </label>
        <button
          type="button"
          onClick={openForgotPassword}
          className="hidden whitespace-nowrap text-xs font-medium text-white/60 hover:text-white xl:block"
        >
          Forgot Password?
        </button>
        <Button type="submit" size="sm" disabled={isBusy} className="h-9 rounded-full bg-white/10 px-4 font-bold text-white hover:bg-white/20">
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Login"}
        </Button>
        <Button type="button" onClick={openRegister} size="sm" className="h-9 rounded-full bg-volt px-4 font-extrabold text-navy hover:bg-volt/85">
          Register
        </Button>
      </form>

      {/* Mobile: compact buttons that open the full modal */}
      <div className="flex items-center gap-2 lg:hidden">
        <Button type="button" onClick={openLogin} size="sm" className="h-8 rounded-full bg-white/10 px-3.5 font-bold text-white hover:bg-white/20">
          Login
        </Button>
        <Button type="button" onClick={openRegister} size="sm" className="h-8 rounded-full bg-volt px-3.5 font-extrabold text-navy hover:bg-volt/85">
          Register
        </Button>
      </div>
    </>
  );
}
