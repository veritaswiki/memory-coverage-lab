import { readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const html = readFileSync("index.html", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const capabilities = readFileSync("src/data/capabilities.ts", "utf8");
const implementation = readFileSync("src/data/implementation.ts", "utf8");
const projects = readFileSync("src/data/projects.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8"));

const failures = [];

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function count(source, pattern) {
  return (source.match(pattern) ?? []).length;
}

function hexToHue(hex) {
  const normalized = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex.slice(0, 7);
  const r = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const g = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const b = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta === 0) {
    return null;
  }

  let hue;
  if (max === r) {
    hue = 60 * (((g - b) / delta) % 6);
  } else if (max === g) {
    hue = 60 * ((b - r) / delta + 2);
  } else {
    hue = 60 * ((r - g) / delta + 4);
  }

  return Math.round((hue + 360) % 360);
}

function rootToken(name) {
  const match = styles.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})\\s*;`));
  return match?.[1] ?? null;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cssRule(selector) {
  const match = styles.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\n\\}`));
  return match?.[1] ?? "";
}

function scanFontViewportUnits() {
  const offenders = styles
    .split("\n")
    .map((line, index) => ({ line: index + 1, text: line.trim() }))
    .filter(({ text }) => /(?:font-size|font)\s*:[^;]*\bvw\b/.test(text));

  for (const offender of offenders) {
    failures.push(`font sizing must not use viewport units: line ${offender.line} "${offender.text}"`);
  }
}

function scanFontLoading() {
  expect(!styles.includes("@import"), "CSS must not use render-blocking @import for font loading");
  expect(
    html.includes('rel="preconnect" href="https://fonts.googleapis.com"') &&
      html.includes('rel="preconnect" href="https://fonts.gstatic.com" crossorigin'),
    "font loading must preconnect to Google Fonts origins from HTML",
  );
  expect(
    html.includes('rel="stylesheet"') &&
      html.includes("fonts.googleapis.com/css2?family=IBM+Plex+Mono") &&
      html.includes("display=swap"),
    "font stylesheet must load from HTML with display=swap",
  );
}

function scanReducedMotionPreboot() {
  const prebootIndex = html.indexOf('document.documentElement.dataset.motionReduce = "true"');
  const stylesheetIndex = html.indexOf('rel="stylesheet"');
  const moduleIndex = html.indexOf('src="/src/main.tsx"');

  expect(prebootIndex !== -1, "HTML must include a reduced-motion preboot marker for ?motion=reduce");
  expect(
    prebootIndex !== -1 &&
      stylesheetIndex !== -1 &&
      moduleIndex !== -1 &&
      prebootIndex < stylesheetIndex &&
      prebootIndex < moduleIndex,
    "reduced-motion preboot marker must run before CSS and React module loading",
  );
  expect(!styles.includes("dossier-sidebar"), "reduced-motion sticky overrides must not reference stale dossier-sidebar selectors");
  expect(styles.includes(".dossier-panel"), "reduced-motion sticky overrides must reference the rendered dossier-panel selector");
}

function scanBorderRadii() {
  const radiusMatches = [...styles.matchAll(/border-radius\s*:\s*([^;]+);/g)];
  const radiusToken = Number.parseFloat(rootToken("radius")?.replace("#", "") ?? "NaN");

  expect(styles.includes("--radius: 8px;"), "shared card radius token must stay at 8px or less");

  for (const match of radiusMatches) {
    const value = match[1].trim();
    if (value === "50%" || value === "999px" || value === "inherit" || value === "var(--radius)") {
      continue;
    }

    const px = value.match(/^(\d+(?:\.\d+)?)px$/);
    if (px && Number(px[1]) > 8) {
      failures.push(`border-radius must stay at 8px or less for framed UI, got ${value}`);
    }
  }

  if (Number.isFinite(radiusToken) && radiusToken > 8) {
    failures.push(`--radius must stay at 8px or less, got ${radiusToken}px`);
  }
}

