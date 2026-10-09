"use client";

import { createContext, useCallback, useMemo, useState, type ReactNode } from "react";

export type AuthModalTab = "login" | "register" | "forgot-password";
export type RegisterStep = "account-info" | "done";

export interface UIContextValue {
  authModalOpen: boolean;
  authModalTab: AuthModalTab;
  registerStep: RegisterStep;
  referralCode: string | null;
  openLogin: () => void;
  openRegister: () => void;
  openForgotPassword: () => void;
  closeAuthModal: () => void;
  setAuthModalTab: (tab: AuthModalTab) => void;
  setRegisterStep: (step: RegisterStep) => void;
  setReferralCode: (code: string | null) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
}

export const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthModalTab>("login");
  const [registerStep, setRegisterStep] = useState<RegisterStep>("account-info");
  const [referralCode, setReferralCodeState] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  const openLogin = useCallback(() => {
    setAuthModalTab("login");
    setAuthModalOpen(true);
  }, []);

  const openRegister = useCallback(() => {
    setAuthModalTab("register");
    setRegisterStep("account-info");
    setAuthModalOpen(true);
  }, []);

  const openForgotPassword = useCallback(() => {
    setAuthModalTab("forgot-password");
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => setAuthModalOpen(false), []);

  const setReferralCode = useCallback((code: string | null) => {
    setReferralCodeState(code);
    if (code && typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem("maxbet_ref", code);
      } catch {
        // sessionStorage unavailable — referral simply won't survive a reload.
      }
    }
  }, []);

  const value = useMemo<UIContextValue>(
    () => ({
      authModalOpen,
      authModalTab,
      registerStep,
      referralCode,
      openLogin,
      openRegister,
      openForgotPassword,
      closeAuthModal,
      setAuthModalTab,
      setRegisterStep,
      setReferralCode,
      mobileMenuOpen,
      setMobileMenuOpen,
      searchOpen,
      openSearch,
      closeSearch,
    }),
    [
      authModalOpen,
      authModalTab,
      registerStep,
      referralCode,
      openLogin,
      openRegister,
      openForgotPassword,
      closeAuthModal,
      setReferralCode,
      mobileMenuOpen,
      searchOpen,
      openSearch,
      closeSearch,
    ]
  );

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}
