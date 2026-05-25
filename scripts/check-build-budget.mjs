import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const distDir = resolve("dist");
const assetDir = join(distDir, "assets");
const budgets = {
  jsGzip: 130_000,
  cssGzip: 10_000,
  totalGzip: 145_000,
};

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

if (!existsSync(distDir) || !existsSync(assetDir)) {
  console.error("Build budget failed: dist/assets is missing. Run pnpm build first.");
  process.exit(1);
}

const assets = walk(assetDir).filter((path) => [".js", ".css"].includes(extname(path)));

if (assets.length === 0) {
  console.error("Build budget failed: no JS or CSS assets found in dist/assets.");
  process.exit(1);
}

const totals = assets.reduce(
  (accumulator, path) => {
    const extension = extname(path);
    const rawBytes = statSync(path).size;
    const gzipBytes = gzipSync(readFileSync(path)).length;
    const bucket = extension === ".js" ? "js" : "css";

    accumulator[bucket].raw += rawBytes;
    accumulator[bucket].gzip += gzipBytes;
    accumulator.files.push({
      path: relative(distDir, path),
      rawBytes,
      gzipBytes,
    });

    return accumulator;
  },
  {
    js: { raw: 0, gzip: 0 },
    css: { raw: 0, gzip: 0 },
    files: [],
  },
);

const totalGzip = totals.js.gzip + totals.css.gzip;
const failures = [];

if (totals.js.gzip > budgets.jsGzip) {
  failures.push(`JS gzip ${formatBytes(totals.js.gzip)} exceeds ${formatBytes(budgets.jsGzip)}`);
}

if (totals.css.gzip > budgets.cssGzip) {
  failures.push(`CSS gzip ${formatBytes(totals.css.gzip)} exceeds ${formatBytes(budgets.cssGzip)}`);
}

if (totalGzip > budgets.totalGzip) {
  failures.push(`total JS+CSS gzip ${formatBytes(totalGzip)} exceeds ${formatBytes(budgets.totalGzip)}`);
}

if (failures.length > 0) {
  console.error(`Build budget failed:\n- ${failures.join("\n- ")}`);
  for (const file of totals.files) {
    console.error(`  ${file.path}: raw ${formatBytes(file.rawBytes)}, gzip ${formatBytes(file.gzipBytes)}`);
  }
  process.exit(1);
}

console.log(
  `Build budget ok: JS gzip ${formatBytes(totals.js.gzip)}, CSS gzip ${formatBytes(totals.css.gzip)}, total ${formatBytes(totalGzip)}`,
);
