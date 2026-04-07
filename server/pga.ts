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
const PGATOUR_GRAPHQL = "https://orchestrator.pgatour.com/graphql";
const PGATOUR_API_KEY = "da2-gsrx5bibzbb4njvhl7t37wqyl4";

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

// Detect current event using only existing DB data — no external API calls.
// Used by leaderboard refresh so it avoids hitting TheSportsDB on every click.
export async function detectCurrentEventFromDB(): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const allEvents = await storage.getAllEvents();
    if (allEvents.length === 0) return { ok: false, error: "No events in database" };

    // 1. Active event: today falls within its dates
    let match = allEvents.find(e => e.startDate && e.endDate && e.startDate <= todayStr && todayStr <= e.endDate);

    // 2. Recently-ended event within 1 day (Monday recap window — Sun finish → Mon still shows it)
    if (!match) {
      const recent = allEvents
        .filter(e => e.endDate && e.endDate < todayStr)
        .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0];
      if (recent) {
        const daysDiff = (new Date(todayStr).getTime() - new Date(recent.endDate!).getTime()) / 86400000;
        if (daysDiff <= 1) match = recent;
      }
    }

    // 3. Next upcoming event within 7 days (covers week-to-week gaps; larger gaps mean no event or a bad schedule pull)
    if (!match) {
      const upcoming = allEvents
        .filter(e => e.startDate && e.startDate > todayStr)
        .sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))[0];
      if (upcoming) {
        const daysUntil = (new Date(upcoming.startDate!).getTime() - new Date(todayStr).getTime()) / 86400000;
        if (daysUntil <= 7) match = upcoming;
      }
    }

    if (!match) return { ok: false, error: "No active tournament found for today" };

    for (const ev of allEvents) {
      if (ev.isCurrent && ev.id !== match.id) await storage.upsertEvent({ ...ev, isCurrent: false });
    }
    await storage.upsertEvent({ ...match, isCurrent: true });

    console.log(`[pga] Detected current event (from DB): ${match.name}`);
    return { ok: true, name: match.name };
  } catch (e: any) {
    console.error("[pga] detectCurrentEventFromDB error:", e.message);
    return { ok: false, error: e.message };
  }
}

export async function autoDetectCurrentEvent(): Promise<{ ok: boolean; name?: string; count?: number; error?: string }> {
  try {
    const result = await fetchSchedule();
    if (!result.ok) return result as any;
    const detected = await detectCurrentEventFromDB();
    return { ...detected, count: result.count };
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
      await storage.upsertEvent({
        ...event,
        status: espnEvent.status?.type?.description ?? event.status,
        leaderboardFetchedAt: new Date().toISOString(),
      });
    }

    return { ok: true, count: competitors.length };
  } catch (e: any) {
    console.error("[pga] fetchLeaderboard error:", e.message);
    return { ok: false, error: e.message };
  }
}

const POLYMARKET_EVENTS = "https://gamma-api.polymarket.com/events";
const POLYMARKET_MARKETS = "https://gamma-api.polymarket.com/markets";
// Outcome labels that aren't real players
const ODDS_EXCLUDED = new Set(["other", "field", "the field", "any other player", "yes", "no"]);

// Build multiple search queries from a tournament name, shortest first
function polymarketQueries(name: string): string[] {
  const year = new Date().getFullYear();
  const stripped = name.replace(/\b(the|tournament|championship|invitational|classic)\b/gi, "").replace(/\s+/g, " ").trim();
  return [...new Set([`${stripped} ${year}`, `${name} ${year}`, stripped, name])].filter(Boolean);
}

// Pull player name out of "Will Scottie Scheffler win The Masters?" style questions
function extractPlayer(question: string): string | null {
  return (question.match(/^Will (.+?) win\b/i) ?? question.match(/^(.+?)\s+to win\b/i))?.[1]?.trim() ?? null;
}

