import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("opendesign/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const app = readFileSync("src/App.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const readme = readFileSync("README.md", "utf8");
const designSystem = readFileSync("opendesign/design-systems/memory-os/SKILL.md", "utf8");
const tokenCss = readFileSync("opendesign/design-systems/memory-os/tokens/colors_and_type.css", "utf8");
const studioMockup = readFileSync("opendesign/mockups/memorybench-ai-studio/index.html", "utf8");
const coverageMockup = readFileSync("opendesign/mockups/memory-coverage-lab/index.html", "utf8");
const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function rootToken(source, name) {
  const match = source.match(new RegExp(`--${name}:\\s*([^;]+);`));
  return match?.[1]?.trim() ?? null;
}

function manifestFilePaths() {
  return (manifest.sections ?? []).flatMap((section) =>
    (section.groups ?? []).flatMap((group) =>
      (group.files ?? []).map((file) => ({
        sectionId: section.id,
        groupSlug: group.slug,
        label: file.label,
        path: file.path,
      })),
    ),
  );
}

for (const file of manifestFilePaths()) {
  const candidate = resolve("opendesign", file.path);

  if (!existsSync(candidate)) {
    failures.push(`OpenDesign manifest references missing file: ${file.path}`);
  }
}

const requiredFiles = [
  {
    sectionId: "mockups",
    groupSlug: "memory-coverage-lab",
    path: "mockups/memory-coverage-lab/index.html",
  },
  {
    sectionId: "mockups",
    groupSlug: "memorybench-ai-studio",
    path: "mockups/memorybench-ai-studio/index.html",
  },
  {
    sectionId: "design-systems",
    groupSlug: "memory-os",
    path: "design-systems/memory-os/SKILL.md",
  },
  {
    sectionId: "design-systems",
    groupSlug: "memory-os",
    path: "design-systems/memory-os/tokens/colors_and_type.css",
  },
];

for (const required of requiredFiles) {
  expect(
    manifestFilePaths().some(
      (file) =>
        file.sectionId === required.sectionId &&
        file.groupSlug === required.groupSlug &&
        file.path === required.path,
    ),
    `OpenDesign manifest must include ${required.sectionId}/${required.groupSlug}/${required.path}`,
  );
}

for (const mockup of [
  ["memorybench-ai-studio", studioMockup],
  ["memory-coverage-lab", coverageMockup],
]) {
  expect(
    mockup[1].includes("../../design-systems/memory-os/tokens/colors_and_type.css"),
    `${mockup[0]} mockup must import the shared memory-os token file`,
  );
}

expect(
  styles.startsWith("/* OpenDesign source: opendesign/design-systems/memory-os + memorybench-ai-studio mockup. */"),
  "production CSS must declare its OpenDesign source at the top of the file",
);
expect(
  app.includes('data-opendesign-source="opendesign/mockups/memorybench-ai-studio"'),
  "production hero must carry a data-opendesign-source pointer to the active mockup",
);
expect(
  readme.includes("## Design Source") &&
    readme.includes("opendesign/manifest.json") &&
    readme.includes("opendesign/design-systems/memory-os/SKILL.md") &&
    readme.includes("opendesign/mockups/memorybench-ai-studio/index.html"),
  "README must document the OpenDesign source-of-truth files",
);

const tokenPairs = [
  ["memory-paper", "paper"],
  ["memory-field", "field"],
  ["memory-ink", "ink"],
  ["memory-muted", "muted"],
  ["memory-green", "green"],
  ["memory-teal", "teal"],
  ["memory-coral", "coral"],
  ["memory-gold", "gold"],
  ["memory-lime", "lime"],
  ["memory-plum", "plum"],
  ["memory-blue", "blue"],
  ["memory-paper-warm", "warm"],
  ["memory-line-soft", "line-soft"],
  ["memory-radius", "radius"],
];

for (const [sourceToken, productionToken] of tokenPairs) {
  const sourceValue = rootToken(tokenCss, sourceToken);
  const productionValue = rootToken(styles, productionToken);

  expect(sourceValue !== null, `OpenDesign token --${sourceToken} must exist`);
  expect(productionValue !== null, `production token --${productionToken} must exist`);
  expect(
    sourceValue === productionValue,
    `production token --${productionToken} must mirror OpenDesign --${sourceToken}: expected ${sourceValue}, got ${productionValue}`,
  );
}

for (const fragment of [
  "Operational research workbench",
  "precise circle",
  "sixteen-axis AIGC memory model",
  "off-white paper",
  "orbit/circle geometry",
  "four research layers",
  "Tabs switch views",
  "Avoid decorative card nesting",
]) {
  expect(designSystem.includes(fragment), `memory-os design system must retain guidance: ${fragment}`);
}

for (const fragment of [
  "hero-visual",
  "orbit orbit-outer",
  "orbit orbit-mid",
  "criteria-core",
  "circle-stage",
  "Capability matrix",
  "Stack design",
  "Evidence ledger",
  "metric-ribbon",
  "dossier-panel",
]) {
  expect(app.includes(fragment), `production React surface must preserve OpenDesign interaction/geometry fragment: ${fragment}`);
}

for (const fragment of [
  ".hero-visual",
  ".orbit",
  ".signal-polygon",
  ".criteria-core",
  ".circle-stage",
  ".map-node",
  ".metric-ribbon",
  ".dossier-panel",
  ".evidence-row",
]) {
  expect(styles.includes(fragment), `production CSS must preserve OpenDesign visual vocabulary: ${fragment}`);
}

for (const family of ["IBM Plex Serif", "IBM Plex Sans", "IBM Plex Mono"]) {
  expect(styles.includes(family), `production CSS must keep OpenDesign typography family ${family}`);
}

if (failures.length > 0) {
  console.error(`OpenDesign contract failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log(
  `OpenDesign contract ok: ${manifest.sections.length} section(s), ${manifestFilePaths().length} source file(s), token mirrors, mockup binding, and production usage checked`,
);
