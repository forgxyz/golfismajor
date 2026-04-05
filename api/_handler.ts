import { app, ready } from "../server/index";

module.exports = async function handler(req: any, res: any) {
  await ready;
  app(req, res);
};
