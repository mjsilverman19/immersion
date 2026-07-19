import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const source = join(root, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff");
const output = join(root, "public/fonts/Inter Regular");
const scratch = join(tmpdir(), "immersion-inter-map-glyphs");
const requiredRanges = new Set(["0-255.pbf", "256-511.pbf", "512-767.pbf", "768-1023.pbf", "7680-7935.pbf", "8192-8447.pbf"]);

if (!existsSync(source)) throw new Error("Install dependencies before generating map glyphs.");
rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [join(root, "node_modules/fontnik/bin/build-glyphs"), source, scratch], { stdio: "inherit" });
for (const file of readdirSync(scratch)) {
  if (requiredRanges.has(file)) cpSync(join(scratch, file), join(output, file));
}
rmSync(scratch, { recursive: true, force: true });
console.log(`Generated ${requiredRanges.size} Inter glyph ranges in ${output}`);
