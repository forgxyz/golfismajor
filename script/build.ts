import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile, mkdir, writeFile, cp } from "fs/promises";

// server deps to bundle to reduce openat(2) syscalls
// which helps cold start times
const allowlist = [
  "@google/generative-ai",
  "axios",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });
  await rm(".vercel/output", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });

  // ── Vercel Build Output API v3 ──────────────────────────────
  console.log("building Vercel output...");

  // Static files (Vite client build)
  await mkdir(".vercel/output/static", { recursive: true });
  await cp("dist/public", ".vercel/output/static", { recursive: true });

  // Serverless function — self-contained ESM bundle
  const funcDir = ".vercel/output/functions/api.func";
  await mkdir(funcDir, { recursive: true });

  await esbuild({
    entryPoints: ["api/_handler.ts"],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: `${funcDir}/index.mjs`,
    alias: {
      // Use the HTTP-only client for serverless (no native deps needed)
      "@libsql/client": "@libsql/client/web",
    },
    define: {
      "process.env.NODE_ENV": '"production"',
      "process.env.VERCEL": '"1"',
    },
    minify: true,
    logLevel: "info",
  });

  await writeFile(
    `${funcDir}/.vc-config.json`,
    JSON.stringify(
      { runtime: "nodejs20.x", handler: "index.mjs", launcherType: "Nodejs" },
      null,
      2,
    ),
  );

  // Route config
  await writeFile(
    ".vercel/output/config.json",
    JSON.stringify(
      {
        version: 3,
        routes: [
          { handle: "filesystem" },
          { src: "/api/.*", dest: "/api" },
          { src: "/.*", dest: "/index.html" },
        ],
        crons: [{ path: "/api/cron/weekly", schedule: "0 12 * * 1" }],
      },
      null,
      2,
    ),
  );

  console.log("Vercel output ready at .vercel/output/");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