export async function fetchPolymarketOdds(eventId: string, tournamentName: string) {
  try {
    // Load all aliases once — avoids N+1 DB calls (was ~50 queries, now 1)
    const allAliases = await storage.getAllAliases();
    const aliasMap = new Map(allAliases.map(a => [a.apiName.toLowerCase(), a.canonicalName]));
    const resolve = (name: string) => aliasMap.get(name.toLowerCase()) ?? name;

    const queries = polymarketQueries(tournamentName);
    console.log(`[polymarket] Starting odds fetch for "${tournamentName}". Queries: ${JSON.stringify(queries)}`);

    // ── Pass 1: /events endpoint (Polymarket groups per-player binary markets under an event) ──
    for (const q of queries) {
      const url = `${POLYMARKET_EVENTS}?search=${encodeURIComponent(q)}&limit=10&active=true`;
      console.log(`[polymarket] GET ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.warn(`[polymarket] Events API returned ${res.status} for "${q}"`); continue; }
      const evts: any[] = await res.json();
      console.log(`[polymarket] Events for "${q}": ${evts.length} — ${evts.slice(0, 5).map((e: any) => `"${e.title}"`).join(", ")}`);

      const evt = evts.filter((e: any) => !e.closed).sort((a: any, b: any) => parseFloat(b.volume ?? "0") - parseFloat(a.volume ?? "0"))[0];
      if (!evt) continue;
      console.log(`[polymarket] Selected event: "${evt.title}" slug="${evt.slug}" markets=${evt.markets?.length ?? 0} volume=$${parseFloat(evt.volume ?? "0").toFixed(0)}`);

      const playerOdds = new Map<string, number>();

      if (Array.isArray(evt.markets) && evt.markets.length > 0) {
        for (const m of evt.markets) {
          if (m.closed || !m.active || !m.outcomes || !m.outcomePrices) continue;
          const outcomes: string[] = JSON.parse(m.outcomes);
          const prices: string[] = JSON.parse(m.outcomePrices);

          // Binary YES/NO per-player market — extract name from question
          if (outcomes.length === 2 && outcomes[0]?.toLowerCase() === "yes") {
            const player = extractPlayer(m.question ?? "");
            if (!player) { console.warn(`[polymarket] Unparseable question: "${m.question}"`); continue; }
            const prob = parseFloat(prices[0] ?? "0");
            if (prob > 0) playerOdds.set(player, prob);
          } else {
            // Multi-outcome market nested inside the event
            for (let i = 0; i < outcomes.length; i++) {
              const name = outcomes[i];
              if (ODDS_EXCLUDED.has(name.toLowerCase())) continue;
              const prob = parseFloat(prices[i] ?? "0");
              if (prob > 0) playerOdds.set(name, prob);
            }
          }
        }
      }

      if (playerOdds.size === 0) { console.log(`[polymarket] Event found but no odds parsed — trying next query`); continue; }

      await storage.clearEventOdds(eventId);
      for (const [raw, probability] of playerOdds) {
        await storage.upsertEventOdds({ eventId, playerName: resolve(raw), probability, fetchedAt: new Date().toISOString() });
      }
      console.log(`[polymarket] Stored ${playerOdds.size} odds from event "${evt.title}"`);
      return { ok: true, count: playerOdds.size, marketQuestion: evt.title };
    }

    // ── Pass 2: /markets endpoint fallback (single multi-outcome market) ──
    for (const q of queries) {
      const url = `${POLYMARKET_MARKETS}?search=${encodeURIComponent(q)}&limit=15&active=true`;
      console.log(`[polymarket] Markets fallback GET ${url}`);
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { console.warn(`[polymarket] Markets API returned ${res.status} for "${q}"`); continue; }
      const markets: any[] = await res.json();
      const active = (Array.isArray(markets) ? markets : []).filter((m: any) => m.active && !m.closed && m.outcomes && m.outcomePrices);
      console.log(`[polymarket] Markets for "${q}": ${active.length} active — ${active.slice(0, 3).map((m: any) => `"${m.question}"`).join(", ")}`);
      if (active.length === 0) continue;

      const market = active.sort((a: any, b: any) => parseFloat(b.volume ?? "0") - parseFloat(a.volume ?? "0"))[0];
      const outcomes: string[] = JSON.parse(market.outcomes);
      const prices: string[] = JSON.parse(market.outcomePrices);
      console.log(`[polymarket] Using market: "${market.question}" ${outcomes.length} outcomes volume=$${parseFloat(market.volume ?? "0").toFixed(0)}`);

      await storage.clearEventOdds(eventId);
      let count = 0;
      for (let i = 0; i < outcomes.length; i++) {
        const name = outcomes[i] ?? "";
        if (ODDS_EXCLUDED.has(name.toLowerCase())) continue;
        const prob = parseFloat(prices[i] ?? "0");
        if (prob <= 0) continue;
        await storage.upsertEventOdds({ eventId, playerName: resolve(name), probability: prob, fetchedAt: new Date().toISOString() });
        count++;
      }
      console.log(`[polymarket] Stored ${count} odds from market "${market.question}"`);
      return { ok: true, count, marketQuestion: market.question };
    }

    console.log(`[polymarket] No usable market found for "${tournamentName}" — exhausted queries: ${JSON.stringify(queries)}`);
    return { ok: false, error: "No Polymarket market found for this event" };
  } catch (e: any) {
    console.error(`[polymarket] fetchPolymarketOdds error: ${e.message}`);
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

export async function fetchFedexStandings(): Promise<{ ok: boolean; updated?: number; error?: string }> {
  try {
    const res = await fetch(PGATOUR_GRAPHQL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": PGATOUR_API_KEY,
        "x-pgat-platform": "web",
      },
      body: JSON.stringify({
        operationName: "TourCupSplit",
        variables: { tourCode: "R", id: "02671", year: new Date().getFullYear() },
        query: `query TourCupSplit($tourCode: TourCode!, $id: String, $year: Int) {
          tourCupSplit(tourCode: $tourCode, id: $id, year: $year) {
            officialPlayers {
              ... on TourCupCombinedPlayer {
                id displayName
                pointData { official }
                rankingData { official }
              }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`PGA Tour API error: ${res.status}`);
    const data = await res.json();
    const players: any[] = data?.data?.tourCupSplit?.officialPlayers ?? [];
    if (!players.length) return { ok: false, error: "No players returned" };

    const now = new Date().toISOString();
    let updated = 0;
    for (const p of players) {
      if (!p?.displayName) continue;
      const pts = parseFloat(String(p.pointData?.official ?? "0").replace(/,/g, "")) || 0;
      const rank = parseInt(String(p.rankingData?.official ?? "0").replace(/,/g, "")) || null;
      // Only update players we have in our roster
      const existing = await storage.getPlayerTotals(p.displayName);
      if (existing) {
        await storage.upsertPlayerTotals({ playerName: p.displayName, fedexPoints: pts, fedexRank: rank, updatedAt: now });
        updated++;
      }
    }
    console.log(`[pga] FedEx standings updated: ${updated} rostered players`);
    return { ok: true, updated };
  } catch (e: any) {
    console.error("[pga] fetchFedexStandings error:", e.message);
    return { ok: false, error: e.message };
  }
}

export async function loadInitialFedexStandings() {
  const now = new Date().toISOString();
  for (const row of FEDEX_STANDINGS_2026) {
    const existing = await storage.getPlayerTotals(row.name);
    if (!existing || existing.fedexPoints === 0) {
      await storage.upsertPlayerTotals({ playerName: row.name, fedexPoints: row.points, fedexRank: row.rank, updatedAt: now });
    }
  }
}