function scanPalette() {
  const accentNames = ["green", "teal", "coral", "gold", "lime", "plum", "blue"];
  const accentValues = accentNames.map((name) => [name, rootToken(name)]);
  const missing = accentValues.filter(([, value]) => !value).map(([name]) => name);
  expect(missing.length === 0, `missing required cross-category accent token(s): ${missing.join(", ")}`);

  const hueBuckets = new Map();
  for (const [name, value] of accentValues) {
    if (!value) {
      continue;
    }

    const hue = hexToHue(value);
    if (hue === null) {
      failures.push(`accent token --${name} must be chromatic, got ${value}`);
      continue;
    }

    const bucket = Math.floor(hue / 45);
    hueBuckets.set(bucket, [...(hueBuckets.get(bucket) ?? []), name]);
  }

  const largestBucket = Math.max(0, ...[...hueBuckets.values()].map((names) => names.length));
  expect(hueBuckets.size >= 5, `accent palette must span at least 5 hue families, got ${hueBuckets.size}`);
  expect(largestBucket <= 2, `accent palette is too one-note; largest hue family contains ${largestBucket} token(s)`);
  expect(
    ["green", "teal", "coral", "gold", "plum", "blue"].every((token) =>
      new RegExp(`var\\(--${token}\\)`).test(styles),
    ),
    "core accent tokens must be used in the interface, not only declared",
  );
}

function scanContinuityStructure() {
  const mainStart = app.indexOf('<main className="site-main" id="main-content" tabIndex={-1}>');
  const mainEnd = app.indexOf("</main>", mainStart);
  const footerIndex = app.indexOf('<SiteFooter ', mainStart);
  const continuumIndex = app.indexOf('<div className="page-continuum">', mainStart);
  const studioIndex = app.indexOf('className="studio-workbench briefing-section"', mainStart);

  expect(mainStart !== -1 && mainEnd !== -1, "app must expose one stable main content landmark");
  expect(count(app, /<main\b/g) === 1, "app must not split the page across multiple main landmarks");
  expect(continuumIndex > mainStart && continuumIndex < mainEnd, "page continuum must live inside the main landmark");
  expect(studioIndex > continuumIndex && studioIndex < mainEnd, "studio workbench must remain in the page continuum");
  expect(footerIndex > continuumIndex && footerIndex < mainEnd, "footer must remain inside the continuous main flow");

  for (const className of [
    "surface-section briefing-section",
    "published-section briefing-section",
    "platform-section briefing-section",
    "studio-workbench briefing-section",
    "site-footer briefing-section",
  ]) {
    expect(app.includes(`className="${className}"`), `${className} must use the shared briefing grammar`);
  }

  expect(count(app, /className="section-frame briefing-frame/g) === 5, "there must be five shared briefing frames");
  expect(count(app, /className="briefing-rail"/g) + count(app, /className="briefing-rail" /g) >= 5, "every briefing segment must keep a rail");
  expect(app.includes('className="continuity-lane"'), "below-hero sections must expose one explicit evidence-flow lane");
  expect(styles.includes(".continuity-lane"), "styles must define the evidence-flow lane");
  for (const label of ["Define", "Publish", "Operate", "Verify", "Continue"]) {
    expect(app.includes(`label: "${label}"`), `hero and lower-page evidence loop must include ${label}`);
  }
  for (const staleLabel of ['label: "Plan"', 'label: "Review"', 'label: "QA"', 'label: "Ship"', 'label: "Learn"', 'label: "Decide"']) {
    expect(!app.includes(staleLabel), `evidence-loop vocabulary must not drift back to ${staleLabel}`);
  }
  expect(app.includes('className="workbench-frame"'), "studio must use the shared workbench frame");
  expect(
    app.includes('tabIndex={0} aria-label={t.panels.dossierLabel}'),
    "desktop dossier internal scroll region must be keyboard focusable and explicitly labelled",
  );
  expect(app.includes('aria-current={isSelected ? "true" : undefined}'), "Evidence ledger must expose one current row aligned to the dossier");
  expect(app.includes("onSelectProject(project.slug)"), "Evidence ledger rows must update the shared selected dossier");
  expect(!app.includes("</main>\n\n      <footer"), "footer must not become a detached top-level block");
  expect(!styles.includes(".page-section-card"), "page sections must not be styled as detached cards");
  expect(
    cssRule(".studio-workbench").includes("padding-bottom: 36px;") &&
      cssRule(".site-footer").includes("padding: 42px"),
    "Studio-to-footer handoff must stay visually tight instead of leaving a blank lower-page field",
  );
  expect(
    styles.includes(".lane-strip span:last-child:nth-child(odd)") &&
      styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr));"),
    "mobile hero category lane must stay compact instead of returning to a tall single-column stack",
  );
}

