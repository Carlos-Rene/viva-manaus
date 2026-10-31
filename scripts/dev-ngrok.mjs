import { spawn, spawnSync } from "node:child_process";
import { open, readFile, unlink } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const previewPort = 4173;
const inspectorPort = 4040;
const lockPath = path.join(
  os.tmpdir(),
  `viva-dev-ngrok-${process.getuid?.() ?? "user"}.lock`,
);
const children = new Set();
let lockHandle;
let interruptedBy;

process.chdir(projectRoot);

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(ALLOWED_ORIGINS|NGROK_DOMAIN)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2]
      .replace(/^(['"])(.*)\1$/, "$2")
      .split(/\s+#/)[0]
      .trim();
  }
  return values;
}

async function loadProjectEnv() {
  try {
    return parseEnv(await readFile(path.join(projectRoot, ".env"), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return {};
    throw error;
  }
}

function assertNotInterrupted() {
  if (interruptedBy) {
    const error = new Error(`Received ${interruptedBy}.`);
    error.code = "INTERRUPTED";
    throw error;
  }
}

async function acquireLock() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      lockHandle = await open(lockPath, "wx", 0o600);
      await lockHandle.writeFile(`${process.pid}\n`);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      let existingLock;
      try {
        existingLock = await readFile(lockPath, "utf8");
      } catch (readError) {
        if (readError.code === "ENOENT") continue;
        throw readError;
      }
      const existingPid = Number(existingLock.trim());
      let isRunning = Number.isSafeInteger(existingPid) && existingPid > 0;
      if (isRunning) {
        try {
          process.kill(existingPid, 0);
        } catch (signalError) {
          if (signalError.code === "ESRCH") isRunning = false;
          else if (signalError.code !== "EPERM") throw signalError;
        }
      }
      if (isRunning) {
        throw new Error("Another Viva ngrok launcher is already running.");
      }
      if ((await readFile(lockPath, "utf8")) === existingLock) {
        await unlink(lockPath);
      }
    }
  }
  throw new Error("Could not acquire the Viva ngrok launcher lock.");
}

async function releaseLock() {
  if (!lockHandle) return;
  await lockHandle.close();
  lockHandle = undefined;
  try {
    if ((await readFile(lockPath, "utf8")) === `${process.pid}\n`)
      await unlink(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function normalizeDomain(value) {
  if (!value) return undefined;
  const url = new URL(value.includes("://") ? value : `https://${value}`);
  if (
    url.protocol !== "https:" ||
    !url.hostname.includes(".") ||
    url.username ||
    url.password ||
    url.port ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash
  ) {
    throw new Error("NGROK_DOMAIN must be a hostname or HTTPS origin, without a path.");
  }
  return url.origin;
}

function verifyNgrok() {
  const version = spawnSync("ngrok", ["version"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (version.error?.code === "ENOENT") {
    throw new Error("ngrok is not installed or is not available on PATH.");
  }
  if (version.status !== 0) throw new Error("Could not run ngrok version.");

  const config = spawnSync("ngrok", ["config", "check"], {
    encoding: "utf8",
    timeout: 10_000,
  });
  if (config.error || config.status !== 0) {
    throw new Error("ngrok configuration is invalid. Run `ngrok config check` to diagnose it.");
  }
  const output = `${config.stdout}\n${config.stderr}`;
  const configPath = /Valid configuration file at (.+)\s*$/.exec(output)?.[1];
  if (!configPath) {
    throw new Error("Could not locate the active ngrok configuration file.");
  }
  return readFile(configPath.trim(), "utf8").then((contents) => {
    const tokenLine = /^\s*authtoken\s*:\s*(.*?)\s*(?:#.*)?$/m.exec(contents);
    const token = tokenLine?.[1].replace(/^(['"])(.*)\1$/, "$2").trim();
    if (!token) {
      throw new Error(
        "ngrok authentication is not configured. Run `ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN`.",
      );
    }
  });
}

async function assertPortAvailable(port, name) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(
          new Error(
            `${name} port ${port} is already in use. Stop that service explicitly before starting this launcher.`,
          ),
        );
      } else {
        reject(error);
      }
    });
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
}

function startChild(command, args, label, env = process.env) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
  });
  const tracked = { child, label, closed: false, result: undefined };
  tracked.closedPromise = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      tracked.closed = true;
      tracked.result = { code, signal };
      resolve(tracked.result);
    });
  });
  child.once("error", (error) => {
    tracked.spawnError = error;
  });
  children.add(tracked);
  return tracked;
}

function assertChildRunning(tracked) {
  assertNotInterrupted();
  if (tracked.spawnError) throw tracked.spawnError;
  if (tracked.closed) {
    throw new Error(
      `${tracked.label} exited unexpectedly (code ${tracked.result.code ?? "none"}, signal ${tracked.result.signal ?? "none"}).`,
    );
  }
}

