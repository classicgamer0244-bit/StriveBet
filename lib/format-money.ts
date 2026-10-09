import { CURRENCY } from "@/lib/constants";

export function money(n: number): string {
  return `${CURRENCY} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Same formatting as money() but without the currency prefix — for spots
 * that already show CURRENCY separately, or for non-money numbers (e.g.
 * total odds) that still shouldn't render as an unbroken "1000.00". */
export function formatAmount(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function shortDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}
