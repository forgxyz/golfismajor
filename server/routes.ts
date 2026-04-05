import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { computeStandings, pointsForPosition, classifyEvent, isMajor, type EventCategory } from "./scoring";
import { fetchSchedule, fetchLeaderboard, autoDetectCurrentEvent, loadInitialFedexStandings, fetchFedexStandings } from "./pga";
import { seedIfNeeded } from "./seed";

export async function registerRoutes(httpServer: Server, app: Express) {
  // Boot: init DB tables, seed, then load live FedEx standings (fall back to hardcoded snapshot)
  await seedIfNeeded();
  const liveStandings = await fetchFedexStandings();
  if (!liveStandings.ok) {
    console.log("[boot] Live FedEx standings unavailable, using hardcoded snapshot");
    await loadInitialFedexStandings();
  }

  // ── Standings ──────────────────────────────────────────────
  app.get("/api/standings", async (_req, res) => {
    const mgrs = await storage.getAllManagers();
    const rosterRows = await storage.getAllRosters();
    const allTotals = await storage.getAllPlayerTotals();
    const totalsMap = new Map(allTotals.map(t => [t.playerName, { fedexPoints: t.fedexPoints, fedexRank: t.fedexRank }]));
    const standings = computeStandings(mgrs, rosterRows, totalsMap);
    res.json(standings);
  });

  // ── Current event summary ──────────────────────────────────
  app.get("/api/current-event", async (_req, res) => {
    const event = await storage.getCurrentEvent();
    if (!event) return res.json(null);

    const results = await storage.getResultsByEvent(event.id);
    const allRosters = await storage.getAllRosters();
    const mgrs = await storage.getAllManagers();

    const rosterMap = new Map<string, { managerId: string; managerName: string }>();
    for (const r of allRosters) {
      const mgr = mgrs.find(m => m.id === r.managerId);
      rosterMap.set(r.playerName.toLowerCase(), { managerId: r.managerId, managerName: mgr?.name ?? "" });
    }

    const allResults = results
      .sort((a, b) => (a.positionNum ?? 999) - (b.positionNum ?? 999))
      .map(r => {
        const roster = rosterMap.get(r.playerName.toLowerCase());
        const effectivePoints = r.pointsOverride ?? r.projectedPoints ?? 0;
        return { ...r, managerId: roster?.managerId ?? null, managerName: roster?.managerName ?? null, isRostered: !!roster, effectivePoints };
      });

    const managerMap = new Map<string, number>();
    for (const r of allResults) {
      if (r.managerId) managerMap.set(r.managerId, (managerMap.get(r.managerId) ?? 0) + r.effectivePoints);
    }

    const managerRollup = mgrs.map(m => ({
      managerId: m.id,
      managerName: m.name,
      projectedEventPoints: managerMap.get(m.id) ?? 0,
    })).sort((a, b) => b.projectedEventPoints - a.projectedEventPoints);

    res.json({ event, results: allResults, managerRollup });
  });

  // ── All events ─────────────────────────────────────────────
  app.get("/api/events", async (_req, res) => {
    const evts = (await storage.getAllEvents()).sort((a, b) => (a.startDate ?? "").localeCompare(b.startDate ?? ""));
    res.json(evts);
  });

  // ── Major payouts ──────────────────────────────────────────
  app.get("/api/major-payouts", async (_req, res) => {
    const payouts = await storage.getAllMajorPayouts();
    const mgrs = await storage.getAllManagers();

    const balances = new Map<string, number>();
    for (const m of mgrs) balances.set(m.id, 0);

    for (const p of payouts) {
      if (!p.triggered) continue;
      const losers = mgrs.filter(m => m.id !== p.managerId);
      if (p.managerId) balances.set(p.managerId, (balances.get(p.managerId) ?? 0) + p.payoutAmount);
      const perManager = parseFloat(await storage.getRule("major_payout_per_manager") ?? "50");
      for (const loser of losers) balances.set(loser.id, (balances.get(loser.id) ?? 0) - perManager);
    }

    const managerBalances = mgrs.map(m => ({ managerId: m.id, managerName: m.name, balance: balances.get(m.id) ?? 0 }));
    res.json({ payouts, managerBalances });
  });

  // ── League rules ───────────────────────────────────────────
  app.get("/api/rules", async (_req, res) => { res.json(await storage.getAllRules()); });

  app.post("/api/rules", async (req, res) => {
    const { key, value, description } = req.body;
    if (!key || !value) return res.status(400).json({ error: "key and value required" });
    await storage.upsertRule({ key, value, description });
    res.json({ ok: true });
  });

  // ── Aliases ────────────────────────────────────────────────
  app.get("/api/aliases", async (_req, res) => { res.json(await storage.getAllAliases()); });

  app.post("/api/aliases", async (req, res) => {
    const { apiName, canonicalName } = req.body;
    if (!apiName || !canonicalName) return res.status(400).json({ error: "apiName and canonicalName required" });
    await storage.upsertAlias({ apiName, canonicalName });
    res.json({ ok: true });
  });

  app.delete("/api/aliases/:id", async (req, res) => {
    await storage.deleteAlias(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // ── Player totals ──────────────────────────────────────────
  app.post("/api/player-totals", async (req, res) => {
    const { playerName, fedexPoints, fedexRank } = req.body;
    if (!playerName || fedexPoints === undefined) return res.status(400).json({ error: "playerName and fedexPoints required" });
    await storage.upsertPlayerTotals({ playerName, fedexPoints: parseFloat(fedexPoints), fedexRank: fedexRank ?? null, updatedAt: new Date().toISOString() });
    res.json({ ok: true });
  });

  app.get("/api/player-totals", async (_req, res) => { res.json(await storage.getAllPlayerTotals()); });

  // ── Refresh schedule (also auto-detects current event) ────
  app.post("/api/refresh/schedule", async (_req, res) => {
    const result = await autoDetectCurrentEvent();
    res.json(result);
  });

  // ── Refresh FedEx standings ───────────────────────────────
  app.post("/api/refresh/standings", async (_req, res) => {
    const result = await fetchFedexStandings();
    res.json(result);
  });

  // ── Refresh leaderboard ────────────────────────────────────
  app.post("/api/refresh/leaderboard", async (_req, res) => {
    const event = await storage.getCurrentEvent();
    if (!event) return res.status(400).json({ error: "No current event set" });
    const result = await fetchLeaderboard(event.id);
    res.json(result);
  });

  // ── Set current event ──────────────────────────────────────
  app.post("/api/events/:id/set-current", async (req, res) => {
    await storage.setCurrentEvent(req.params.id);
    res.json({ ok: true });
  });

  // ── Override event category ────────────────────────────────
  app.post("/api/events/:id/category", async (req, res) => {
    const { category } = req.body;
    await storage.updateEventCategory(req.params.id, category);
    res.json({ ok: true });
  });

  // ── Override player points ─────────────────────────────────
  app.post("/api/event-results/override", async (req, res) => {
    const { eventId, playerName, points } = req.body;
    if (!eventId || !playerName || points === undefined) return res.status(400).json({ error: "eventId, playerName, points required" });
    await storage.overridePlayerPoints(eventId, playerName, parseFloat(points));
    res.json({ ok: true });
  });

  // ── Major payout trigger ───────────────────────────────────
  app.post("/api/major-payouts/:id/trigger", async (req, res) => {
    const { winnerName } = req.body;
    if (!winnerName) return res.status(400).json({ error: "winnerName required" });

    const payouts = await storage.getAllMajorPayouts();
    const payout = payouts.find(p => p.id === parseInt(req.params.id));
    if (!payout) return res.status(404).json({ error: "Payout not found" });

    const allRosters = await storage.getAllRosters();
    const rosterEntry = allRosters.find(r => r.playerName.toLowerCase() === winnerName.toLowerCase());
    const managerId = rosterEntry?.managerId ?? null;

    await storage.upsertMajorPayout({ ...payout, winnerName, managerId, triggered: true });
    res.json({ ok: true, managerId, triggered: !!managerId });
  });

  // ── Rosters ────────────────────────────────────────────────
  app.get("/api/rosters", async (_req, res) => {
    const mgrs = await storage.getAllManagers();
    const allRosters = await storage.getAllRosters();
    const allTotals = await storage.getAllPlayerTotals();
    const totalsMap = new Map(allTotals.map(t => [t.playerName, t]));

    const result = mgrs.map(m => ({
      managerId: m.id,
      managerName: m.name,
      players: allRosters
        .filter(r => r.managerId === m.id)
        .map(r => ({ name: r.playerName, fedexPoints: totalsMap.get(r.playerName)?.fedexPoints ?? 0, fedexRank: totalsMap.get(r.playerName)?.fedexRank ?? null })),
    }));
    res.json(result);
  });

  // ── Weekly cron: refresh FedEx standings + auto-detect event
  // Mon 12:00 UTC
  app.get("/api/cron/weekly", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const [scheduleResult, standingsResult] = await Promise.all([
      autoDetectCurrentEvent(),
      fetchFedexStandings(),
    ]);
    console.log("[cron] Weekly refresh — schedule:", scheduleResult, "standings:", standingsResult);
    res.json({ schedule: scheduleResult, standings: standingsResult });
  });

  // ── Tournament cron: refresh live leaderboard ───────────────
  // Thu–Sun at 00:00 UTC, then hourly 11:00–23:00 UTC (7am–7pm EDT)
  app.get("/api/cron/refresh-leaderboard", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const event = await storage.getCurrentEvent();
    if (!event) {
      console.log("[cron] Leaderboard refresh skipped: no current event");
      return res.json({ ok: false, error: "No current event set" });
    }
    const result = await fetchLeaderboard(event.id);
    console.log("[cron] Leaderboard refresh:", result);
    res.json(result);
  });
}