function scanActionSystem() {
  for (const className of [
    "action-link-primary",
    "action-link-accent",
    "action-link-dark",
    "action-link-outline",
    "action-link-text",
  ]) {
    expect(app.includes(className) && styles.includes(`.${className}`), `shared action system must include ${className}`);
  }

  for (const fragment of [
    '<a href="#published"',
    '<a href="#benchmarks">View study</a>',
    '<a href="#research">Research thesis</a>',
    '<a href="#benchmarks">Open studio</a>',
    '<a href="https://github.com/veritaswiki/memory-coverage-lab">GitHub</a>',
    '<a className="action-link action-link-accent" href="#benchmarks">Explore benchmark data</a>',
    '<a className="action-link action-link-text" href="#benchmarks">View study</a>',
  ]) {
    expect(!app.includes(fragment), `editorial action link must use the shared action-link grammar: ${fragment}`);
  }

  expect(
    count(app, /onSelectMode\("map", false, true\)/g) >= 5,
    "benchmark action links must explicitly reset the Studio to the Research map",
  );
  expect(
    count(app, /event\.preventDefault\(\);/g) >= 7,
    "Studio and Evidence links must prevent the native hash jump before synchronizing mode, hash, and scroll position",
  );
  expect(
    app.includes('window.history.pushState({}, "", currentHref);') &&
      app.includes('window.setTimeout(syncStudioAnchor, 180);') &&
      app.includes('window.setTimeout(() => markTopNavigationCurrent(currentHref), 520);'),
    "manual Studio/Evidence navigation must keep the public hash while rechecking scroll and current-nav state after React and GSAP settle",
  );
  expect(
    app.includes('href="#evidence"') && app.includes('onSelectMode("evidence", false, true)'),
    "published study links must activate the Evidence ledger instead of landing on a stale Studio tab",
  );
  expect(
    app.includes('className="action-link action-link-accent" href="#evidence"') &&
      app.includes('onSelectMode("evidence", false, true)') &&
      app.includes("Evidence ledger"),
    "footer primary action must continue the evidence trail instead of returning to the Research map",
  );
  expect(
    app.includes("studioModeFromHash(window.location.hash)") &&
      app.includes('hash === "#evidence"') &&
      app.includes('window.addEventListener("hashchange", syncModeFromHash)'),
    "Evidence deep links and browser hash changes must hydrate the Evidence ledger mode",
  );

  for (const fragment of [
    ".hero-actions a:first-child",
    ".hero-actions a:last-child",
    ".hero-actions a {",
    ".surface-grid a {",
    ".research-list a {",
    ".footer-actions a:nth-child(2)",
  ]) {
    expect(!styles.includes(fragment), `action styling must not fork by section selector: ${fragment}`);
  }
}

