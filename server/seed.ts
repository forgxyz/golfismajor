/**
 * Seed initial league data (managers, rosters, rules, aliases, major scaffold)
 * Run once at startup if data is missing.
 */
import { storage } from "./storage";

const ROSTER_DATA = [
  { id: "jack", name: "Jack Forgash", players: ["Akshay Bhatia", "Collin Morikawa", "Justin Thomas", "Jon Rahm", "Viktor Hovland"] },
  { id: "michael", name: "Michael Nolan", players: ["Maverick McNealy", "Daniel Berger", "Shane Lowry", "Corey Conners", "Scottie Scheffler"] },
  { id: "matthew", name: "Matthew Donnelly", players: ["Robert MacIntyre", "Justin Rose", "J.J. Spaun", "Tommy Fleetwood", "Xander Schauffele"] },
  { id: "sean", name: "Sean Maguire", players: ["Sam Burns", "Brian Harman", "Tyrrell Hatton", "Bryson DeChambeau", "Chris Gotterup"] },
  { id: "ben", name: "Ben Newman", players: ["Hideki Matsuyama", "Min Woo Lee", "Jacob Bridgeman", "Jake Knapp", "Ludvig Åberg"] },
  { id: "peter", name: "Peter Rustowicz", players: ["Sepp Straka", "Rory McIlroy", "Matt Fitzpatrick", "Ben Griffin", "Cameron Young"] },
];

const ALIAS_DATA = [
  { apiName: "Ludvig Aberg", canonicalName: "Ludvig Åberg" },
  { apiName: "J.J. Spaun", canonicalName: "J.J. Spaun" },
  { apiName: "Min Woo Lee", canonicalName: "Min Woo Lee" },
  { apiName: "JJ Spaun", canonicalName: "J.J. Spaun" },
  { apiName: "Akshay Bhatia", canonicalName: "Akshay Bhatia" },
];

// 2026 majors scaffold — IDs must match the slug format used by fetchSchedule
const MAJORS_2026 = [
  { id: "masters-tournament", name: "Masters Tournament", season: 2026, startDate: "2026-04-09" },
  { id: "pga-championship", name: "PGA Championship", season: 2026, startDate: "2026-05-14" },
  { id: "u-s-open", name: "U.S. Open", season: 2026, startDate: "2026-06-18" },
  { id: "the-open-championship", name: "The Open Championship", season: 2026, startDate: "2026-07-16" },
];

const RULES_DATA = [
  { key: "side_pot_payout", value: "250", description: "Dollar amount paid by each other manager when a rostered player wins a major" },
  { key: "counted_players", value: "3", description: "Number of top players per manager counted toward standings" },
  { key: "total_players", value: "5", description: "Total players per manager roster" },
  { key: "season_year", value: "2026", description: "Current league season year" },
  { key: "major_payout_per_manager", value: "50", description: "Amount each losing manager pays on a major win" },
];

export async function seedIfNeeded() {
  const existingManagers = await storage.getAllManagers();
  if (existingManagers.length > 0) return; // Already seeded

  console.log("[seed] Seeding league data...");

  for (const m of ROSTER_DATA) {
    await storage.upsertManager({ id: m.id, name: m.name });
    for (const player of m.players) {
      await storage.upsertRosterEntry({ managerId: m.id, playerName: player });
      await storage.upsertPlayerTotals({ playerName: player, fedexPoints: 0, fedexRank: null, updatedAt: null });
    }
  }

  for (const a of ALIAS_DATA) {
    await storage.upsertAlias(a);
  }

  for (const r of RULES_DATA) {
    await storage.upsertRule(r);
  }

  for (const major of MAJORS_2026) {
    await storage.upsertMajorPayout({
      eventId: major.id,
      eventName: major.name,
      season: major.season,
      winnerName: null,
      managerId: null,
      payoutAmount: 250,
      triggered: false,
    });
    await storage.upsertEvent({
      id: major.id,
      name: major.name,
      startDate: major.startDate,
      endDate: null,
      venue: null,
      status: "scheduled",
      round: null,
      eventCategory: "major",
      isMajor: true,
      isCurrent: false,
      categoryOverride: null,
    });
  }

  console.log("[seed] Done.");
}
