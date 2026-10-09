"use client";

import Image from "next/image";
import { toast } from "sonner";
import { Gem, Zap, ArrowUpRight } from "lucide-react";
import { HeroCarousel } from "@/components/home/hero-carousel";

function JackpotTile() {
  return (
    <button
      type="button"
      onClick={() => toast.info("Jackpot is coming soon.")}
      className="group relative flex min-h-36 flex-1 flex-col justify-between overflow-hidden rounded-2xl p-4 text-left text-white"
    >
      <Image
        src="https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=800&q=80"
        alt=""
        fill
        className="object-cover transition-transform duration-500 group-hover:scale-105"
        sizes="320px"
      />
      <div className="absolute inset-0 bg-gradient-to-br from-navy/95 via-navy/75 to-[#5A2DF0]/60" />
      <div className="relative flex items-center justify-between">
        <span className="flex items-center gap-1 rounded-full bg-volt px-2 py-0.5 text-[10px] font-extrabold text-navy uppercase">
          <Gem className="size-3" />
          Jackpot
        </span>
        <ArrowUpRight className="size-5 text-white/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="relative">
        <p className="text-xs font-semibold text-white/60">Predict 12, win</p>
        <p className="text-2xl font-black tracking-tight">GHS 150,000</p>
      </div>
    </button>
  );
}

function VirtualsTile() {
  return (
    <button
      type="button"
      onClick={() => toast.info("Instant Virtuals is coming soon.")}
      className="group relative flex min-h-36 flex-1 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#1F6BFF] to-[#5A2DF0] p-4 text-left text-white"
    >
      <Zap className="absolute -right-4 -bottom-4 size-28 fill-white/10 text-white/10 transition-transform duration-500 group-hover:rotate-12" />
      <div className="relative flex items-center justify-between">
        <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold uppercase">Virtuals</span>
        <ArrowUpRight className="size-5 text-white/60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </div>
      <div className="relative">
        <p className="text-xs font-semibold text-white/70">Results every 3 minutes</p>
        <p className="text-xl leading-tight font-black tracking-tight">Instant Virtuals</p>
      </div>
    </button>
  );
}

export function HomeHero() {
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_260px]">
      <div className="min-w-0">
        <HeroCarousel />
      </div>
      <div className="hidden gap-3 sm:flex xl:flex-col">
        <JackpotTile />
        <VirtualsTile />
      </div>
    </div>
  );
}
