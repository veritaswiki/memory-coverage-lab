import { createHash } from "node:crypto";
import { closeSync, existsSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join } from "node:path";

const defaultBrowserClientPath =
  "/Users/lux/.codex/plugins/cache/openai-bundled/browser/26.519.41501/scripts/browser-client.mjs";
const browserPluginRoot = "/Users/lux/.codex/plugins/cache/openai-bundled/browser";
const browserClientPath = process.env.CODEX_BROWSER_CLIENT ?? findBrowserClientPath();
const browseBin = process.env.BROWSE_BIN ?? "/Users/lux/gstack/browse/dist/browse";
const targetUrl = process.env.QA_URL ?? "http://localhost:5179/";
const codexConfigPath = "/Users/lux/.codex/config.toml";

const findings = [];
const failures = [];
const browseLockPath = "/tmp/memory-coverage-lab-gstack-browse.lock";

function addFinding(label, value) {
  findings.push({ label, value });
}

function findingValue(label) {
  return findings.find((finding) => finding.label === label)?.value;
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: options.timeout ?? 15_000,
  }).trim();
}

function findBrowserClientPath() {
  if (existsSync(defaultBrowserClientPath)) {
    return defaultBrowserClientPath;
  }

  if (!existsSync(browserPluginRoot)) {
    return defaultBrowserClientPath;
  }

  return readdirSync(browserPluginRoot)
    .map((entry) => join(browserPluginRoot, entry, "scripts/browser-client.mjs"))
    .filter((path) => existsSync(path))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? defaultBrowserClientPath;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function browseLockOwnerAlive() {
  let pid = 0;

  try {
    pid = Number(readFileSync(browseLockPath, "utf8").split(/\s+/)[0]);
  } catch {
    return false;
  }

  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function acquireBrowseLock() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      const fd = openSync(browseLockPath, "wx");
      writeFileSync(fd, `${process.pid}\n${new Date().toISOString()}\n`);
      closeSync(fd);
      return () => {
        try {
          rmSync(browseLockPath);
        } catch {
          // Another process may already have cleaned up a stale lock.
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") {
        failures.push(`Failed to acquire gstack browse lock: ${error instanceof Error ? error.message : String(error)}`);
        return () => {};
      }

      try {
        if (!browseLockOwnerAlive() || Date.now() - statSync(browseLockPath).mtimeMs > 120_000) {
          rmSync(browseLockPath);
          continue;
        }
      } catch {
        // Retry if the lock disappeared between stat and removal.
      }

      sleep(250);
    }
  }

  failures.push(`Timed out waiting for gstack browse lock: ${browseLockPath}`);
  return () => {};
}

function listTmpBrowserSignals(root = "/tmp", maxDepth = 3) {
  const matches = [];

  function walk(dir, depth) {
    if (depth > maxDepth) {
      return;
    }

    let entries = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const path = join(dir, entry);
      const lower = entry.toLowerCase();

      if (
        (lower.includes("codex") && lower.includes("browser")) ||
        lower.includes("iab") ||
        (lower.includes("browser") && lower.includes("socket"))
      ) {
        matches.push(path);
      }

      try {
        if (statSync(path).isDirectory()) {
          walk(path, depth + 1);
        }
      } catch {
        // Ignore transient temp entries.
      }
    }
  }

  walk(root, 0);
  return matches;
}

function listCodexBrowserSockets(root = "/tmp/codex-browser-use") {
  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root)
    .map((entry) => join(root, entry))
    .filter((path) => {
      try {
        return statSync(path).isSocket();
      } catch {
        return false;
      }
    });
}

function codexBrowserSocketStats(sockets) {
  if (sockets.length === 0) {
    return null;
  }

  const now = Date.now();
  const ages = sockets
    .map((path) => {
      try {
        return Math.max(0, Math.round((now - statSync(path).mtimeMs) / 1000));
      } catch {
        return null;
      }
    })
    .filter((age) => age !== null)
    .sort((a, b) => a - b);

  if (ages.length === 0) {
    return null;
  }

  return {
    newestAgeSeconds: ages[0],
    oldestAgeSeconds: ages[ages.length - 1],
  };
}

