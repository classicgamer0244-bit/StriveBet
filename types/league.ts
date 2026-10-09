import type { SportSlug } from "./sport";

export interface League {
  id: string;
  sportSlug: SportSlug;
  name: string;
  region?: string;
  fixtureCount: number;
  /** Only present for real (api-football) leagues. */
  logoUrl?: string;
}
