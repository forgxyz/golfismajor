import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---- Managers ----
export const managers = sqliteTable("managers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
export const insertManagerSchema = createInsertSchema(managers);
export type InsertManager = z.infer<typeof insertManagerSchema>;
export type Manager = typeof managers.$inferSelect;

// ---- Rosters ----
export const rosters = sqliteTable("rosters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  managerId: text("manager_id").notNull(),
  playerName: text("player_name").notNull(),
});
export const insertRosterSchema = createInsertSchema(rosters).omit({ id: true });
export type InsertRoster = z.infer<typeof insertRosterSchema>;
export type Roster = typeof rosters.$inferSelect;

// ---- Player Season Totals (cached from PGA TOUR) ----
export const playerTotals = sqliteTable("player_totals", {
  playerName: text("player_name").primaryKey(),
  fedexPoints: real("fedex_points").notNull().default(0),
  fedexRank: integer("fedex_rank"),
  updatedAt: text("updated_at"),
});
export const insertPlayerTotalsSchema = createInsertSchema(playerTotals);
export type InsertPlayerTotals = z.infer<typeof insertPlayerTotalsSchema>;
export type PlayerTotals = typeof playerTotals.$inferSelect;

// ---- Events (tournaments) ----
export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  startDate: text("start_date"),
  endDate: text("end_date"),
  venue: text("venue"),
  status: text("status"), // scheduled | live | final
  round: integer("round"),
  eventCategory: text("event_category").notNull().default("full_field"), // major | signature | full_field | additional | team_event | playoff
  isMajor: integer("is_major", { mode: "boolean" }).notNull().default(false),
  isCurrent: integer("is_current", { mode: "boolean" }).notNull().default(false),
  categoryOverride: text("category_override"), // manual override
});
export const insertEventSchema = createInsertSchema(events);
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type Event = typeof events.$inferSelect;

// ---- Event Results (leaderboard rows) ----
export const eventResults = sqliteTable("event_results", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull(),
  playerName: text("player_name").notNull(),
  position: text("position"), // "1", "T2", "CUT" etc.
  positionNum: integer("position_num"), // numeric for sorting
  score: text("score"), // relative to par e.g. "-5"
  roundScore: text("round_score"),
  status: text("status"), // active | cut | wd | dq
  projectedPoints: real("projected_points"),
  finalPoints: real("final_points"),
  pointsOverride: real("points_override"), // manual override
});
export const insertEventResultSchema = createInsertSchema(eventResults).omit({ id: true });
export type InsertEventResult = z.infer<typeof insertEventResultSchema>;
export type EventResult = typeof eventResults.$inferSelect;

// ---- Major Payouts ----
export const majorPayouts = sqliteTable("major_payouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventId: text("event_id").notNull(),
  eventName: text("event_name").notNull(),
  season: integer("season").notNull(),
  winnerName: text("winner_name"),
  managerId: text("manager_id"), // null if winner not rostered
  payoutAmount: real("payout_amount").notNull().default(250),
  triggered: integer("triggered", { mode: "boolean" }).notNull().default(false),
});
export const insertMajorPayoutSchema = createInsertSchema(majorPayouts).omit({ id: true });
export type InsertMajorPayout = z.infer<typeof insertMajorPayoutSchema>;
export type MajorPayout = typeof majorPayouts.$inferSelect;

// ---- Player Aliases (name mapping) ----
export const playerAliases = sqliteTable("player_aliases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiName: text("api_name").notNull().unique(),
  canonicalName: text("canonical_name").notNull(),
});
export const insertPlayerAliasSchema = createInsertSchema(playerAliases).omit({ id: true });
export type InsertPlayerAlias = z.infer<typeof insertPlayerAliasSchema>;
export type PlayerAlias = typeof playerAliases.$inferSelect;

// ---- League Rules (editable config) ----
export const leagueRules = sqliteTable("league_rules", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  description: text("description"),
});
export const insertLeagueRulesSchema = createInsertSchema(leagueRules);
export type InsertLeagueRules = z.infer<typeof insertLeagueRulesSchema>;
export type LeagueRules = typeof leagueRules.$inferSelect;
