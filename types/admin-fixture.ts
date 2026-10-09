import type { Fixture } from "./fixture";
import type { ScheduledScoreEvent } from "./scheduled-event";

/**
 * A fixture created by an admin and driven by the client simulation engine.
 * Its `markets` are built exactly once at creation and frozen — never rebuilt
 * on read/hydrate, so selection ids stay stable as the join key for bets.
 */
export interface AdminFixture extends Fixture {
  origin: "admin";
  ownerAdminId: string;
  /** Real wall-clock epoch (ms) when the match should kick off. */
  simKickoffTs: number;
  /** Match-minutes per real second (e.g. 60 = a 90-min game plays in ~90s). */
  compression: number;
  scheduledEvents: ScheduledScoreEvent[];
}
