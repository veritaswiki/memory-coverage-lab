import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

const defaultPluginRoot = "/Users/lux/.codex/plugins/cache/openai-bundled/browser/26.519.41501";
const defaultEvidenceDir = "/Users/lux/project/memory-coverage-lab/docs/evidence";
const probeSource = "scripts/probe-official-browser-iab.mjs";
const runtimeSurface = "codex-browser-node-repl";
const defaultOperationTimeoutMs = 12_000;
const defaultSmokeTimeoutMs = 15_000;

function diagnoseRequestMetadata(nodeRepl) {
  const requestMeta = nodeRepl?.requestMeta || {};
  const rawTurnMetadata = requestMeta["x-codex-turn-metadata"];
  let turnMetadata = rawTurnMetadata;
  let parseError = null;

  if (typeof rawTurnMetadata === "string") {
    try {
      turnMetadata = JSON.parse(rawTurnMetadata);
    } catch (error) {
      parseError = error?.message ?? String(error);
      turnMetadata = null;
    }
  }

  const turnMetadataKeys =
    turnMetadata && typeof turnMetadata === "object"
      ? Object.keys(turnMetadata).sort()
      : [];

  return {
    requestMetaKeys: Object.keys(requestMeta).sort(),
    turnMetadataType: rawTurnMetadata === null ? "null" : typeof rawTurnMetadata,
    turnMetadataParseOk: Boolean(turnMetadata && typeof turnMetadata === "object"),
    turnMetadataKeys,
    hasSessionId: Boolean(
      turnMetadata &&
        typeof turnMetadata === "object" &&
        typeof turnMetadata.session_id === "string" &&
        turnMetadata.session_id.length > 0,
    ),
    hasTurnId: Boolean(
      turnMetadata &&
        typeof turnMetadata === "object" &&
        typeof turnMetadata.turn_id === "string" &&
        turnMetadata.turn_id.length > 0,
    ),
    parseError,
  };
}

function diagnoseOfficialBrowserAvailability(result) {
  const metadata = result.requestMetadataDiagnostic;

  if (result.conclusion === "official-iab-available-current-thread") {
    return {
      classification: result.availabilitySmoke?.ok
        ? "official-iab-available-and-smoke-tested"
        : "official-iab-available-smoke-unverified",
      summary: result.availabilitySmoke?.ok
        ? "The official Codex in-app Browser backend is registered for this thread and can drive the MemoryBench smoke page."
        : "The official Codex in-app Browser backend is registered for this thread, but local-page smoke evidence is missing or failed.",
      evidence: {
        listOk: result.listOk === true,
        listCount: result.listCount,
        getIabOk: result.getIabOk === true,
        hasSessionId: metadata?.hasSessionId === true,
        hasTurnId: metadata?.hasTurnId === true,
        smokeAttempted: result.availabilitySmoke?.attempted === true,
        smokeOk: result.availabilitySmoke?.ok === true,
      },
      nextAction: result.availabilitySmoke?.ok
        ? "Use the official Browser runtime for local UI verification."
        : "Run the probe with a MemoryBench smoke URL and require availabilitySmoke.ok before treating the official Browser as usable.",
    };
  }

  if (
    result.conclusion === "official-iab-unavailable-current-thread" &&
    result.listOk === true &&
    result.listCount === 0 &&
    result.getIabOk === false &&
    result.getIabError === "Browser is not available: iab" &&
    metadata?.hasSessionId === true &&
    metadata?.hasTurnId === true
  ) {
    return {
      classification: "session-metadata-present-no-iab-backends",
      summary: "Browser request metadata includes session_id and turn_id, but the official Browser runtime lists zero IAB backends for this thread.",
      evidence: {
        listOk: true,
        listCount: 0,
        getIabOk: false,
        getIabError: result.getIabError,
        hasSessionId: true,
        hasTurnId: true,
        turnMetadataKeys: metadata.turnMetadataKeys,
      },
      nextAction: "Repair or restart the Browser backend registration path so an IAB backend is registered for the current Codex session; then rerun this probe and require getIabOk=true plus smoke evidence.",
    };
  }

  if (result.conclusion === "official-iab-unavailable-current-thread") {
    return {
      classification: "official-iab-unavailable-unclassified",
      summary: "The official Browser runtime could not return an IAB backend, but the failure shape does not match the known zero-backend case.",
      evidence: {
        listOk: result.listOk === true,
        listCount: result.listCount,
        getIabOk: result.getIabOk === true,
        getIabError: result.getIabError,
        hasSessionId: metadata?.hasSessionId === true,
        hasTurnId: metadata?.hasTurnId === true,
      },
      nextAction: "Inspect the persisted probe fields and Browser shell diagnostic before treating this as the known current-thread no-IAB-backend state.",
    };
  }

  return {
    classification: "official-browser-runtime-setup-failed",
    summary: "The Browser runtime setup or browser listing failed before IAB availability could be tested.",
    evidence: {
      setupError: result.setupError ?? null,
      listOk: result.listOk === true,
      hasSessionId: metadata?.hasSessionId === true,
      hasTurnId: metadata?.hasTurnId === true,
    },
    nextAction: "Fix Browser runtime setup/listing before evaluating IAB availability.",
  };
}

