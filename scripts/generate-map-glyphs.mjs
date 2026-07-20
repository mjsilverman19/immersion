/**
 * Generate MapLibre glyph PBF stacks from static Bricolage Grotesque instances.
 *
 * MapLibre cannot use the variable Google Fonts face — it needs pre-built PBF
 * ranges. We bake 12pt optical-size Medium (place labels) and SemiBold (venue
 * pins) from the upstream OFL TTFs via fontnik.
 *
 * Usage: npm run fonts:map
 */
import { execFileSync } from "node:child_process";
import { cpSync, createWriteStream, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { get } from "node:https";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pipeline } from "node:stream/promises";

const root = resolve(import.meta.dirname, "..");
const scratchRoot = join(tmpdir(), "immersion-bricolage-map-glyphs");
const requiredRanges = new Set([
  "0-255.pbf",
  "256-511.pbf",
  "512-767.pbf",
  "768-1023.pbf",
  "7680-7935.pbf",
  "8192-8447.pbf",
]);

const STACKS = [
  {
    name: "Bricolage Grotesque Medium",
    file: "BricolageGrotesque12pt-Medium.ttf",
    url: "https://raw.githubusercontent.com/ateliertriay/bricolage/main/fonts/ttf/BricolageGrotesque12pt-Medium.ttf",
  },
  {
    name: "Bricolage Grotesque SemiBold",
    file: "BricolageGrotesque12pt-SemiBold.ttf",
    url: "https://raw.githubusercontent.com/ateliertriay/bricolage/main/fonts/ttf/BricolageGrotesque12pt-SemiBold.ttf",
  },
];

async function download(url, dest) {
  await new Promise((resolvePromise, reject) => {
    get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        download(response.headers.location, dest).then(resolvePromise, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }
      pipeline(response, createWriteStream(dest)).then(resolvePromise, reject);
    }).on("error", reject);
  });
}

async function generateStack({ name, file, url }) {
  const sourceDir = join(scratchRoot, "ttf");
  const glyphScratch = join(scratchRoot, name.replace(/\s+/g, "-"));
  const output = join(root, "public/fonts", name);
  const source = join(sourceDir, file);

  mkdirSync(sourceDir, { recursive: true });
  if (!existsSync(source)) {
    console.log(`Downloading ${file}…`);
    await download(url, source);
  }

  rmSync(glyphScratch, { recursive: true, force: true });
  mkdirSync(glyphScratch, { recursive: true });
  mkdirSync(output, { recursive: true });

  execFileSync(process.execPath, [join(root, "node_modules/fontnik/bin/build-glyphs"), source, glyphScratch], {
    stdio: "inherit",
  });

  for (const range of requiredRanges) {
    const from = join(glyphScratch, range);
    if (!existsSync(from)) throw new Error(`Missing glyph range ${range} for ${name}`);
    cpSync(from, join(output, range));
  }

  console.log(`Generated ${requiredRanges.size} glyph ranges → public/fonts/${name}`);
}

rmSync(scratchRoot, { recursive: true, force: true });
mkdirSync(scratchRoot, { recursive: true });

for (const stack of STACKS) {
  await generateStack(stack);
}

// Drop orphaned legacy stacks if present.
for (const legacy of ["Inter Regular", "Noto Serif Regular"]) {
  const legacyPath = join(root, "public/fonts", legacy);
  if (existsSync(legacyPath)) {
    rmSync(legacyPath, { recursive: true, force: true });
    console.log(`Removed legacy stack ${legacy}`);
  }
}

rmSync(scratchRoot, { recursive: true, force: true });

// Sanity: expected stacks exist.
for (const stack of STACKS) {
  const dir = join(root, "public/fonts", stack.name);
  const files = readdirSync(dir);
  if (files.length < requiredRanges.size) {
    throw new Error(`${stack.name} incomplete: ${files.join(", ")}`);
  }
}

console.log("Map glyphs ready.");
