import { existsSync, readFileSync } from "node:fs";

const digest = JSON.parse(readFileSync("src/data/researchDigest.json", "utf8"));
const sources = JSON.parse(readFileSync("content/research/sources.json", "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const workflow = readFileSync(".github/workflows/research-watch.yml", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

expect(digest.sourcePath === "content/research", "research digest must point to content/research");
expect(Array.isArray(digest.entries) && digest.entries.length >= 2, "research digest must expose at least two entries");
expect(
  digest.entries.every((entry) => existsSync(entry.githubPath) && entry.githubUrl.includes("/blob/main/content/research/")),
  "every digest entry must link to a GitHub-readable Markdown source",
);
expect(
  sources.githubRepos.length >= 6 && sources.arxivQueries.length >= 3,
  "research watch must track core repositories and literature queries",
);
expect(
  pkg.scripts?.["research:collect"]?.includes("research-digest.mjs") &&
    pkg.scripts?.["research:index"]?.includes("--offline") &&
    pkg.scripts?.["check:research"]?.includes("check-research-archive.mjs"),
  "package scripts must expose research collect, index, and validation commands",
);
expect(
  workflow.includes("schedule:") &&
    workflow.includes("pnpm research:collect") &&
    workflow.includes("contents: write") &&
    workflow.includes("git commit"),
  "research watch workflow must run on a schedule and commit generated research updates",
);
expect(
  app.includes("researchDigest") &&
    app.includes("githubUrl") &&
    app.includes("t.published.githubAction"),
  "public site must render research digest entries with GitHub article links",
);

if (failures.length > 0) {
  console.error(`Research archive check failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("research_archive_ok");