export async function probeOfficialBrowserIab({
  globals = globalThis,
  nodeRepl = globalThis.nodeRepl,
  pluginRoot = defaultPluginRoot,
  evidenceDir = defaultEvidenceDir,
  smokeUrl = null,
  operationTimeoutMs = defaultOperationTimeoutMs,
  smokeTimeoutMs = defaultSmokeTimeoutMs,
} = {}) {
  if (!nodeRepl) {
    throw new Error("probeOfficialBrowserIab must run inside the Codex Browser Node REPL runtime");
  }

  const createdAt = new Date().toISOString();
  const stamp = createdAt.replaceAll(":", "-").replace(".", "-");
  const probeRunId = randomUUID();
  const probePath = `${evidenceDir}/codex-browser-iab-probe-${stamp}-${probeRunId}.json`;
  const result = {
    createdAt,
    probeRunId,
    probeSource,
    runtimeSurface,
    pluginRoot,
    operationTimeoutMs,
    smokeTimeoutMs,
    operationTimingsMs: {},
    requestMetaKeys: Object.keys(nodeRepl.requestMeta || {}).sort(),
    requestMetadataDiagnostic: diagnoseRequestMetadata(nodeRepl),
    listOk: false,
    listCount: null,
    list: null,
    getIabOk: false,
    getIabError: null,
    availabilitySmoke: null,
    conclusion: null,
  };

  try {
    if (!globals.agent) {
      await timedOperation(result, "setupBrowserRuntime", operationTimeoutMs, async () => {
        const { setupBrowserRuntime } = await import(`${pluginRoot}/scripts/browser-client.mjs`);
        await setupBrowserRuntime({ globals });
      });
    }

    const browserList = await timedOperation(
      result,
      "agent.browsers.list",
      operationTimeoutMs,
      () => globals.agent.browsers.list(),
    );
    result.listOk = true;
    result.listCount = browserList.length;
    result.list = browserList.map((item) => ({
      id: item.id ?? item.browserId ?? null,
      name: item.name ?? null,
      type: item.type ?? null,
    }));

    try {
      const iabBrowser = await timedOperation(
        result,
        "agent.browsers.get.iab",
        operationTimeoutMs,
        () => globals.agent.browsers.get("iab"),
      );
      result.getIabOk = true;
      result.iabBrowserId = iabBrowser.browserId ?? null;
      result.availabilitySmoke = await smokeOfficialBrowser(iabBrowser, smokeUrl, {
        timeoutMs: smokeTimeoutMs,
        result,
      });
      result.conclusion = "official-iab-available-current-thread";
    } catch (error) {
      result.getIabError = error?.message ?? String(error);
      result.conclusion = "official-iab-unavailable-current-thread";
    }
  } catch (error) {
    result.setupError = error?.message ?? String(error);
    result.conclusion = "official-browser-runtime-setup-failed";
  }

  result.diagnosis = diagnoseOfficialBrowserAvailability(result);

  await mkdir(dirname(probePath), { recursive: true });
  await writeFile(probePath, JSON.stringify(result, null, 2));

  return {
    probePath,
    path: probePath,
    ...result,
    result,
  };
}

async function timedOperation(result, label, timeoutMs, action) {
  const startedAt = Date.now();
  try {
    return await withTimeout(label, timeoutMs, action());
  } finally {
    result.operationTimingsMs[label] = Date.now() - startedAt;
  }
}

async function withTimeout(label, timeoutMs, promise) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function smokeOfficialBrowser(browser, smokeUrl, { timeoutMs, result }) {
  const smoke = {
    attempted: Boolean(smokeUrl),
    ok: false,
    url: smokeUrl,
    title: null,
    finalUrl: null,
    h1: null,
    mainCount: null,
    error: null,
  };

  if (!smokeUrl) {
    return smoke;
  }

  let tab = null;

  try {
    await timedOperation(result, "officialSmoke.nameSession", timeoutMs, () =>
      browser.nameSession?.("🔎 MemoryBench IAB smoke") ?? Promise.resolve(),
    );
    tab = await timedOperation(result, "officialSmoke.tabs.new", timeoutMs, () => browser.tabs.new());
    await timedOperation(result, "officialSmoke.goto", timeoutMs, () => tab.goto(smokeUrl));
    await timedOperation(result, "officialSmoke.waitForLoadState", timeoutMs, () =>
      tab.playwright.waitForLoadState({ state: "load", timeoutMs }),
    );
    smoke.title = (await timedOperation(result, "officialSmoke.title", timeoutMs, () => tab.title())) ?? null;
    smoke.finalUrl = (await timedOperation(result, "officialSmoke.url", timeoutMs, () => tab.url())) ?? null;
    const pageState = await timedOperation(result, "officialSmoke.evaluate", timeoutMs, () =>
      tab.playwright.evaluate(`(() => ({
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      mainCount: document.querySelectorAll("main").length,
    }))()`),
    );
    smoke.h1 = pageState.h1;
    smoke.mainCount = pageState.mainCount;
    smoke.ok =
      typeof smoke.finalUrl === "string" &&
      smoke.finalUrl.startsWith(smokeUrl) &&
      typeof smoke.h1 === "string" &&
      smoke.h1.includes("When AI agents") &&
      smoke.mainCount === 1;
  } catch (error) {
    smoke.error = error?.message ?? String(error);
  } finally {
    try {
      await tab?.close?.();
    } catch {
      // The smoke tab may already be closed if the Browser backend failed.
    }
  }

  return smoke;
}

function isDirectCliExecution() {
  const argvPath = globalThis.process?.argv?.[1];
  return typeof argvPath === "string" && import.meta.url === pathToFileURL(argvPath).href;
}

if (isDirectCliExecution()) {
  console.error(
    [
      "probe-official-browser-iab.mjs must run inside the Codex Browser Node REPL runtime.",
      "Import probeOfficialBrowserIab from this module and call it from the Browser plugin runtime;",
      "ordinary shell execution cannot access agent.browsers.get('iab') or produce authoritative IAB evidence.",
    ].join(" "),
  );
  globalThis.process.exitCode = 2;
}
