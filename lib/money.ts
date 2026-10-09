/** Convert a major-unit amount (e.g. GHS 100.50) to minor units (10050) for storage. */
export function toMinor(amountMajor: number): number {
  return Math.round(amountMajor * 100);
}

/** Convert a stored minor-unit amount back to major units for API responses. */
export function fromMinor(amountMinor: number): number {
  return Math.round(amountMinor) / 100;
}
