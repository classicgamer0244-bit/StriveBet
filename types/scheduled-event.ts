export interface ScheduledScoreEvent {
  id: string;
  /** Match minute at which this goal is applied by the simulation engine. */
  atMinute: number;
  team: "home" | "away";
  deltaGoals: number;
  applied: boolean;
}
