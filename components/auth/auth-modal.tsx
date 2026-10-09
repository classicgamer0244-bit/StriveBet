"use client";

import Image from "next/image";
import { Trophy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUI } from "@/hooks/use-ui";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "./login-form";
import { RegisterStepper } from "./register-stepper";
import { ForgotPasswordFlow } from "./forgot-password-flow";

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden rounded-l-lg lg:flex lg:w-56 lg:shrink-0 lg:flex-col lg:justify-between">
      <Image
        src="https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600&q=80"
        alt="Stadium"
        fill
        className="object-cover object-center brightness-50"
        sizes="224px"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-navy/40 to-[#1F6BFF]/70" />
      <div className="relative flex flex-col gap-2 p-6">
        <Logo markClassName="size-10" />
        <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
          Official Sports Betting Partner
        </p>
      </div>
      <div className="relative p-6">
        <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-volt/20 text-volt">
          <Trophy className="size-5" />
        </div>
        <p className="text-sm font-bold leading-snug text-white">
          Join thousands of winners betting live every day.
        </p>
        <p className="mt-1 text-xs text-white/50">Fast payouts · Live odds · Best markets</p>
      </div>
    </div>
  );
}

export function AuthModal() {
  const { authModalOpen, authModalTab, setAuthModalTab, closeAuthModal, registerStep, setRegisterStep } = useUI();

  return (
    <Dialog
      open={authModalOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeAuthModal();
          setRegisterStep("account-info");
        }
      }}
    >
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl lg:max-w-3xl">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {authModalTab === "login" ? "Login" : authModalTab === "register" ? "Register" : "Reset Password"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[92dvh] min-h-0 overflow-hidden">
          <BrandPanel />

          {/* Form side */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Tabs */}
            <div className="flex shrink-0 border-b border-border">
              {(["register", "login"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setAuthModalTab(tab)}
                  className={cn(
                    "flex-1 border-b-2 px-4 py-3.5 text-sm font-semibold capitalize transition-colors",
                    authModalTab === tab
                      ? "border-[#1F6BFF] text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Form body */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
              {authModalTab === "register" && registerStep === "account-info" && (
                <p className="text-center text-xs text-muted-foreground">
                  Password must be at least 6 characters.
                </p>
              )}
              {authModalTab === "login" ? (
                <LoginForm />
              ) : authModalTab === "register" ? (
                <RegisterStepper />
              ) : (
                <ForgotPasswordFlow />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
