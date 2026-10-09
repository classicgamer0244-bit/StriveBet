"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Sparkles, RefreshCw, Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSports } from "@/data/selectors";
import { buildMarketsForFixture } from "@/data/mock/market-builder";
import type { Market } from "@/types";
import { ScoreEventEditor, type DraftScoreEvent } from "./score-event-editor";
import { MarketPreview } from "./market-preview";
import { TeamLogoInput } from "./team-logo-input";

async function readJson(res: Response) {
  return res.json().catch(() => null);
}

/** Default kickoff: 5 minutes from now, formatted for <input type="datetime-local">
 * (which expects local wall-clock time, no timezone/seconds). */
function defaultKickoffLocal(): string {
  const d = new Date(Date.now() + 5 * 60_000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MatchForm() {
  const router = useRouter();
  const sports = getSports();

  const [homeTeamName, setHomeTeamName] = useState("");
  const [awayTeamName, setAwayTeamName] = useState("");
  const [homeTeamLogoUrl, setHomeTeamLogoUrl] = useState("");
  const [awayTeamLogoUrl, setAwayTeamLogoUrl] = useState("");
  const [leagueName, setLeagueName] = useState("");
  const [sportSlug, setSportSlug] = useState("football");
  const [kickoffLocal, setKickoffLocal] = useState(defaultKickoffLocal);
  // Validated in the change handler (an event, not render) rather than
  // recomputed from Date.now() on every render — see the purity rule at
  // https://react.dev/reference/rules/components-and-hooks-must-be-idempotent.
  const [kickoffValid, setKickoffValid] = useState(true);
  const [events, setEvents] = useState<DraftScoreEvent[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  // Same seed the server will build these markets from — kept in sync so any
  // odds the admin hand-edits below can be sent as overrides that reuse the
  // exact same content-derived selection ids (see market-builder.ts).
  const [seed, setSeed] = useState(() => nanoid(12));
  const [marketOverrides, setMarketOverrides] = useState<Record<string, Array<[string, number]>>>({});
  const [isBusy, setIsBusy] = useState(false);
  const [isGeneratingNames, setIsGeneratingNames] = useState(false);

  function handleKickoffChange(value: string) {
    setKickoffLocal(value);
    setKickoffValid(value.length > 0 && new Date(value).getTime() > Date.now());
  }

  const canSubmit =
    homeTeamName.trim().length > 0 &&
    awayTeamName.trim().length > 0 &&
    homeTeamLogoUrl.trim().length > 0 &&
    awayTeamLogoUrl.trim().length > 0 &&
    leagueName.trim().length > 0 &&
    kickoffValid &&
    !isBusy;

  function generateMarkets() {
    const nextSeed = nanoid(12);
    setSeed(nextSeed);
    setMarkets(buildMarketsForFixture(nextSeed));
    setMarketOverrides({});
    toast.success("Markets generated with odds.");
  }

  function handleOddsChange(marketId: string, selectionId: string, nextOdds: number) {
    const market = markets.find((m) => m.id === marketId);
    if (!market) return;
    const nextSelections = market.selections.map((s) => (s.id === selectionId ? { ...s, odds: nextOdds } : s));
    setMarkets(markets.map((m) => (m.id === marketId ? { ...m, selections: nextSelections } : m)));
    // overrideMarkets() replaces a market's whole selection list from this
    // entry, so it must always carry every sibling selection — not just the
    // one just edited — or the others would silently disappear on save.
    setMarketOverrides({
      ...marketOverrides,
      [market.name]: nextSelections.map((s) => [s.label, s.odds] as [string, number]),
    });
  }

  async function autoFillTeams() {
    setIsGeneratingNames(true);
    try {
      const res = await fetch("/api/admin/fixtures/generate-names", { method: "POST" });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't generate names right now.");
        return;
      }
      setHomeTeamName(data.homeTeamName);
      setAwayTeamName(data.awayTeamName);
      setLeagueName(data.leagueName);
      toast.success("Teams and league auto-filled — edit anything you'd like before creating.");
    } finally {
      setIsGeneratingNames(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setIsBusy(true);
    try {
      const res = await fetch("/api/admin/fixtures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeTeamName: homeTeamName.trim(),
          awayTeamName: awayTeamName.trim(),
          homeTeamLogoUrl: homeTeamLogoUrl.trim(),
          awayTeamLogoUrl: awayTeamLogoUrl.trim(),
          leagueName: leagueName.trim(),
          sportSlug,
          kickoffAt: new Date(kickoffLocal).toISOString(),
          scheduledEvents: events,
          seed,
          marketOverrides: Object.keys(marketOverrides).length > 0 ? marketOverrides : undefined,
        }),
      });
      const data = await readJson(res);
      if (!res.ok) {
        toast.error(data?.error ?? "Couldn't create that match.");
        return;
      }
      toast.success("Match created — it goes live automatically at kick-off.");
      router.push(`/admin/matches/${data.fixture.id}`);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Auto-fill fictional team and league names, then edit anything you like before creating.
        </p>
        <Button type="button" variant="outline" size="sm" onClick={autoFillTeams} disabled={isGeneratingNames} className="w-fit shrink-0 gap-1.5">
          {isGeneratingNames ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          Auto-fill teams
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5">Home team</Label>
          <Input value={homeTeamName} onChange={(e) => setHomeTeamName(e.target.value)} placeholder="e.g. Accra Lions" />
        </div>
        <div>
          <Label className="mb-1.5">Away team</Label>
          <Input value={awayTeamName} onChange={(e) => setAwayTeamName(e.target.value)} placeholder="e.g. Kumasi Kings" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TeamLogoInput label="Home team" value={homeTeamLogoUrl} onChange={setHomeTeamLogoUrl} />
        <TeamLogoInput label="Away team" value={awayTeamLogoUrl} onChange={setAwayTeamLogoUrl} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5">League / competition</Label>
          <Input value={leagueName} onChange={(e) => setLeagueName(e.target.value)} placeholder="e.g. Premier Cup" />
        </div>
        <div>
          <Label className="mb-1.5">Sport</Label>
          <Select value={sportSlug} onValueChange={setSportSlug}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sports.map((s) => (
                <SelectItem key={s.slug} value={s.slug}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="mb-1.5">Kickoff date &amp; time</Label>
        <Input
          type="datetime-local"
          value={kickoffLocal}
          onChange={(e) => handleKickoffChange(e.target.value)}
          className="w-full sm:w-64"
        />
        {!kickoffValid && kickoffLocal.length > 0 && (
          <p className="mt-1 text-xs font-medium text-destructive">Kickoff must be in the future.</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          The match plays out in real time (90 real minutes) and goes live automatically the moment kickoff arrives.
        </p>
      </div>

      <ScoreEventEditor events={events} onChange={setEvents} homeName={homeTeamName} awayName={awayTeamName} />

      {/* Markets */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Label>Markets</Label>
            <p className="text-xs text-muted-foreground">
              1X2, Double Chance, BTTS, Draw No Bet, Over/Under, handicaps, Odd/Even and more — with auto-priced odds.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={generateMarkets} className="w-fit gap-1.5">
            {markets.length ? <RefreshCw className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {markets.length ? "Regenerate markets" : "Auto-generate markets"}
          </Button>
        </div>
        {markets.length > 0 && <MarketPreview markets={markets} onOddsChange={handleOddsChange} />}
      </div>

      <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        A full standard market set (1X2, Totals, BTTS, Double Chance, handicaps, Odd/Even and more) is generated and
        attached automatically on create. When kick-off is reached the match goes live in the players&apos; Live
        section, the clock runs, scheduled goals apply, and bets settle from the final score.
      </p>

      <Button type="submit" disabled={!canSubmit} className="h-11 w-full text-base sm:w-auto sm:self-start sm:px-8">
        {isBusy ? <Loader2 className="size-4 animate-spin" /> : "Create match"}
      </Button>
    </form>
  );
}