function scanContinuityPerformance() {
  expect(
    !styles.includes(".page-continuum::after"),
    "page continuum must not use a full-page pseudo-element overlay; it caused a reduced-motion scroll repaint spike",
  );

  const frameBefore = cssRule(".briefing-frame::before");
  expect(frameBefore.includes("border-left:"), "briefing frame continuity marker must stay as a lightweight border rule");
  expect(
    !/background\s*:/.test(frameBefore),
    "briefing frame pseudo-element must not paint a section-wide background layer",
  );

  for (const selector of [
    ".page-continuum",
    ".briefing-section",
    ".surface-section",
    ".published-section",
    ".platform-section",
    ".studio-workbench",
    ".site-footer",
    ".briefing-frame::before",
  ]) {
    const rule = cssRule(selector);

    if (!rule) {
      continue;
    }

    expect(!rule.includes("radial-gradient"), `${selector} must avoid radial-gradient section decoration`);
    expect(!/backdrop-filter\s*:/.test(rule), `${selector} must avoid backdrop-filter on scrolling sections`);
    expect(!/filter\s*:/.test(rule), `${selector} must avoid filter on scrolling sections`);
  }

  const sharedRule = "border-top: 1px solid rgba(20, 32, 28, 0.14);";
  for (const selector of [".section-intro", ".platform-copy", ".workbench-head", ".footer-copy"]) {
    expect(cssRule(selector).includes(sharedRule), `${selector} must keep the shared ruled top line`);
  }

  expect(
    cssRule(".section-intro .eyebrow,\n.section-intro h2").includes("grid-column: 1;") &&
      cssRule(".section-intro > p:not(.eyebrow)").includes("grid-column: 2;") &&
      cssRule(".section-intro > p:not(.eyebrow)").includes("grid-row: 1 / span 2;"),
    "research and published intros must use the same left-title/right-copy grammar as the lower product flow",
  );

  expect(
    styles.includes("@media (max-width: 720px)") &&
      styles.includes(".briefing-rail,\n  .briefing-rail span {\n    transition: none;\n  }"),
    "mobile briefing rails must not animate scroll-active color and shadow transitions during runtime scroll QA",
  );
  expect(
    styles.includes(".metric-ribbon {\n    grid-template-columns: repeat(2, minmax(0, 1fr));") &&
      styles.includes(".metric-ribbon article.emphasis {\n    grid-column: 1 / -1;"),
    "mobile Studio metric ribbon must keep a compact two-column layout with the focus score spanning both columns",
  );

  const reducedStickySelectors = [".top-rail", ".briefing-rail", ".platform-copy", ".dossier-panel"];
  const mediaReducedStickyRule = cssRule("@media (prefers-reduced-motion: reduce)");
  const overrideReducedStickyRule = cssRule('.opendesign-app[data-motion-reduce="true"] .top-rail,\n.opendesign-app[data-motion-reduce="true"] .briefing-rail,\n.opendesign-app[data-motion-reduce="true"] .platform-copy,\n.opendesign-app[data-motion-reduce="true"] .dossier-panel');
  for (const selector of reducedStickySelectors) {
    expect(
      styles.includes("@media (prefers-reduced-motion: reduce)") &&
        mediaReducedStickyRule.includes(selector) &&
        mediaReducedStickyRule.includes("position: static;") &&
        styles.includes(`.opendesign-app[data-motion-reduce="true"] ${selector}`) &&
        overrideReducedStickyRule.includes("position: static;"),
      `${selector} must stop using sticky positioning in reduced-motion mode`,
    );
  }

  expect(
    mediaReducedStickyRule.includes(".action-link:hover") &&
      mediaReducedStickyRule.includes("transform: none;"),
    "media reduced-motion CSS must disable action-link hover transforms",
  );
  expect(
    mediaReducedStickyRule.includes(".map-node:hover") &&
      mediaReducedStickyRule.includes("transform: translate(-50%, -50%);"),
    "media reduced-motion CSS must disable map-node hover scaling",
  );
  expect(
    styles.includes('.opendesign-app[data-motion-reduce="true"] .action-link:hover') &&
      cssRule('.opendesign-app[data-motion-reduce="true"] .action-link:hover').includes("transform: none;"),
    "URL override reduced-motion CSS must disable action-link hover transforms",
  );
  expect(
    styles.includes('.opendesign-app[data-motion-reduce="true"] .map-node:hover') &&
      cssRule('.opendesign-app[data-motion-reduce="true"] .map-node:hover').includes(
        "transform: translate(-50%, -50%);",
      ),
    "URL override reduced-motion CSS must disable map-node hover scaling",
  );
}

function scanLanguageConsistency() {
  const zhCopyStart = app.indexOf("  zh: {");
  const copyEnd = app.indexOf("\n} as const;", zhCopyStart);
  const appDefaultVoice =
    zhCopyStart === -1 || copyEnd === -1
      ? app
      : `${app.slice(0, zhCopyStart)}${app.slice(copyEnd)}`;
  const visibleSources = [appDefaultVoice, capabilities, implementation, projects].join("\n");
  const cjkMatches = [...visibleSources.matchAll(/[\u3400-\u9fff]/g)];

  expect(pkg.description.includes("Interactive comparison lab"), "package description should stay product-specific");
  expect(
    app.includes("const siteCopy =") &&
      app.includes("  en: {") &&
      app.includes("  zh: {") &&
      app.includes("locale-toggle"),
    "bilingual interface copy must stay centralized behind the language toggle",
  );
  expect(cjkMatches.length === 0, "default English product voice must not mix CJK copy outside the zh locale dictionary");
  expect(styles.includes('html[lang="en"]') || html.includes('<html lang="en">'), "document language must stay English");
}

scanFontViewportUnits();
scanFontLoading();
scanReducedMotionPreboot();
scanBorderRadii();
scanPalette();
scanContinuityStructure();
scanActionSystem();
scanContinuityPerformance();
scanLanguageConsistency();

expect(!/letter-spacing\s*:\s*-/.test(styles), "letter spacing must not be negative");
expect(!/gradient orb|bokeh|decorative orb/i.test(styles), "visual system must not rely on generic orb or bokeh decoration");

if (failures.length > 0) {
  console.error(`Design integrity audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Design integrity audit ok: typography, palette, radius, language, page continuity, and repaint-safe section cohesion checked");
