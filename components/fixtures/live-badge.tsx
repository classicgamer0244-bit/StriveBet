export function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-live/10 px-1.5 py-0.5 text-[10px] font-bold text-live">
      <span className="size-1.5 animate-pulse rounded-full bg-live" />
      LIVE
    </span>
  );
}
