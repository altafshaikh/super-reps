/**
 * Renders SVG brand marks to PNGs for Expo (app.json).
 * Run: npm run generate:assets
 * Requires: sharp (devDependency)
 */
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const assets = join(root, 'assets');

mkdirSync(assets, { recursive: true });

/** Full-bleed app icon (iOS / general). */
const iconFullSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="bar" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#60A5FA"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="220" fill="url(#bg)"/>
  <!-- plates -->
  <circle cx="228" cy="512" r="168" fill="#334155"/>
  <circle cx="796" cy="512" r="168" fill="#334155"/>
  <circle cx="228" cy="512" r="112" fill="#475569"/>
  <circle cx="796" cy="512" r="112" fill="#475569"/>
  <!-- bar -->
  <rect x="228" y="472" width="568" height="80" rx="40" fill="url(#bar)"/>
  <!-- highlight -->
  <rect x="228" y="488" width="568" height="28" rx="14" fill="#FFFFFF" opacity="0.12"/>
  <!-- rep ticks (subtle) -->
  <path d="M512 320 L512 400 M472 360 L552 360 M472 664 L552 664 M512 624 L512 704" stroke="#64748B" stroke-width="16" stroke-linecap="round" opacity="0.5"/>
</svg>`;

/** Adaptive foreground: transparent outside, icon only (Android layers on #0F172A). */
const adaptiveForegroundSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bar2" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38BDF8"/>
      <stop offset="100%" stop-color="#60A5FA"/>
    </linearGradient>
  </defs>
  <circle cx="228" cy="512" r="168" fill="#334155"/>
  <circle cx="796" cy="512" r="168" fill="#334155"/>
  <circle cx="228" cy="512" r="112" fill="#475569"/>
  <circle cx="796" cy="512" r="112" fill="#475569"/>
  <rect x="228" y="472" width="568" height="80" rx="40" fill="url(#bar2)"/>
  <rect x="228" y="488" width="568" height="28" rx="14" fill="#FFFFFF" opacity="0.14"/>
</svg>`;

async function png(svg, size, out) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  writeFileSync(out, buf);
  console.log('wrote', out);
}

await png(iconFullSvg, 1024, join(assets, 'icon.png'));
await png(adaptiveForegroundSvg, 1024, join(assets, 'adaptive-icon.png'));
await png(iconFullSvg, 512, join(assets, 'splash-icon.png'));
await png(iconFullSvg, 64, join(assets, 'favicon.png'));

console.log('Done. Re-run after editing SVG strings in scripts/generate-brand-assets.mjs');
