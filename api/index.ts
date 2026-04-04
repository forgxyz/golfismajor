import express from "express";
import { createServer } from "http";
import { registerRoutes } from "../server/routes";
import { initDb } from "../server/storage";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const httpServer = createServer(app);

const ready = (async () => {
  await initDb();
  await registerRoutes(httpServer, app);
})();

export default async function handler(req: any, res: any) {
  await ready;
  app(req, res);
}
