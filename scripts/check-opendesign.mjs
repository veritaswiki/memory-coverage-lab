import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const manifestPath = resolve("opendesign/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const missing = [];

for (const section of manifest.sections ?? []) {
  for (const group of section.groups ?? []) {
    for (const file of group.files ?? []) {
      const candidate = resolve("opendesign", file.path);

      if (!existsSync(candidate)) {
        missing.push(file.path);
      }
    }
  }
}

if (missing.length > 0) {
  console.error(`OpenDesign manifest references missing files:\n${missing.join("\n")}`);
  process.exit(1);
}

console.log(`OpenDesign manifest ok: ${manifest.sections.length} section(s) checked`);
