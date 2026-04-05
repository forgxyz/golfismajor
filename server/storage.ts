import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../shared/schema";
import { eq, and } from "drizzle-orm";
import {
  managers, rosters, playerTotals, events, eventResults, majorPayouts, playerAliases, leagueRules,
  type Manager, type Roster, type PlayerTotals, type Event, type EventResult,
  type MajorPayout, type PlayerAlias, type LeagueRules,
  type InsertManager, type InsertRoster, type InsertPlayerTotals, type InsertEvent,
  type InsertEventResult, type InsertMajorPayout, type InsertPlayerAlias, type InsertLeagueRules,
} from "../shared/schema";

// Use Turso in production, local SQLite file in development
const client = createClient(
  process.env.TURSO_DATABASE_URL
    ? { url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN }
    : { url: "file:golf-league.db" }
);

export const db = drizzle(client, { schema });

// Create tables (libSQL batch — runs DDL idempotently)
export async function initDb() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS managers (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rosters (id INTEGER PRIMARY KEY AUTOINCREMENT, manager_id TEXT NOT NULL, player_name TEXT NOT NULL, UNIQUE(manager_id, player_name));
    CREATE TABLE IF NOT EXISTS player_totals (player_name TEXT PRIMARY KEY, fedex_points REAL NOT NULL DEFAULT 0, fedex_rank INTEGER, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, name TEXT NOT NULL, start_date TEXT, end_date TEXT, venue TEXT, status TEXT, round INTEGER, event_category TEXT NOT NULL DEFAULT 'full_field', is_major INTEGER NOT NULL DEFAULT 0, is_current INTEGER NOT NULL DEFAULT 0, category_override TEXT);
    CREATE TABLE IF NOT EXISTS event_results (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, player_name TEXT NOT NULL, position TEXT, position_num INTEGER, score TEXT, round_score TEXT, status TEXT, projected_points REAL, final_points REAL, points_override REAL);
    CREATE TABLE IF NOT EXISTS major_payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL, event_name TEXT NOT NULL, season INTEGER NOT NULL, winner_name TEXT, manager_id TEXT, payout_amount REAL NOT NULL DEFAULT 250, triggered INTEGER NOT NULL DEFAULT 0, UNIQUE(event_id, season));
    CREATE TABLE IF NOT EXISTS player_aliases (id INTEGER PRIMARY KEY AUTOINCREMENT, api_name TEXT NOT NULL UNIQUE, canonical_name TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS league_rules (key TEXT PRIMARY KEY, value TEXT NOT NULL, description TEXT);
  `);

  // Name fixes
  await client.execute(`UPDATE managers SET name = 'Matt Donnelly' WHERE id = 'matthew'`);
  await client.execute(`UPDATE managers SET name = 'Pete Rustowicz' WHERE id = 'peter'`);

  // Dedup roster and major_payout entries (fixes existing data from race-condition double-seeds)
  await client.execute(
    `DELETE FROM rosters WHERE id NOT IN (SELECT MIN(id) FROM rosters GROUP BY manager_id, player_name)`
  );
  await client.execute(
    `DELETE FROM major_payouts WHERE id NOT IN (SELECT MIN(id) FROM major_payouts GROUP BY event_id, season)`
  );
}

export interface IStorage {
  // Managers
  getAllManagers(): Promise<Manager[]>;
  upsertManager(m: InsertManager): Promise<Manager>;
  // Rosters
  getAllRosters(): Promise<Roster[]>;
  getRosterByManager(managerId: string): Promise<Roster[]>;
  upsertRosterEntry(r: InsertRoster): Promise<void>;
  clearRosters(): Promise<void>;
  // Player Totals
  getAllPlayerTotals(): Promise<PlayerTotals[]>;
  upsertPlayerTotals(p: InsertPlayerTotals): Promise<void>;
  getPlayerTotals(name: string): Promise<PlayerTotals | undefined>;
  // Events
  getAllEvents(): Promise<Event[]>;
  getCurrentEvent(): Promise<Event | undefined>;
  upsertEvent(e: InsertEvent): Promise<void>;
  setCurrentEvent(id: string): Promise<void>;
  updateEventCategory(id: string, category: string): Promise<void>;
  // Event Results
  getResultsByEvent(eventId: string): Promise<EventResult[]>;
  upsertEventResult(r: InsertEventResult): Promise<void>;
  clearEventResults(eventId: string): Promise<void>;
  overridePlayerPoints(eventId: string, playerName: string, points: number): Promise<void>;
  // Major Payouts
  getAllMajorPayouts(): Promise<MajorPayout[]>;
  upsertMajorPayout(p: InsertMajorPayout): Promise<void>;
  // Player Aliases
  getAllAliases(): Promise<PlayerAlias[]>;
  upsertAlias(a: InsertPlayerAlias): Promise<void>;
  deleteAlias(id: number): Promise<void>;
  resolveAlias(apiName: string): Promise<string>;
  // League Rules
  getAllRules(): Promise<LeagueRules[]>;
  upsertRule(r: InsertLeagueRules): Promise<void>;
  getRule(key: string): Promise<string | undefined>;
}

export const storage: IStorage = {
  async getAllManagers() { return db.select().from(managers).all(); },
  async upsertManager(m) {
    return db.insert(managers).values(m).onConflictDoUpdate({ target: managers.id, set: { name: m.name } }).returning().get() as Promise<Manager>;
  },

  async getAllRosters() { return db.select().from(rosters).all(); },
  async getRosterByManager(managerId) { return db.select().from(rosters).where(eq(rosters.managerId, managerId)).all(); },
  async upsertRosterEntry(r) { await db.insert(rosters).values(r).onConflictDoNothing().run(); },
  async clearRosters() { await db.delete(rosters).run(); },

  async getAllPlayerTotals() { return db.select().from(playerTotals).all(); },
  async upsertPlayerTotals(p) {
    await db.insert(playerTotals).values(p).onConflictDoUpdate({
      target: playerTotals.playerName,
      set: { fedexPoints: p.fedexPoints, fedexRank: p.fedexRank, updatedAt: p.updatedAt }
    }).run();
  },
  async getPlayerTotals(name) { return db.select().from(playerTotals).where(eq(playerTotals.playerName, name)).get(); },

  async getAllEvents() { return db.select().from(events).all(); },
  async getCurrentEvent() { return db.select().from(events).where(eq(events.isCurrent, true)).get(); },
  async upsertEvent(e) {
    await db.insert(events).values(e).onConflictDoUpdate({
      target: events.id,
      set: { name: e.name, startDate: e.startDate, endDate: e.endDate, venue: e.venue, status: e.status, round: e.round, eventCategory: e.eventCategory, isMajor: e.isMajor, isCurrent: e.isCurrent, categoryOverride: e.categoryOverride }
    }).run();
  },
  async setCurrentEvent(id) {
    await db.update(events).set({ isCurrent: false }).run();
    await db.update(events).set({ isCurrent: true }).where(eq(events.id, id)).run();
  },
  async updateEventCategory(id, category) {
    await db.update(events).set({ eventCategory: category, categoryOverride: category }).where(eq(events.id, id)).run();
  },

  async getResultsByEvent(eventId) { return db.select().from(eventResults).where(eq(eventResults.eventId, eventId)).all(); },
  async upsertEventResult(r) { await db.insert(eventResults).values(r).onConflictDoNothing().run(); },
  async clearEventResults(eventId) { await db.delete(eventResults).where(eq(eventResults.eventId, eventId)).run(); },
  async overridePlayerPoints(eventId, playerName, points) {
    await db.update(eventResults).set({ pointsOverride: points }).where(
      and(eq(eventResults.eventId, eventId), eq(eventResults.playerName, playerName))
    ).run();
  },

  async getAllMajorPayouts() { return db.select().from(majorPayouts).all(); },
  async upsertMajorPayout(p) { await db.insert(majorPayouts).values(p).onConflictDoNothing().run(); },

  async getAllAliases() { return db.select().from(playerAliases).all(); },
  async upsertAlias(a) {
    await db.insert(playerAliases).values(a).onConflictDoUpdate({
      target: playerAliases.apiName,
      set: { canonicalName: a.canonicalName }
    }).run();
  },
  async deleteAlias(id) { await db.delete(playerAliases).where(eq(playerAliases.id, id)).run(); },
  async resolveAlias(apiName) {
    const row = await db.select().from(playerAliases).where(eq(playerAliases.apiName, apiName)).get();
    return row ? row.canonicalName : apiName;
  },

  async getAllRules() { return db.select().from(leagueRules).all(); },
  async upsertRule(r) {
    await db.insert(leagueRules).values(r).onConflictDoUpdate({
      target: leagueRules.key,
      set: { value: r.value, description: r.description }
    }).run();
  },
  async getRule(key) {
    const row = await db.select().from(leagueRules).where(eq(leagueRules.key, key)).get();
    return row?.value;
  },
};
