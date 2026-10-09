export interface Team {
  id: string;
  name: string;
  shortName?: string;
  /** Only present for real (api-football) teams — admin-created fixtures use free-text names with no crest. */
  logoUrl?: string;
}
