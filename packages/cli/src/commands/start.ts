import { defineCommand } from "citty";
import { spawn } from "node:child_process";

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

async function waitForServer(url: string, timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

export const startCommand = defineCommand({
  meta: {
    name: "start",
    description: "Start the opaque vault server and open the dashboard",
  },
  args: {
    port: {
      type: "string",
      description: "Port to listen on (default: 4200)",
      default: "",
    },
    "no-open": {
      type: "boolean",
      description: "Skip opening the dashboard in the browser",
      default: false,
    },
  },
  async run({ args }) {
    const port = (args.port as string) || process.env.OPAQUE_PORT || "4200";
    const shouldOpen = !(args["no-open"] as boolean);

    // Resolve server entry — look for the monorepo layout first, fall back to dist
    const serverEntry = "apps/server/src/index.ts";

    const server = spawn("bun", ["run", "--hot", serverEntry], {
      stdio: "inherit",
      env: { ...process.env, OPAQUE_PORT: port },
    });

    server.on("error", (err) => {
      console.error(`opaque: failed to start server — ${err.message}`);
      console.error("Make sure you are running this command from the opaque monorepo root.");
      process.exit(1);
    });

    server.on("exit", (code) => {
      process.exit(code ?? 0);
    });

    process.on("SIGINT", () => server.kill("SIGINT"));
    process.on("SIGTERM", () => server.kill("SIGTERM"));

    if (shouldOpen) {
      const uiUrl = `http://localhost:${port}/ui`;
      const ready = await waitForServer(`http://localhost:${port}/health`);
      if (ready) {
        openBrowser(uiUrl);
      } else {
        console.warn(`opaque: server did not respond in time — open ${uiUrl} manually`);
      }
    }

    // Keep the process alive (server subprocess drives the lifecycle)
    await new Promise(() => {});
  },
});