function codexBrowserSocketAgeBuckets(sockets) {
  const now = Date.now();
  const buckets = {
    freshUnder5m: 0,
    warmUnder1h: 0,
    staleOver1h: 0,
  };

  for (const path of sockets) {
    try {
      const ageSeconds = Math.max(0, Math.round((now - statSync(path).mtimeMs) / 1000));

      if (ageSeconds <= 300) {
        buckets.freshUnder5m += 1;
      } else if (ageSeconds <= 3600) {
        buckets.warmUnder1h += 1;
      } else {
        buckets.staleOver1h += 1;
      }
    } catch {
      // Ignore transient socket entries.
    }
  }

  return buckets;
}

function codexBrowserSocketFreshness(socketCount, buckets) {
  if (socketCount === 0) {
    return "no-sockets";
  }

  if (buckets.freshUnder5m > 0) {
    return "fresh-under-5m-present";
  }

  if (buckets.warmUnder1h > 0) {
    return "warm-under-1h-present";
  }

  if (buckets.staleOver1h === socketCount) {
    return "all-stale-over-1h";
  }

  return "mixed-or-unknown";
}

function codexBrowserSocketFingerprint(sockets) {
  return createHash("sha256")
    .update(sockets.map((path) => basename(path)).sort().join("\n"))
    .digest("hex");
}

function codexBrowserSocketOwners(root = "/tmp/codex-browser-use") {
  let output = "";
  try {
    output = run("lsof", ["-nP", "-U"], { timeout: 10_000 });
  } catch {
    return { openCount: 0, owners: [] };
  }

  const ownerMap = new Map();
  let openCount = 0;

  for (const line of output.split("\n")) {
    if (!line.includes(root)) {
      continue;
    }

    openCount += 1;
    const match = line.trim().match(/^(\S+)\s+(\d+)\s+/);
    if (!match) {
      continue;
    }

    const key = `${match[1]}:${match[2]}`;
    ownerMap.set(key, (ownerMap.get(key) ?? 0) + 1);
  }

  return {
    openCount,
    owners: [...ownerMap.entries()].map(([owner, count]) => `${owner}(${count})`),
  };
}

function browserClientHash() {
  return createHash("sha256").update(readFileSync(browserClientPath)).digest("hex");
}

function trustedBrowserHashes() {
  if (!existsSync(codexConfigPath)) {
    return [];
  }

  const config = readFileSync(codexConfigPath, "utf8");
  const match = config.match(/NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S\s*=\s*"([^"]*)"/);
  return match?.[1]?.split(",").map((hash) => hash.trim()).filter(Boolean) ?? [];
}

if (!existsSync(browserClientPath)) {
  failures.push(`Bundled Browser client is missing: ${browserClientPath}`);
} else {
  addFinding("browserClient", browserClientPath);
  const browserClientSource = readFileSync(browserClientPath, "utf8");
  const currentBrowserClientHash = browserClientHash();
  const trustedHashes = trustedBrowserHashes();
  addFinding("browserClientSha256", currentBrowserClientHash);
  addFinding(
    "browserClientIabSessionFilter",
    browserClientSource.includes("metadata?.codexSessionId") &&
      browserClientSource.includes('filter(o=>o.info.type==="iab")')
      ? "present"
      : "not found",
  );
  addFinding(
    "browserClientRequiresSessionParams",
    browserClientSource.includes("Missing required browser session_id") &&
      browserClientSource.includes("Missing required browser turn_id")
      ? "present"
      : "not found",
  );
  addFinding(
    "browserClientDiscoveryFailureReasons",
    ["missing-session-metadata", "no-iab-backends", "no-session-match"]
      .filter((reason) => browserClientSource.includes(reason))
      .join(", ") || "not found",
  );
  addFinding(
    "browserClientTrustedHash",
    trustedHashes.includes(currentBrowserClientHash) ? "matches config" : "missing from config",
  );

  if (!trustedHashes.includes(currentBrowserClientHash)) {
    failures.push("Bundled Browser client hash is not present in NODE_REPL_TRUSTED_BROWSER_CLIENT_SHA256S");
  }

  try {
    const shellImport = run(
      "node",
      [
        "--input-type=module",
        "-e",
        `const mod = await import(${JSON.stringify(browserClientPath)});
const timeout = new Promise((resolve) => setTimeout(() => resolve("setup-timeout"), 3000));
const setup = mod.setupBrowserRuntime({ globals: globalThis })
  .then(() => "setup-ok")
  .catch((error) => String(error?.message || error));
console.log(await Promise.race([setup, timeout]));`,
      ],
      { timeout: 5_000 },
    );
    addFinding("browserClientShellImport", shellImport.split("\n").at(-1) ?? shellImport);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    addFinding(
      "browserClientShellImport",
      message.includes("ETIMEDOUT")
        ? "setup-timeout in ordinary shell"
        : `unavailable from ordinary shell: ${message.split("\n")[0]}`,
    );
  }
}

