import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * StriveBet mark — the yellow bolt + "B". `tone="light"` (the default) is for
 * dark backgrounds and draws the B in white; `tone="dark"` keeps the
 * original dark-teal B for light backgrounds.
 */
export function LogoMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <Image
      src={tone === "light" ? "/logo-mark-light.png" : "/logo-mark.png"}
      alt=""
      width={64}
      height={64}
      className={cn("size-8 shrink-0 object-contain", className)}
      aria-hidden="true"
      priority
    />
  );
}

/** Mark + "StriveBet" wordmark. `tone="light"` is for dark backgrounds. */
export function Logo({
  className,
  markClassName,
  tone = "light",
  showMark = true,
}: {
  className?: string;
  markClassName?: string;
  tone?: "light" | "dark";
  showMark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {showMark && <LogoMark className={markClassName} tone={tone} />}
      <span
        className={cn(
          "text-xl leading-none font-black tracking-tight italic",
          tone === "light" ? "text-white" : "text-[#0A3140]"
        )}
      >
        Strive<span className="text-volt">Bet</span>
      </span>
    </span>
  );
}
