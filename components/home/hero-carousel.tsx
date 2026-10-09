"use client";

import { useEffect, useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

interface Slide {
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  image: string;
  accent: string;
}

const SLIDES: Slide[] = [
  {
    eyebrow: "Live Now · In-Play",
    title: "Every Second Counts",
    subtitle: "Follow live scores and cash out before full time.",
    cta: "Explore Live Betting",
    href: "/live-betting",
    image: "https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=1400&q=80",
    accent: "from-navy/90 via-navy/55 to-transparent",
  },
  {
    eyebrow: "Weekend Special · Big Odds",
    title: "Champions League Nights",
    subtitle: "Europe's elite clash, pick your winner and win big.",
    cta: "View Markets",
    href: "/sports",
    image: "https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=1400&q=80",
    accent: "from-navy/85 via-navy/50 to-transparent",
  },
  {
    eyebrow: "Basketball · Now Live",
    title: "Hoops & Big Odds",
    subtitle: "NBA, EuroLeague and more — bet the winner or the total points.",
    cta: "Bet on Basketball",
    href: "/sports?sport=basketball",
    image: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1400&q=80",
    accent: "from-navy/85 via-navy/45 to-transparent",
  },
  {
    eyebrow: "Tennis · ATP & WTA",
    title: "Game, Set, Win",
    subtitle: "Back your player in every set, from Challengers to the Slams.",
    cta: "Bet on Tennis",
    href: "/sports?sport=tennis",
    image: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=1400&q=80",
    accent: "from-navy/90 via-navy/50 to-transparent",
  },
];

export function HeroCarousel() {
  const [api, setApi] = useState<CarouselApi>();
  const [selected, setSelected] = useState(0);

  const autoplay = Autoplay({ delay: 5000, stopOnInteraction: true });

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setSelected(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api]);

  const scrollTo = useCallback((i: number) => api?.scrollTo(i), [api]);
  const scrollPrev = useCallback(() => api?.scrollPrev(), [api]);
  const scrollNext = useCallback(() => api?.scrollNext(), [api]);

  return (
    <div className="relative h-full min-h-[220px] overflow-hidden rounded-2xl sm:min-h-[300px]">
      <Carousel setApi={setApi} plugins={[autoplay]} opts={{ loop: true }} className="h-full">
        <CarouselContent className="h-full">
          {SLIDES.map((slide) => (
            <CarouselItem key={slide.title} className="h-full">
              <div className="relative h-full min-h-[220px] sm:min-h-[300px]">
                {/* Background image */}
                <Image
                  src={slide.image}
                  alt={slide.title}
                  fill
                  className="object-cover object-center"
                  priority
                  sizes="(max-width: 1024px) 100vw, calc(100vw - 280px)"
                />
                {/* Gradient overlay */}
                <div className={cn("absolute inset-0 bg-gradient-to-r", slide.accent)} />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-5 pb-9 sm:justify-center sm:p-10">
                  <span className="mb-2 w-fit rounded-full border border-volt/70 bg-volt/15 px-3 py-0.5 text-[11px] font-bold tracking-widest text-volt uppercase backdrop-blur-sm">
                    {slide.eyebrow}
                  </span>
                  <h2 className="max-w-md text-2xl leading-[1.05] font-black tracking-tight text-white uppercase italic drop-shadow-md sm:text-4xl lg:text-5xl">
                    {slide.title}
                  </h2>
                  <p className="mt-2 max-w-xs text-sm text-white/80 drop-shadow-sm">
                    {slide.subtitle}
                  </p>
                  <Link
                    href={slide.href}
                    className="mt-4 w-fit rounded-full bg-volt px-6 py-2.5 text-sm font-extrabold text-navy shadow-lg shadow-volt/20 transition-colors hover:bg-volt/85"
                  >
                    {slide.cta}
                  </Link>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {/* Prev / Next arrows */}
      <button
        onClick={scrollPrev}
        aria-label="Previous slide"
        className="absolute right-14 bottom-4 hidden size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 sm:flex"
      >
        <ChevronLeft className="size-4" />
      </button>
      <button
        onClick={scrollNext}
        aria-label="Next slide"
        className="absolute right-4 bottom-4 hidden size-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition hover:bg-white/30 sm:flex"
      >
        <ChevronRight className="size-4" />
      </button>

      {/* Dot indicators */}
      <div className="absolute bottom-4 left-5 flex gap-1.5 sm:left-10">
        {SLIDES.map((slide, i) => (
          <button
            key={slide.title}
            onClick={() => scrollTo(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              i === selected ? "w-6 bg-volt" : "w-1.5 bg-white/50"
            )}
          />
        ))}
      </div>
    </div>
  );
}
