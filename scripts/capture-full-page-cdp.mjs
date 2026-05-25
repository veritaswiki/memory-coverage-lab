import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const [url, widthArg, heightArg, outputPath] = process.argv.slice(2);
const width = Number(widthArg);
const height = Number(heightArg);
const hardTimeoutMs = Number(process.env.CDP_CAPTURE_TIMEOUT_MS ?? 90_000);

if (!url || !Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(hardTimeoutMs) || !outputPath) {
  console.error("Usage: node scripts/capture-full-page-cdp.mjs <url> <width> <height> <outputPath>");
  process.exit(2);
}

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
];
const chrome = chromeCandidates.find((path) => existsSync(path));

if (!chrome) {
  console.error("No Chrome-compatible browser found for full-page CDP screenshot capture");
  process.exit(2);
}

const port = 43000 + Math.floor(Math.random() * 2000);
const userDataDir = await mkdtemp(join(tmpdir(), "memorybench-cdp-"));
const browser = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${userDataDir}`,
  `--window-size=${width},${height}`,
  "about:blank",
], {
  stdio: ["ignore", "ignore", "pipe"],
});
const hardTimeout = setTimeout(() => {
  console.error(`Full-page CDP screenshot timed out after ${hardTimeoutMs}ms`);
  browser.kill("SIGKILL");
  process.exit(124);
}, hardTimeoutMs);
hardTimeout.unref?.();

let stderr = "";
let client = null;
browser.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

try {
  await waitForDevTools(port);
  const page = await createPage(port);
  client = await connectCdp(page.webSocketDebuggerUrl);

  await send(client, "Page.enable");
  await send(client, "Runtime.enable");
  await send(client, "Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 480,
  });
  await navigateAndWait(client, url);
  await send(client, "Runtime.evaluate", {
    expression: "document.fonts?.ready",
    awaitPromise: true,
  });
  await send(client, "Runtime.evaluate", {
    expression: "new Promise(resolve => setTimeout(resolve, 1600))",
    awaitPromise: true,
  });
  const metrics = await send(client, "Runtime.evaluate", {
    expression: `(() => ({
      scrollWidth: Math.ceil(document.documentElement.scrollWidth),
      scrollHeight: Math.ceil(document.documentElement.scrollHeight),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    }))()`,
    returnByValue: true,
  });
  const value = metrics.result?.result?.value ?? {};
  const captureWidth = Math.max(width, Number(value.scrollWidth) || width);
  const captureHeight = Math.max(height + 1, Number(value.scrollHeight) || height + 1);
  const screenshot = await send(client, "Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: captureWidth,
      height: captureHeight,
      scale: 1,
    },
  }, 120_000);

  await writeFile(outputPath, Buffer.from(screenshot.result.data, "base64"));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  if (stderr.trim()) {
    console.error(stderr.trim().split("\n").slice(-6).join("\n"));
  }
  process.exitCode = 1;
} finally {
  clearTimeout(hardTimeout);
  client?.close?.();
  await terminateBrowser(browser);
  try {
    await rm(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  } catch {
    // Temporary Chrome profile cleanup is best-effort; screenshot validity is independent of this directory.
  }
}

async function waitForDevTools(portToCheck) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 10_000) {
    try {
      const response = await fetch(`http://127.0.0.1:${portToCheck}/json/version`);
      if (response.ok) {
        return;
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }

  throw new Error(`Timed out waiting for Chrome DevTools on port ${portToCheck}`);
}

async function createPage(portToUse) {
  const response = await fetch(`http://127.0.0.1:${portToUse}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(`Failed to create CDP page: HTTP ${response.status}`);
  }

  return response.json();
}

async function connectCdp(urlToConnect) {
  const socket = new WebSocket(urlToConnect);
  const pending = new Map();
  let nextId = 1;

  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) {
      return;
    }
    const { resolve, reject, timeout } = pending.get(message.id);
    clearTimeout(timeout);
    pending.delete(message.id);

    if (message.error) {
      reject(new Error(`${message.error.message}${message.error.data ? `: ${message.error.data}` : ""}`));
    } else {
      resolve(message);
    }
  });

  return {
    send(method, params = {}, timeoutMs = 30_000) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    waitForEvent(method, timeoutMs = 30_000) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.removeEventListener("message", onMessage);
          reject(new Error(`CDP event timed out: ${method}`));
        }, timeoutMs);
        const onMessage = (event) => {
          const message = JSON.parse(event.data);
          if (message.method !== method) {
            return;
          }
          clearTimeout(timeout);
          socket.removeEventListener("message", onMessage);
          resolve(message);
        };
        socket.addEventListener("message", onMessage);
      });
    },
    close() {
      socket.close();
    },
  };
}

function send(client, method, params = {}, timeoutMs = 30_000) {
  return client.send(method, params, timeoutMs);
}

async function navigateAndWait(client, destination) {
  const loaded = client.waitForEvent("Page.loadEventFired", 45_000);
  await send(client, "Page.navigate", { url: destination }, 30_000);
  await loaded;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function terminateBrowser(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  child.kill("SIGTERM");
  const closed = await Promise.race([
    new Promise((resolve) => child.once("close", () => resolve(true))),
    delay(1500).then(() => false),
  ]);

  if (!closed && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await Promise.race([
      new Promise((resolve) => child.once("close", resolve)),
      delay(500),
    ]);
  }
}
