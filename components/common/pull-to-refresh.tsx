"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

const THRESHOLD = 72; // px to pull before triggering
const RESISTANCE = 2.5; // drag resistance factor

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullY, setPullY] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const canPull = useCallback(() => {
    return (containerRef.current?.scrollTop ?? 0) === 0;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function onTouchStart(e: TouchEvent) {
      if (!canPull()) return;
      startY.current = e.touches[0].clientY;
    }

    function onTouchMove(e: TouchEvent) {
      if (startY.current === null || refreshing) return;
      const delta = (e.touches[0].clientY - startY.current) / RESISTANCE;
      if (delta > 0) {
        e.preventDefault();
        setPullY(Math.min(delta, THRESHOLD * 1.5));
      }
    }

    async function onTouchEnd() {
      if (pullY >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullY(THRESHOLD);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullY(0);
        }
      } else {
        setPullY(0);
      }
      startY.current = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullY, refreshing, onRefresh, canPull]);

  const progress = Math.min(pullY / THRESHOLD, 1);
  const showing = pullY > 0 || refreshing;

  return (
    <div ref={containerRef} className="relative overflow-y-auto">
      {/* Pull indicator */}
      <div
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-all duration-200 lg:hidden"
        style={{ height: showing ? `${refreshing ? THRESHOLD : pullY}px` : 0 }}
      >
        <div
          className="flex size-9 items-center justify-center rounded-full bg-card shadow-md border border-border"
          style={{ opacity: progress, transform: `scale(${0.6 + 0.4 * progress}) rotate(${progress * 180}deg)` }}
        >
          {refreshing
            ? <Loader2 className="size-4 animate-spin text-[#1F6BFF]" />
            : <svg className="size-4 text-[#1F6BFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14M5 12l7-7 7 7" /></svg>
          }
        </div>
      </div>

      <div style={{ transform: `translateY(${refreshing ? THRESHOLD : pullY > 0 ? pullY : 0}px)`, transition: pullY === 0 ? "transform 0.2s ease" : "none" }}>
        {children}
      </div>
    </div>
  );
}
