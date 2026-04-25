# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A fantasy golf league tracker for the 2026 PGA Tour season. Six managers each hold 5 players; only their top-3 FedExCup points earners count toward standings. Major tournament wins trigger cash side-pot payouts between managers. Live leaderboard data comes from ESPN; FedExCup standings from PGA Tour's GraphQL API; win-probability odds from Polymarket.

## Commands

```bash
bun run dev        # Start dev server (tsx server/index.ts, NODE_ENV=development)
bun run build      # Full production build (Vite client + esbuild server + Vercel output)
bun run start      # Run production build (dist/index.cjs)
bun run check      # TypeScript type-check only
bun run db:push    # Push schema changes to database (drizzle-kit)
```

No test suite — changes are validated by running the dev server and exercising routes manually or via Playwright.

## Architecture

**Single-repo, two runtimes:**
- `client/` — React 18 SPA built with Vite, routing via `wouter`, data fetching via TanStack Query, UI via shadcn/ui + Radix
- `server/` — Express 5 API server, runs locally with `tsx` and deploys as a Vercel serverless function via `api/_handler.ts`
- `shared/schema.ts` — Drizzle ORM schema + Zod types, imported by both server and client (via type imports only)

**Database:** libSQL (Turso in production via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`; local SQLite file `golf-league.db` in development). `storage.ts` exposes a typed `IStorage` interface — all DB access goes through `storage`, never direct `db` calls from routes.

**Data pipeline:**
1. `pga.ts` → `fetchSchedule()` pulls events from TheSportsDB (league 4425), classifies each by `scoring.ts:classifyEvent()`, upserts into `events` table
2. `pga.ts` → `fetchLeaderboard()` calls ESPN scoreboard API, recalculates tied positions from scores (ESPN's `c.order` is sequential, not tied), upserts `eventResults`
3. `pga.ts` → `fetchFedexStandings()` queries PGA Tour GraphQL for official FedExCup points; falls back to `FEDEX_STANDINGS_2026` hardcoded snapshot
4. `pga.ts` → `fetchPolymarketOdds()` searches Polymarket events/markets for win probability, tries multiple query forms (stripped name, full name, with/without year)
5. `scoring.ts` → `computeStandings()` aggregates top-3 player FedExCup points per manager to produce the league leaderboard

**Event category system:** Events are classified as `major | signature | full_field | additional | team_event | playoff_1 | playoff_2` — this determines the FedExCup points table applied. Category can be overridden manually via Admin page (`categoryOverride` column wins over auto-classify).

**Player name resolution:** ESPN, Polymarket, and PGA Tour APIs all use slightly different name formats. `player_aliases` table maps API names to canonical roster names. `storage.resolveAlias()` is called on every inbound player name.

**Seeding:** `seed.ts:seedIfNeeded()` runs at boot — inserts managers, rosters, rules, aliases, and 2026 major scaffold if `managers` table is empty. Safe to restart repeatedly.

**Vercel deployment:** `script/build.ts` produces Vercel Build Output API v3 format in `.vercel/output/`. Cron jobs are declared in the route config there (weekly schedule refresh Mon 12:00 UTC; leaderboard refresh Thu–Sun midnight UTC). `CRON_SECRET` env var guards cron endpoints.

## Key Files

| File | Purpose |
|------|---------|
| `server/routes.ts` | All API routes; thin — delegates to `storage` and `pga.ts` |
| `server/pga.ts` | External API clients (TheSportsDB, ESPN, PGA Tour GraphQL, Polymarket) |
| `server/scoring.ts` | FedExCup points tables and `computeStandings()` |
| `server/storage.ts` | DB init, `IStorage` interface, and the `storage` singleton |
| `server/seed.ts` | One-time league data seed (managers, rosters, rules, majors) |
| `shared/schema.ts` | Drizzle table definitions + Zod insert schemas |
| `client/src/pages/admin.tsx` | Admin controls: refresh schedule/leaderboard/odds, manage aliases, trigger major payouts, override categories/points |
| `api/_handler.ts` | Vercel serverless entrypoint (wraps the Express app) |
| `script/build.ts` | Build script: Vite + esbuild + Vercel output layout |

## Environment Variables

```
TURSO_DATABASE_URL   # Turso DB URL (omit for local SQLite)
TURSO_AUTH_TOKEN     # Turso auth token
CRON_SECRET          # Bearer token for cron route authorization
```
