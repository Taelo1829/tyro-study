import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

export async function findAvailablePort(startPort = 4000) {
  if (!Number.isInteger(startPort) || startPort < 4000 || startPort > 65535) {
    throw new Error("Choose a port between 4000 and 65535.");
  }
  for (let port = startPort; port <= 65535; port++) {
    const available = await new Promise((resolve, reject) => {
      const server = createServer();
      server.once("error", (error) => {
        if (error.code === "EADDRINUSE" || error.code === "EACCES") resolve(false);
        else reject(error);
      });
      server.listen({ port, exclusive: true }, () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw new Error("No available port at or above the requested port.");
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode !== "dev" && mode !== "start") throw new Error("Expected dev or start.");
  let requestedPort = process.env.PORT || "4000";
  const forwarded = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--port" || args[i] === "-p") requestedPort = args[++i];
    else if (args[i].startsWith("--port=")) requestedPort = args[i].slice(7);
    else forwarded.push(args[i]);
  }
  const port = await findAvailablePort(Number(requestedPort));
  console.log(`[Tyro] Starting on http://localhost:${port}`);
  const require = createRequire(import.meta.url);
  const child = spawn(process.execPath, [require.resolve("next/dist/bin/next"), mode, ...forwarded, "--port", String(port)], {
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
  }
  child.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = code ?? (signal ? 1 : 0);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