const processOutput = run("ps", ["aux"]);
const hasCodexAppServer = processOutput.includes("codex app-server");
const hasNodeRepl = processOutput.includes("node_repl");
addFinding("codexAppServer", hasCodexAppServer ? "present" : "missing");
addFinding("nodeRepl", hasNodeRepl ? "present" : "missing");

if (!hasCodexAppServer) {
  failures.push("Codex app-server process is not running");
}

if (!hasNodeRepl) {
  failures.push("Node REPL process is not running; official Browser plugin runtime checks are unavailable");
}

const tmpSignals = listTmpBrowserSignals();
const codexBrowserSockets = listCodexBrowserSockets();
const socketStats = codexBrowserSocketStats(codexBrowserSockets);
const socketAgeBuckets = codexBrowserSocketAgeBuckets(codexBrowserSockets);
const socketFreshness = codexBrowserSocketFreshness(codexBrowserSockets.length, socketAgeBuckets);
const socketOwners = codexBrowserSocketOwners();
addFinding("tmpBrowserSignals", String(tmpSignals.length));
addFinding("codexBrowserSocketCount", String(codexBrowserSockets.length));
addFinding("codexBrowserSocketOpenCount", String(socketOwners.openCount));
addFinding("codexBrowserSocketFingerprintSha256", codexBrowserSocketFingerprint(codexBrowserSockets));
addFinding(
  "codexBrowserSocketAgeBuckets",
  `freshUnder5m=${socketAgeBuckets.freshUnder5m}, warmUnder1h=${socketAgeBuckets.warmUnder1h}, staleOver1h=${socketAgeBuckets.staleOver1h}`,
);
addFinding("codexBrowserSocketFreshness", socketFreshness);

if (socketStats) {
  addFinding(
    "codexBrowserSocketAgeSeconds",
    `newest=${socketStats.newestAgeSeconds}, oldest=${socketStats.oldestAgeSeconds}`,
  );
}

if (socketOwners.owners.length > 0) {
  addFinding("codexBrowserSocketOwners", socketOwners.owners.slice(0, 8).join(", "));
}

if (tmpSignals.length > 0) {
  addFinding("tmpBrowserSignalPaths", tmpSignals.slice(0, 12).join(", "));
}

if (codexBrowserSockets.length > 0) {
  addFinding("codexBrowserSocketPaths", codexBrowserSockets.slice(0, 12).join(", "));
}

