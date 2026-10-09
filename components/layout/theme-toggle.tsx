"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** The theme is only known on the client (it lives in localStorage), so
 * render a neutral placeholder until hydrated to avoid a mismatch. */
function useMounted() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

/** Round icon button for the top bar (sits on the navy chrome). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20",
        className
      )}
    >
      {!mounted ? <span className="size-4" /> : isDark ? <Sun className="size-4 text-volt" /> : <Moon className="size-4" />}
    </button>
  );
}

/** Labelled light/dark segmented switch for the sidebar and menus (navy chrome). */
export function ThemeSwitch({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const isDark = mounted && resolvedTheme === "dark";

  const option = (active: boolean) =>
    cn(
      "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-colors",
      active ? "bg-volt text-navy" : "text-white/55 hover:text-white"
    );

  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex rounded-xl bg-white/5 p-1", className)}>
      <button type="button" role="radio" aria-checked={mounted && !isDark} onClick={() => setTheme("light")} className={option(mounted && !isDark)}>
        <Sun className="size-3.5" />
        Light
      </button>
      <button type="button" role="radio" aria-checked={isDark} onClick={() => setTheme("dark")} className={option(isDark)}>
        <Moon className="size-3.5" />
        Dark
      </button>
    </div>
  );
}
