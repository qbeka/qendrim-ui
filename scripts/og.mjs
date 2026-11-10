// Draws the share card for the project page: 1200 by 630, plain paper, the name, the one
// sentence, and the panel leaving its trace across a sheet. The art is drawn here from the same
// idea as the page, with nothing measured in it, so that the card can be rebuilt without a server.
// Usage: node scripts/og.mjs [out file]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = join(import.meta.dirname, '..');
const out = process.argv[2] ?? join(ROOT, 'apps/docs/public/og.png');
const font = (name) => `data:font/woff2;base64,${readFileSync(join(ROOT, 'apps/docs/src/fonts', name)).toString('base64')}`;

// The panel on its way from a card to a sheet: where it was at even steps, and where it is.
const START = { x: 724, y: 44, w: 180, h: 124, r: 18 };
const END = { x: 884, y: 134, w: 244, h: 408, r: 26 };
const STEPS = 7;
const ease = (t) => 1 - (1 - t) ** 3;
const at = (t) => {
  const k = ease(t);
  const mix = (a, b) => a + (b - a) * k;
  return { x: mix(START.x, END.x), y: mix(START.y, END.y), w: mix(START.w, END.w), h: mix(START.h, END.h), r: mix(START.r, END.r) };
};
const frames = Array.from({ length: STEPS }, (_, index) => at(index / STEPS));
const caret = (box) => ({ x: box.x + box.w * 0.8, y: box.y + 70 });
const ghosts = frames.map((box, index) => `<rect x="${box.x.toFixed(1)}" y="${box.y.toFixed(1)}" width="${box.w.toFixed(1)}" height="${box.h.toFixed(1)}" rx="${box.r.toFixed(1)}" fill="none" stroke="#111511" stroke-opacity="${(0.1 + 0.2 * (index / STEPS)).toFixed(2)}" stroke-width="2"/>`).join('');
const path = [...frames, END].map(caret).map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
const dots = frames.map(caret).map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="5" fill="#1d3a2a"/>`).join('');

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: 'Geist Serif'; src: url('${font('GeistSerif-Regular.woff2')}') format('woff2'); }
@font-face { font-family: 'Geist'; src: url('${font('Geist-Medium.woff2')}') format('woff2'); font-weight: 500; }
html, body { margin: 0; }
body { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #ffffff; color: #111511; font-synthesis: none; -webkit-font-smoothing: antialiased; }
h1 { position: absolute; left: 72px; top: 166px; margin: 0; font: 400 132px/1 'Geist Serif', serif; letter-spacing: -0.045em; white-space: nowrap; }
p { position: absolute; left: 76px; top: 328px; width: 540px; margin: 0; color: #444944; font: 400 46px/56px 'Geist Serif', serif; letter-spacing: -0.02em; }
svg { position: absolute; inset: 0; }
text { font: 500 24px 'Geist', sans-serif; fill: #535753; }
</style></head><body>
<h1>Qendrim UI</h1>
<p>React components that keep up when you change your mind</p>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#111511" stroke-opacity=".34" stroke-width="2" fill="none">
    <path d="M${END.x} 578H${END.x + 80}M${END.x + END.w - 80} 578H${END.x + END.w}M${END.x} 564V592M${END.x + END.w} 564V592"/>
  </g>
  <text x="${END.x + END.w / 2}" y="587" text-anchor="middle">${END.w}</text>
  ${ghosts}
  <rect x="${END.x}" y="${END.y}" width="${END.w}" height="${END.h}" rx="${END.r}" fill="#ffffff" stroke="#111511" stroke-opacity=".3" stroke-width="2"/>
  <path d="${path}" fill="none" stroke="#1d3a2a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  ${dots}
  <circle cx="${END.x + 38}" cy="${END.y + 40}" r="11" fill="none" stroke="#1d3a2a" stroke-width="3"/>
  <path d="M${END.x + 38} ${END.y + 33}a7 7 0 0 1 0 14z" fill="#1d3a2a"/>
  <rect x="${END.x + 28}" y="${END.y + 62}" width="156" height="16" rx="5" fill="#111511"/>
  <rect x="${(END.x + END.w * 0.8 - 2).toFixed(1)}" y="${END.y + 54}" width="4" height="32" rx="2" fill="#1d3a2a"/>
  <g fill="#111511" fill-opacity=".16">
    <rect x="${END.x + 28}" y="${END.y + 104}" width="188" height="10" rx="5"/>
    <rect x="${END.x + 28}" y="${END.y + 128}" width="172" height="10" rx="5"/>
    <rect x="${END.x + 66}" y="${END.y + 249}" width="130" height="10" rx="5"/>
    <rect x="${END.x + 66}" y="${END.y + 295}" width="104" height="10" rx="5"/>
    <rect x="${END.x + 66}" y="${END.y + 341}" width="148" height="10" rx="5"/>
  </g>
  <path d="M${END.x + 28} ${END.y + 184}H${END.x + END.w - 28}" stroke="#111511" stroke-opacity=".14" stroke-width="2"/>
  <rect x="${END.x + 28}" y="${END.y + 240}" width="26" height="26" rx="8" fill="#1d3a2a"/>
  <path d="M${END.x + 35} ${END.y + 253.5}l4.5 4.5 8-9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <g fill="none" stroke="#111511" stroke-opacity=".4" stroke-width="2">
    <rect x="${END.x + 29}" y="${END.y + 287}" width="24" height="24" rx="7"/>
    <rect x="${END.x + 29}" y="${END.y + 333}" width="24" height="24" rx="7"/>
  </g>
</svg>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: out, type: 'png' });
await browser.close();
console.log(`Wrote ${out}`);
