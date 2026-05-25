import { mkdtemp, readFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { probeOfficialBrowserIab } from "./probe-official-browser-iab.mjs";

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function fakeNodeRepl() {
  return {
    requestMeta: {
      progressToken: "probe-contract",
      threadId: "thread-contract",
      "x-codex-turn-metadata": {
        session_id: "session-contract",
        thread_id: "thread-contract",
        turn_id: "turn-contract",
        model: "contract-model",
      },
    },
  };
}

async function readProbe(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function runUnavailableProbe(evidenceDir) {
  return probeOfficialBrowserIab({
    evidenceDir,
    operationTimeoutMs: 1000,
    nodeRepl: fakeNodeRepl(),
    globals: {
      agent: {
        browsers: {
          list: async () => [],
          get: async () => {
            throw new Error("Browser is not available: iab");
          },
        },
      },
    },
  });
}

async function runAvailableProbe(evidenceDir) {
  return probeOfficialBrowserIab({
    evidenceDir,
    smokeUrl: "http://127.0.0.1:12345/",
    operationTimeoutMs: 1000,
    smokeTimeoutMs: 1000,
    nodeRepl: fakeNodeRepl(),
    globals: {
      agent: {
        browsers: {
          list: async () => [
            {
              id: "iab",
              name: "Codex in-app browser",
              type: "iab",
            },
          ],
          get: async () => ({
            browserId: "contract-iab-browser",
            nameSession: async () => undefined,
            tabs: {
              new: async () => ({
                goto: async () => undefined,
                title: async () => "MemoryBench",
                url: async () => "http://127.0.0.1:12345/",
                close: async () => undefined,
                playwright: {
                  waitForLoadState: async () => undefined,
                  evaluate: async () => ({
                    h1: "When AI agents remember, what survives and why?",
                    mainCount: 1,
                  }),
                },
              }),
            },
          }),
        },
      },
    },
  });
}

async function runAvailableBrokenSmokeProbe(evidenceDir) {
  let closeCalled = false;
  const probe = await probeOfficialBrowserIab({
    evidenceDir,
    smokeUrl: "http://127.0.0.1:12346/",
    operationTimeoutMs: 1000,
    smokeTimeoutMs: 1000,
    nodeRepl: fakeNodeRepl(),
    globals: {
      agent: {
        browsers: {
          list: async () => [
            {
              id: "iab",
              name: "Codex in-app browser",
              type: "iab",
            },
          ],
          get: async () => ({
            browserId: "contract-iab-browser-broken-smoke",
            nameSession: async () => undefined,
            tabs: {
              new: async () => ({
                goto: async () => undefined,
                title: async () => "Wrong app",
                url: async () => "http://127.0.0.1:12346/",
                close: async () => {
                  closeCalled = true;
                },
                playwright: {
                  waitForLoadState: async () => undefined,
                  evaluate: async () => ({
                    h1: "Not MemoryBench",
                    mainCount: 2,
                  }),
                },
              }),
            },
          }),
        },
      },
    },
  });

  return { ...probe, closeCalled };
}

async function runListTimeoutProbe(evidenceDir) {
  return probeOfficialBrowserIab({
    evidenceDir,
    operationTimeoutMs: 20,
    nodeRepl: fakeNodeRepl(),
    globals: {
      agent: {
        browsers: {
          list: async () => new Promise(() => {}),
          get: async () => {
            throw new Error("should not reach get when list times out");
          },
        },
      },
    },
  });
}

async function runGetTimeoutProbe(evidenceDir) {
  return probeOfficialBrowserIab({
    evidenceDir,
    operationTimeoutMs: 20,
    nodeRepl: fakeNodeRepl(),
    globals: {
      agent: {
        browsers: {
          list: async () => [],
          get: async () => new Promise(() => {}),
        },
      },
    },
  });
}

const evidenceDir = await mkdtemp(join(tmpdir(), "memorybench-browser-probe-"));

try {
  const unavailable = await runUnavailableProbe(evidenceDir);
  const unavailableFile = await readProbe(unavailable.probePath);

  expect(
    /codex-browser-iab-probe-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[0-9a-f-]{36}\.json$/.test(
      basename(unavailable.probePath),
    ),
    "official Browser probe filename must preserve milliseconds and include a UUID to avoid burst evidence collisions",
  );
  expect(unavailable.result.conclusion === "official-iab-unavailable-current-thread", "unavailable probe conclusion mismatch");
  expect(
    unavailable.result.diagnosis?.classification === "session-metadata-present-no-iab-backends",
    "unavailable probe must classify the current Browser failure as metadata-present with zero IAB backends",
  );
  expect(
    unavailable.result.diagnosis?.evidence?.hasSessionId === true &&
      unavailable.result.diagnosis?.evidence?.hasTurnId === true &&
      unavailable.result.diagnosis?.evidence?.listCount === 0,
    "unavailable probe diagnosis must persist redacted session metadata and zero-backend evidence",
  );
  expect(
    unavailable.result.diagnosis?.nextAction?.includes("registered for the current Codex session"),
    "unavailable probe diagnosis must include a concrete current-session Browser registration repair action",
  );
  expect(
    unavailable.result.probeRunId && basename(unavailable.probePath).includes(unavailable.result.probeRunId),
    "unavailable probe must bind evidence filename to a persisted probeRunId",
  );
  expect(unavailable.result.operationTimeoutMs === 1000, "unavailable probe must persist operation timeout");
  expect(
    Number.isFinite(unavailable.result.operationTimingsMs?.["agent.browsers.list"]),
    "unavailable probe must record browser list timing evidence",
  );
  expect(unavailable.conclusion === unavailable.result.conclusion, "unavailable probe must expose the conclusion at the top level for REPL use");
  expect(unavailable.path === unavailable.probePath, "unavailable probe must expose a top-level evidence path alias");
  expect(unavailable.result.getIabOk === false, "unavailable probe must record getIabOk=false");
  expect(unavailable.getIabOk === unavailable.result.getIabOk, "unavailable probe must expose getIabOk at the top level for REPL use");
  expect(unavailable.result.getIabError === "Browser is not available: iab", "unavailable probe must preserve exact IAB error");
  expect(unavailable.getIabError === unavailable.result.getIabError, "unavailable probe must expose getIabError at the top level for REPL use");
  expect(unavailable.result.listOk === true, "unavailable probe must still record successful browser list call");
  expect(unavailable.result.listCount === 0, "unavailable probe must record zero listed browsers in the current failure shape");
  expect(unavailable.listCount === unavailable.result.listCount, "unavailable probe must expose listCount at the top level for REPL use");
  expect(unavailable.result.requestMetaKeys.includes("threadId"), "unavailable probe must preserve threadId request metadata");
  expect(
    unavailable.result.requestMetadataDiagnostic?.hasSessionId === true,
    "unavailable probe must prove Browser session_id request metadata is present",
  );
  expect(
    unavailable.result.requestMetadataDiagnostic?.hasTurnId === true,
    "unavailable probe must prove Browser turn_id request metadata is present",
  );
  expect(
    unavailable.result.requestMetadataDiagnostic?.turnMetadataKeys.includes("session_id"),
    "unavailable probe must persist redacted Browser turn metadata key evidence",
  );
  expect(unavailableFile.conclusion === unavailable.result.conclusion, "unavailable probe file must match returned result");

  const available = await runAvailableProbe(evidenceDir);
  const availableFile = await readProbe(available.probePath);

  expect(available.result.conclusion === "official-iab-available-current-thread", "available probe conclusion mismatch");
  expect(
    available.result.diagnosis?.classification === "official-iab-available-and-smoke-tested",
    "available probe must classify repaired Browser state as available and smoke-tested",
  );
  expect(
    available.result.diagnosis?.evidence?.smokeOk === true,
    "available probe diagnosis must persist smoke-ok evidence",
  );
  expect(
    available.result.probeRunId && basename(available.probePath).includes(available.result.probeRunId),
    "available probe must bind evidence filename to a persisted probeRunId",
  );
  expect(available.result.smokeTimeoutMs === 1000, "available probe must persist smoke timeout");
  expect(available.conclusion === available.result.conclusion, "available probe must expose the conclusion at the top level for REPL use");
  expect(available.result.getIabOk === true, "available probe must record getIabOk=true");
  expect(available.getIabOk === available.result.getIabOk, "available probe must expose getIabOk at the top level for REPL use");
  expect(available.result.iabBrowserId === "contract-iab-browser", "available probe must persist iabBrowserId");
  expect(available.iabBrowserId === available.result.iabBrowserId, "available probe must expose iabBrowserId at the top level for REPL use");
  expect(available.result.availabilitySmoke?.attempted === true, "available probe must attempt a real page smoke when smokeUrl is supplied");
  expect(available.availabilitySmoke === available.result.availabilitySmoke, "available probe must expose availabilitySmoke at the top level for REPL use");
  expect(available.result.availabilitySmoke?.ok === true, "available probe must prove IAB can navigate and inspect the smoke URL");
  expect(
    available.result.availabilitySmoke?.h1 === "When AI agents remember, what survives and why?",
    "available probe must persist smoke-page h1 evidence",
  );
  expect(available.result.availabilitySmoke?.mainCount === 1, "available probe must persist smoke-page landmark evidence");
  expect(
    Number.isFinite(available.result.operationTimingsMs?.["officialSmoke.goto"]),
    "available probe must record official smoke navigation timing evidence",
  );
  expect(available.result.getIabError === null, "available probe must not retain an IAB error");
  expect(available.result.listOk === true, "available probe must record successful browser list call");
  expect(available.result.listCount === 1, "available probe must record listed browser count");
  expect(available.result.list[0]?.type === "iab", "available probe must preserve listed browser type");
  expect(available.result.requestMetaKeys.includes("threadId"), "available probe must preserve threadId request metadata");
  expect(
    available.result.requestMetadataDiagnostic?.hasSessionId === true &&
      available.result.requestMetadataDiagnostic?.hasTurnId === true,
    "available probe must preserve redacted Browser session and turn metadata diagnostics",
  );
  expect(availableFile.iabBrowserId === available.result.iabBrowserId, "available probe file must match returned browser id");
  expect(availableFile.availabilitySmoke?.ok === true, "available probe file must persist smoke success evidence");

  const brokenSmoke = await runAvailableBrokenSmokeProbe(evidenceDir);
  const brokenSmokeFile = await readProbe(brokenSmoke.probePath);

  expect(
    brokenSmoke.result.conclusion === "official-iab-available-current-thread",
    "broken-smoke probe should still record that get('iab') itself succeeded",
  );
  expect(
    brokenSmoke.result.diagnosis?.classification === "official-iab-available-smoke-unverified",
    "broken-smoke probe must classify get('iab') success separately from unusable smoke evidence",
  );
  expect(brokenSmoke.result.getIabOk === true, "broken-smoke probe must preserve getIabOk=true");
  expect(brokenSmoke.result.availabilitySmoke?.attempted === true, "broken-smoke probe must record attempted smoke");
  expect(brokenSmoke.result.availabilitySmoke?.ok === false, "broken-smoke probe must record failed smoke separately");
  expect(brokenSmoke.result.availabilitySmoke?.h1 === "Not MemoryBench", "broken-smoke probe must persist wrong-page h1 evidence");
  expect(brokenSmoke.result.availabilitySmoke?.mainCount === 2, "broken-smoke probe must persist wrong-page landmark evidence");
  expect(brokenSmoke.closeCalled === true, "broken-smoke probe must close the tab even when smoke validation fails");
  expect(brokenSmokeFile.availabilitySmoke?.ok === false, "broken-smoke probe file must persist smoke failure evidence");

  const listTimeout = await runListTimeoutProbe(evidenceDir);
  expect(
    listTimeout.result.conclusion === "official-browser-runtime-setup-failed",
    "list-timeout probe must fail as runtime setup/list failure instead of hanging",
  );
  expect(
    listTimeout.result.diagnosis?.classification === "official-browser-runtime-setup-failed",
    "list-timeout probe must classify runtime setup/list failure",
  );
  expect(
    listTimeout.result.setupError === "agent.browsers.list timed out after 20ms",
    "list-timeout probe must persist exact list timeout error",
  );
  expect(
    Number.isFinite(listTimeout.result.operationTimingsMs?.["agent.browsers.list"]),
    "list-timeout probe must persist timing for the timed-out list call",
  );

  const getTimeout = await runGetTimeoutProbe(evidenceDir);
  expect(
    getTimeout.result.conclusion === "official-iab-unavailable-current-thread",
    "get-timeout probe must write unavailable evidence instead of hanging",
  );
  expect(
    getTimeout.result.diagnosis?.classification === "official-iab-unavailable-unclassified",
    "get-timeout probe must not masquerade as the known zero-IAB-backend failure",
  );
  expect(
    getTimeout.result.getIabError === "agent.browsers.get.iab timed out after 20ms",
    "get-timeout probe must persist exact get('iab') timeout error",
  );

  expect(unavailable.probePath !== available.probePath, "separate official Browser probe runs must not overwrite evidence files");
  expect(available.probePath !== brokenSmoke.probePath, "available and broken-smoke probe runs must not overwrite evidence files");
  expect(brokenSmoke.probePath !== listTimeout.probePath, "timeout probe runs must not overwrite prior evidence files");

  try {
    await probeOfficialBrowserIab({
      evidenceDir,
      globals: { agent: { browsers: { list: async () => [], get: async () => null } } },
      nodeRepl: null,
    });
    failures.push("official Browser probe must reject ordinary shell execution without nodeRepl");
  } catch (error) {
    expect(
      String(error?.message ?? error).includes("Codex Browser Node REPL runtime"),
      "ordinary-shell rejection must explain that the Browser Node REPL runtime is required",
    );
  }

  try {
    execFileSync("node", ["scripts/probe-official-browser-iab.mjs"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 5000,
    });
    failures.push("direct official Browser probe CLI execution must fail instead of silently succeeding");
  } catch (error) {
    const stderr = String(error?.stderr ?? "");
    expect(error?.status === 2, "direct official Browser probe CLI execution must exit with code 2");
    expect(
      stderr.includes("Codex Browser Node REPL runtime") &&
        stderr.includes("ordinary shell execution cannot access agent.browsers.get('iab')"),
      "direct official Browser probe CLI failure must explain why shell execution is non-authoritative",
    );
  }
} finally {
  await rm(evidenceDir, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`Codex Browser probe contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Codex Browser probe contract ok: unavailable, available, provenance, and filename collision guards checked");
