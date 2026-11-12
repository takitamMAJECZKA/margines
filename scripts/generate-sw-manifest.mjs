import { readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assets = new Set();

async function walk(directory, urlPrefix) {
  let entries;

  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, `${urlPrefix}${entry.name}/`);
      continue;
    }

    const info = await stat(fullPath);
    if (info.size > 4 * 1024 * 1024) continue;

    const url = `${urlPrefix}${entry.name}`.replace(/\\/g, "/");
    assets.add(url);
  }
}

await walk(path.join(root, ".next", "static"), "/_next/static/");
await walk(path.join(root, "public", "icons"), "/icons/");

const manifest = {
  version:
    process.env.npm_package_version ??
    String(Date.now()),
  generatedAt: new Date().toISOString(),
  assets: [...assets].sort(),
};

await writeFile(
  path.join(root, "public", "sw-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`sw-manifest: ${manifest.assets.length} assets`);
