export function formatKickoffTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatDateHeader(iso: string) {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" });
  const weekday = date.toLocaleDateString("en-GB", { weekday: "long" });
  return `${day} ${weekday}`;
}

/** Calendar-day key (local to the ISO string's UTC date) used to cluster fixtures under one date header. */
export function dateKey(iso: string) {
  return iso.slice(0, 10);
}