async function waitForPreview(preview) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    assertChildRunning(preview);
    try {
      const response = await fetch(`http://127.0.0.1:${previewPort}/`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.status < 500) return;
    } catch {
      assertChildRunning(preview);
    }
    await sleep(250);
  }
  throw new Error(`Viva did not respond on 127.0.0.1:${previewPort} within 20 seconds.`);
}

async function getTunnelUrl(tunnel) {
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    assertChildRunning(tunnel);
    try {
      const response = await fetch(`http://127.0.0.1:${inspectorPort}/api/tunnels`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) {
        const data = await response.json();
        const endpoint = data.tunnels?.find(
          (item) => item.proto === "https" && item.public_url,
        );
        if (endpoint) {
          const url = new URL(endpoint.public_url);
          if (url.protocol !== "https:") {
            throw new Error("ngrok returned a non-HTTPS public endpoint.");
          }
          return url.origin;
        }
      }
    } catch (error) {
      if (error.message.includes("non-HTTPS")) throw error;
      assertChildRunning(tunnel);
    }
    await sleep(400);
  }
  throw new Error("ngrok did not provide a public HTTPS URL within 45 seconds.");
}

async function stopChild(tracked) {
  if (!tracked || tracked.closed) {
    if (tracked) children.delete(tracked);
    return;
  }
  tracked.child.kill("SIGTERM");
  let timeout;
  const result = await Promise.race([
    tracked.closedPromise.then(() => true),
    new Promise((resolve) => {
      timeout = setTimeout(() => resolve(false), 5_000);
    }),
  ]);
  clearTimeout(timeout);
  if (!result && !tracked.closed) {
    tracked.child.kill("SIGKILL");
    let forceTimeout;
    await Promise.race([
      tracked.closedPromise,
      new Promise((resolve) => {
        forceTimeout = setTimeout(resolve, 2_000);
      }),
    ]);
    clearTimeout(forceTimeout);
  }
  children.delete(tracked);
}

async function stopChildren() {
  for (const tracked of [...children].reverse()) await stopChild(tracked);
}

function originList(existing, publicOrigin) {
  return [
    ...new Set(
      [...(existing || "").split(","), publicOrigin]
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  ].join(",");
}

async function main() {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    throw new Error("Viva requires Node.js 20 or newer.");
  }
  await acquireLock();
  const fileEnv = await loadProjectEnv();
  const existingOrigins =
    process.env.ALLOWED_ORIGINS || fileEnv.ALLOWED_ORIGINS || "";
  const staticOrigin = normalizeDomain(
    process.env.NGROK_DOMAIN || fileEnv.NGROK_DOMAIN || "",
  );
  await verifyNgrok();
  await assertPortAvailable(previewPort, "Viva preview");
  await assertPortAvailable(inspectorPort, "ngrok inspector");

  const previewEnv = {
    ...process.env,
    VIVA_PREVIEW_PORT: String(previewPort),
    ...(staticOrigin
      ? { ALLOWED_ORIGINS: originList(existingOrigins, staticOrigin) }
      : {}),
  };
  let preview = startChild(
    process.execPath,
    ["scripts/preview-worker.mjs"],
    "Viva preview",
    previewEnv,
  );
  await waitForPreview(preview);

  const ngrokArgs = ["http", `http://127.0.0.1:${previewPort}`];
  if (staticOrigin) ngrokArgs.push("--url", staticOrigin);
  const tunnel = startChild("ngrok", ngrokArgs, "ngrok");
  const publicOrigin = await getTunnelUrl(tunnel);
  if (staticOrigin && publicOrigin !== staticOrigin) {
    throw new Error(
      `ngrok returned ${publicOrigin}, but NGROK_DOMAIN is configured as ${staticOrigin}.`,
    );
  }

  if (!staticOrigin) {
    await stopChild(preview);
    preview = startChild(
      process.execPath,
      ["scripts/preview-worker.mjs"],
      "Viva preview",
      {
        ...process.env,
        VIVA_PREVIEW_PORT: String(previewPort),
        ALLOWED_ORIGINS: originList(existingOrigins, publicOrigin),
      },
    );
    await waitForPreview(preview);
  }

  console.log(`Viva is available at ${publicOrigin}`);
  console.log("Press Ctrl+C to stop the Viva preview and ngrok tunnel.");
  await new Promise((resolve, reject) => {
    const check = () => {
      if (interruptedBy) {
        resolve();
        return;
      }
      try {
        assertChildRunning(preview);
        assertChildRunning(tunnel);
      } catch (error) {
        reject(error);
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
  if (interruptedBy) {
    const error = new Error(`Received ${interruptedBy}.`);
    error.code = "INTERRUPTED";
    throw error;
  }
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!interruptedBy) interruptedBy = signal;
  });
}

try {
  await main();
} catch (error) {
  if (error.code !== "INTERRUPTED") {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    process.exitCode = interruptedBy === "SIGINT" ? 130 : 143;
  }
} finally {
  await stopChildren();
  await releaseLock();
}