if (!existsSync(browseBin)) {
  failures.push(`gstack browse fallback is missing: ${browseBin}`);
} else {
  addFinding("gstackBrowse", browseBin);
  const releaseBrowseLock = acquireBrowseLock();

  try {
    const status = run(browseBin, ["status"]);
    addFinding("gstackBrowseStatus", status.split("\n")[0] ?? status);
  } catch (error) {
    failures.push(`gstack browse status failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    run(browseBin, ["goto", targetUrl], { timeout: 30_000 });
    run(browseBin, ["wait", "--load"]);
    addFinding("fallbackTarget", targetUrl);
    const smokeOutput = run(
      browseBin,
      [
        "js",
        `JSON.stringify({
          title: document.title,
          finalUrl: location.href,
          h1: document.querySelector("h1")?.getAttribute("aria-label") ??
            document.querySelector("h1")?.textContent?.trim() ??
            null,
          mainCount: document.querySelectorAll("main").length
        })`,
      ],
      { timeout: 15_000 },
    );
    const smoke = JSON.parse(smokeOutput);
    const smokeOk =
      typeof smoke.finalUrl === "string" &&
      smoke.finalUrl.startsWith(targetUrl) &&
      typeof smoke.h1 === "string" &&
      smoke.h1.includes("When AI agents remember") &&
      smoke.mainCount === 1;
    addFinding(
      "fallbackTargetSmoke",
      JSON.stringify({
        ok: smokeOk,
        finalUrl: smoke.finalUrl ?? null,
        title: smoke.title ?? null,
        h1: smoke.h1 ?? null,
        mainCount: smoke.mainCount ?? null,
      }),
    );

    if (!smokeOk) {
      failures.push(
        `gstack browse fallback loaded ${targetUrl} but did not prove MemoryBench page identity: ${JSON.stringify(smoke)}`,
      );
    }
  } catch (error) {
    failures.push(`gstack browse fallback could not load ${targetUrl}: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    releaseBrowseLock();
  }
}

function buildDiagnosis() {
  const browserClientTrustedHash = findingValue("browserClientTrustedHash");
  const codexAppServer = findingValue("codexAppServer");
  const nodeRepl = findingValue("nodeRepl");
  const socketCount = Number(findingValue("codexBrowserSocketCount") ?? 0);
  const socketOpenCount = Number(findingValue("codexBrowserSocketOpenCount") ?? 0);
  const socketOwners = findingValue("codexBrowserSocketOwners") ?? "";
  const socketFreshness = findingValue("codexBrowserSocketFreshness") ?? "";
  const gstackBrowseStatus = findingValue("gstackBrowseStatus") ?? "";
  const fallbackTarget = findingValue("fallbackTarget") ?? "";

  if (failures.length > 0) {
    return {
      classification: "browser-runtime-prerequisite-failed",
      summary: "One or more shell-verifiable Browser runtime prerequisites failed.",
      nextAction: "Fix the listed failures before attempting official IAB registration again.",
    };
  }

  if (
    browserClientTrustedHash === "matches config" &&
    codexAppServer === "present" &&
    nodeRepl === "present" &&
    socketCount > 0 &&
    socketOpenCount > 0 &&
    socketOwners.includes("Codex:") &&
    gstackBrowseStatus.startsWith("Status: healthy") &&
    fallbackTarget
  ) {
    if (socketFreshness === "all-stale-over-1h") {
      return {
        classification: "stale-codex-browser-sockets-iab-unverified",
        summary:
          "Codex still owns Browser socket files, but every observed socket is older than one hour. Fallback browsing works, yet the stale socket set is not strong evidence that the current thread has a live official IAB backend.",
        nextAction:
          "Verify official availability inside the Browser plugin runtime with agent.browsers.list() and agent.browsers.get('iab'); if it still lists zero IAB backends, repair or restart the Browser registration path before treating the in-app Browser as available.",
      };
    }

    return {
      classification: "codex-owned-sockets-but-iab-unverified",
      summary:
        "Codex owns Browser sockets and fallback browsing works. The Browser client also filters IAB backends by Codex session metadata, so this shell gate cannot prove the official in-app Browser API exposes iab to the current thread.",
      nextAction:
        "Verify official availability inside the Browser plugin runtime with agent.browsers.list() and agent.browsers.get('iab'), then compare that result against the session-filtered IAB discovery path.",
    };
  }

  return {
    classification: "fallback-only-iab-unverified",
    summary:
      "Fallback browsing works, but the available shell evidence is not enough to infer official IAB registration.",
    nextAction:
      "Run the Browser plugin runtime check and inspect the diagnostic findings for missing runtime prerequisites.",
  };
}

console.log(
  JSON.stringify(
    {
      status: failures.length === 0 ? "fallback-ok-iab-unverified" : "failed",
      note:
        "This shell diagnostic verifies Browser-adjacent runtime pieces and fallback browsing only. Official IAB availability still requires agent.browsers.get('iab') in the Codex Browser plugin runtime.",
      diagnosis: buildDiagnosis(),
      findings,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exit(1);
}
