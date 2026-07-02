import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { Socket } from "node:net";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const appDir = join(root, "src", "app");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");

const nextArgs = ["dev", ...normalizeArgs(process.argv.slice(2))];
const { port, hostname } = getDevAddress(nextArgs);
const baseUrl = `http://${hostname}:${port}`;
const warmupTimeoutMs = Number(process.env.NEXT_DEV_WARMUP_TIMEOUT_MS ?? 120000);
const routeTimeoutMs = Number(process.env.NEXT_DEV_ROUTE_WARMUP_TIMEOUT_MS ?? 20000);

let warmed = false;
let shutDown = false;

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: root,
  env: process.env,
  shell: false,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(chunk);
  maybeWarmRoutes(text);
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(chunk);
  maybeWarmRoutes(text);
});

child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shutDown) return;
    shutDown = true;
    child.kill(signal);
  });
}

function maybeWarmRoutes(output) {
  if (warmed || !/(ready|started server|localhost|network)/i.test(output)) return;
  warmed = true;
  warmRoutes().catch((error) => {
    console.warn(`[dev-warmup] ${error instanceof Error ? error.message : error}`);
  });
}

async function warmRoutes() {
  await waitForServer();
  const routes = await discoverRoutes(appDir);

  if (routes.length === 0) return;

  console.log(`[dev-warmup] Precompiling ${routes.length} route${routes.length === 1 ? "" : "s"}...`);

  const started = Date.now();
  for (const route of routes) {
    const url = new URL(route, baseUrl);
    url.searchParams.set("__dev_warmup", "1");

    try {
      await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(routeTimeoutMs),
      });
    } catch (error) {
      console.warn(`[dev-warmup] ${route}: ${error instanceof Error ? error.message : error}`);
    }
  }

  console.log(`[dev-warmup] Route precompile finished in ${Date.now() - started}ms.`);
}

async function discoverRoutes(dir) {
  if (!existsSync(dir)) return [];

  const routes = new Set();

  async function walk(currentDir) {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name.startsWith("_") || entry.name === "node_modules") continue;
        await walk(fullPath);
        continue;
      }

      if (!/^(page|route)\.(js|jsx|ts|tsx)$/.test(entry.name)) continue;

      const routeDir = dirname(fullPath);
      routes.add(toWarmupPath(routeDir));
    }
  }

  await walk(dir);
  return [...routes].sort((a, b) => a.localeCompare(b));
}

function toWarmupPath(routeDir) {
  const rel = relative(appDir, routeDir);
  if (!rel) return "/";

  const parts = rel.split(sep)
    .filter((part) => part && !part.startsWith("("))
    .map((part) => {
      if (/^\[\.\.\..+\]$/.test(part)) return "dev-warmup";
      if (/^\[\[.+\]\]$/.test(part)) return "dev-warmup";
      if (/^\[.+\]$/.test(part)) return "dev-warmup";
      return part;
    });

  return `/${parts.join("/")}`;
}

async function waitForServer() {
  const started = Date.now();

  while (Date.now() - started < warmupTimeoutMs) {
    try {
      await canConnect(hostname, Number(port));
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw new Error(`Timed out waiting for ${baseUrl}`);
}

function canConnect(host, serverPort) {
  return new Promise((resolve, reject) => {
    const socket = new Socket();
    socket.setTimeout(1000);
    socket.once("connect", () => {
      socket.destroy();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("Timed out"));
    });
    socket.once("error", reject);
    socket.connect(serverPort, host);
  });
}

function getDevAddress(args) {
  let port = process.env.PORT ?? "3000";
  let hostname = process.env.HOSTNAME ?? "localhost";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = args[i + 1];

    if ((arg === "-p" || arg === "--port") && next) port = next;
    if (arg.startsWith("--port=")) port = arg.slice("--port=".length);
    if ((arg === "-H" || arg === "--hostname") && next) hostname = next;
    if (arg.startsWith("--hostname=")) hostname = arg.slice("--hostname=".length);
  }

  if (hostname === "0.0.0.0" || hostname === "::") hostname = "localhost";

  return { port, hostname };
}

function normalizeArgs(args) {
  if (args.length === 1 && /^\d+$/.test(args[0])) {
    return ["--port", args[0]];
  }

  return args;
}
