import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();

function iconSvg({ padding = 0 } = {}) {
  const scale = 1 - padding * 2;
  const transform = `translate(256 256) scale(${scale}) translate(-256 -256)`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#24483b"/>
  <g transform="${transform}">
    <path d="M104 170C178 146 232 152 256 182V366C232 336 178 330 104 354V170Z" fill="#f8f2e6"/>
    <path d="M408 170C334 146 280 152 256 182V366C280 336 334 330 408 354V170Z" fill="#f8f2e6" fill-opacity="0.72"/>
    <path d="M256 182V366" stroke="#24483b" stroke-width="9" stroke-linecap="round"/>
    <path d="M146 205C178 198 204 201 226 213M146 246C178 239 204 242 226 254M146 287C178 280 204 283 226 295" stroke="#24483b" stroke-opacity="0.38" stroke-width="8" stroke-linecap="round"/>
    <path d="M286 246C310 234 338 230 366 236M286 287C310 275 338 271 366 277" stroke="#24483b" stroke-opacity="0.24" stroke-width="8" stroke-linecap="round"/>
    <circle cx="374" cy="398" r="24" fill="#d9a441"/>
  </g>
</svg>`;
}

async function writePng(relativePath, size, options = {}) {
  const output = path.join(root, relativePath);
  await mkdir(path.dirname(output), { recursive: true });
  await sharp(Buffer.from(iconSvg(options)))
    .resize(size, size, { fit: "cover" })
    .png({ compressionLevel: 9 })
    .toFile(output);
  console.log(`icon: ${relativePath} (${size}x${size})`);
}

await writePng("public/icons/icon-192.png", 192);
await writePng("public/icons/icon-512.png", 512);
await writePng("public/icons/maskable-512.png", 512, { padding: 0.06 });
await writePng("public/icons/apple-touch-icon.png", 180, { padding: 0.04 });
await writePng("src/app/icon.png", 128);
await writePng("src/app/apple-icon.png", 180, { padding: 0.04 });
