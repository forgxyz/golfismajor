/**
 * TheSportsDB API client + ESPN live leaderboard
 * TheSportsDB league ID 4425 = PGA Tour
 * ESPN golf scoreboard: site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard
 */
import { storage } from "./storage";
import { classifyEvent, isMajor, pointsForPosition, type EventCategory } from "./scoring";

const SPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const PGA_LEAGUE_ID = "4425";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard";

async function sportsdbFetch(endpoint: string) {
  const url = `${SPORTSDB_BASE}${endpoint}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`TheSportsDB error: ${res.status}`);
  return res.json();
}

function tournamentName(strEvent: string): string {
  return strEvent.replace(/\s+(Round\s+\d+|Final Round|Day\s+\d+)$/i, "").trim();
}

function tournamentSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function fetchSchedule() {
  try {
    const [pastData, nextData] = await Promise.all([
      sportsdbFetch(`/eventspastleague.php?id=${PGA_LEAGUE_ID}`),
      sportsdbFetch(`/eventsnextleague.php?id=${PGA_LEAGUE_ID}`),
    ]);

    const allRaw = [...(pastData?.events ?? []), ...(nextData?.events ?? [])];
    if (allRaw.length === 0) return { ok: false, error: "No events returned" };

    const tourneyMap = new Map<string, { name: string; slug: string; dates: string[]; venue: string; status: string }>();
    for (const ev of allRaw) {
      const name = tournamentName(ev.strEvent ?? "");
      const slug = tournamentSlug(name);
      if (!tourneyMap.has(slug)) {
        tourneyMap.set(slug, { name, slug, dates: [], venue: ev.strVenue ?? "", status: ev.strStatus ?? "" });
      }
      const entry = tourneyMap.get(slug)!;
      entry.dates.push(ev.dateEvent);
      if (ev.strStatus && !entry.status) entry.status = ev.strStatus;
    }

    const allEvents = await storage.getAllEvents();
    let count = 0;
    for (const t of tourneyMap.values()) {
      const sorted = t.dates.sort();
      const existing = allEvents.find(e => e.id === t.slug);
      await storage.upsertEvent({
        id: t.slug,
        name: t.name,
        startDate: sorted[0],
        endDate: sorted[sorted.length - 1],
        venue: t.venue,
        status: t.status || "scheduled",
        round: null,
        eventCategory: existing?.categoryOverride ?? classifyEvent(t.name),
        isMajor: isMajor(t.name),
        isCurrent: existing?.isCurrent ?? false,
        categoryOverride: existing?.categoryOverride ?? null,
      });
      count++;
    }
    return { ok: true, count };
  } catch (e: any) {
    console.error("[pga] fetchSchedule error:", e.message);
    return { ok: false, error: e.message };
  }
}

export async function autoDetectCurrentEvent(): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const result = await fetchSchedule();
    if (!result.ok) return result as any;

    const todayStr = new Date().toISOString().slice(0, 10);
    const allEvents = await storage.getAllEvents();

    let match = allEvents.find(e => e.startDate && e.endDate && e.startDate <= todayStr && todayStr <= e.endDate);

    if (!match) {
      const recent = allEvents
        .filter(e => e.endDate && e.endDate < todayStr)
        .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0];
      if (recent) {
        const daysDiff = (new Date(todayStr).getTime() - new Date(recent.endDate!).getTime()) / 86400000;
        if (daysDiff <= 2) match = recent;
      }
    }

    if (!match) return { ok: false, error: "No active tournament found for today" };

    for (const ev of allEvents) {
      if (ev.isCurrent && ev.id !== match.id) await storage.upsertEvent({ ...ev, isCurrent: false });
    }
    await storage.upsertEvent({ ...match, isCurrent: true });

    console.log(`[pga] Auto-detected current event: ${match.name}`);
    return { ok: true, name: match.name };
  } catch (e: any) {
    console.error("[pga] autoDetectCurrentEvent error:", e.message);
    return { ok: false, error: e.message };
  }
}

export async function fetchLeaderboard(eventId: string) {
  try {
    const res = await fetch(ESPN_SCOREBOARD, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`ESPN error: ${res.status}`);
    const data = await res.json();

    const espnEvents: any[] = data?.events ?? [];
    if (espnEvents.length === 0) return { ok: false, error: "No active ESPN event" };

    const event = await storage.getCurrentEvent();
    const eventName = event?.name?.toLowerCase() ?? "";
    const espnEvent = espnEvents.find(e =>
      e.name?.toLowerCase().includes(eventName.split(" ")[0].toLowerCase())
    ) ?? espnEvents[0];

    const competitors: any[] = espnEvent?.competitions?.[0]?.competitors ?? [];
    if (competitors.length === 0) return { ok: false, error: "No competitors in ESPN response" };

    const cat = (event?.categoryOverride ?? event?.eventCategory ?? "full_field") as EventCategory;
    await storage.clearEventResults(eventId);

    // Recalculate tied positions from scores (ESPN c.order is sequential, not tied)
    const parseScore = (s: string | undefined): number => {
      if (!s || s === "E") return 0;
      return parseInt(s) || 0;
    };

    // Sort by score (ascending = better), then assign tied position numbers
    const sorted = [...competitors].sort((a, b) => parseScore(a.score) - parseScore(b.score));
    const tiedPos = new Map<string, number>();
    let pos = 1;
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && parseScore(sorted[i].score) !== parseScore(sorted[i - 1].score)) {
        pos = i + 1;
      }
      tiedPos.set(sorted[i].athlete?.displayName ?? "", pos);
    }

    for (const c of competitors) {
      const rawName: string = c.athlete?.displayName ?? "";
      const resolvedName = await storage.resolveAlias(rawName);
      const position = tiedPos.get(rawName) ?? c.order ?? 999;
      await storage.upsertEventResult({
        eventId,
        playerName: resolvedName,
        position: String(position),
        positionNum: position,
        score: c.score ?? "E",
        roundScore: null,
        status: "active",
        projectedPoints: pointsForPosition(cat, position),
        finalPoints: null,
        pointsOverride: null,
      });
    }

    if (event) {
      await storage.upsertEvent({ ...event, status: espnEvent.status?.type?.description ?? event.status });
    }

    return { ok: true, count: competitors.length };
  } catch (e: any) {
    console.error("[pga] fetchLeaderboard error:", e.message);
    return { ok: false, error: e.message };
  }
}

const FEDEX_STANDINGS_2026 = [
  { name: "Jacob Bridgeman", points: 1452, rank: 1 },
  { name: "Cameron Young", points: 1323, rank: 2 },
  { name: "Matt Fitzpatrick", points: 1229, rank: 3 },
  { name: "Akshay Bhatia", points: 1224, rank: 4 },
  { name: "Chris Gotterup", points: 1219, rank: 5 },
  { name: "Collin Morikawa", points: 1182, rank: 6 },
  { name: "Scottie Scheffler", points: 1131, rank: 7 },
  { name: "Min Woo Lee", points: 944, rank: 8 },
  { name: "Jake Knapp", points: 769, rank: 9 },
  { name: "Xander Schauffele", points: 741, rank: 10 },
  { name: "Sepp Straka", points: 722, rank: 11 },
  { name: "Tommy Fleetwood", points: 702, rank: 12 },
  { name: "Ludvig Åberg", points: 685, rank: 13 },
  { name: "Justin Rose", points: 601, rank: 14 },
  { name: "Hideki Matsuyama", points: 650, rank: 15 },
  { name: "Robert MacIntyre", points: 572, rank: 16 },
  { name: "Daniel Berger", points: 577, rank: 17 },
  { name: "Brian Harman", points: 227, rank: 18 },
  { name: "Justin Thomas", points: 222, rank: 19 },
  { name: "Corey Conners", points: 220, rank: 20 },
  { name: "Viktor Hovland", points: 268, rank: 21 },
  { name: "Maverick McNealy", points: 312, rank: 22 },
  { name: "Rory McIlroy", points: 476, rank: 23 },
  { name: "Ben Griffin", points: 168, rank: 24 },
  { name: "J.J. Spaun", points: 0, rank: 50 },
  { name: "Shane Lowry", points: 158, rank: 60 },
  { name: "Jon Rahm", points: 0, rank: 100 },
  { name: "Sam Burns", points: 38, rank: 100 },
  { name: "Tyrrell Hatton", points: 0, rank: 100 },
  { name: "Bryson DeChambeau", points: 0, rank: 100 },
];

export async function loadInitialFedexStandings() {
  const now = new Date().toISOString();
  for (const row of FEDEX_STANDINGS_2026) {
    const existing = await storage.getPlayerTotals(row.name);
    if (!existing || existing.fedexPoints === 0) {
      await storage.upsertPlayerTotals({ playerName: row.name, fedexPoints: row.points, fedexRank: row.rank, updatedAt: now });
    }
  }
}
