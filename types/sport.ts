export const SPORT_SLUGS = [
  "football",
  "basketball",
  "tennis",
  "cricket",
  "baseball",
  "ice-hockey",
  "handball",
  "american-football",
] as const;

export type SportSlug = (typeof SPORT_SLUGS)[number];

export interface Sport {
  slug: SportSlug;
  name: string;
}
