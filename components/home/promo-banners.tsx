"use client";

import { toast } from "sonner";
import { BRAND_NAME } from "@/lib/constants";

export function VirtualWorldBanner() {
  return (
    <button
      type="button"
      onClick={() => toast.info("Scheduled Virtuals is coming soon.")}
      className="flex w-full flex-col gap-2 rounded-lg bg-gradient-to-r from-navy via-[#1F6BFF] to-[#5A2DF0] px-5 py-5 text-left text-white sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <span className="text-lg font-extrabold">{BRAND_NAME}</span>
        <span className="ml-2 text-lg font-extrabold text-white/90">VIRTUAL WORLD</span>
        <p className="text-sm text-white/80">Bet on every second</p>
      </div>
      <span className="w-fit shrink-0 rounded-md bg-[#1F6BFF] px-4 py-2 text-sm font-bold text-white hover:bg-[#1453CC] transition-colors">Bet Now</span>
    </button>
  );
}

import Image from "next/image";

export function JackpotBanner() {
  return (
    <button
      type="button"
      onClick={() => toast.info("Jackpot is coming soon.")}
      className="relative w-full overflow-hidden rounded-lg text-left text-white"
    >
      {/* Background image */}
      <Image
        src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=1400&q=80"
        alt="Jackpot banner"
        fill
        className="object-cover object-center brightness-50"
        sizes="100vw"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-navy/40 to-[#1F6BFF]/50" />

      {/* Content */}
      <div className="relative flex min-h-40 flex-col justify-center gap-4 px-8 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="mb-1 inline-block rounded-full border border-volt bg-volt/15 px-3 py-0.5 text-[11px] font-bold tracking-widest text-volt uppercase">
            Jackpot
          </span>
          <h3 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{BRAND_NAME} 12 JACKPOT</h3>
          <p className="mt-1 text-sm text-white/70">Predict all 12 outcomes and take home the prize</p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div>
            <p className="text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">GHS 150,000</p>
            <p className="text-sm font-semibold text-white/60">up for grabs this week</p>
          </div>
          <span className="rounded-md bg-[#1F6BFF] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-colors hover:bg-[#1453CC]">
            Play Now
          </span>
        </div>
      </div>
    </button>
  );
}
