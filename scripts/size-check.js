// Fails if what a player downloads before they can play gets too big.
// "Initial" = everything except the lazily loaded cave chunks (the game chunk is
// requested right away, so it counts). Run after `npm run build`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 200; // gzipped; ~1 s on a 2 Mbps mobile connection
const dist = new URL('../dist/', import.meta.url).pathname;
const assets = join(dist, 'assets');

const files = [
  { name: 'index.html', path: join(dist, 'index.html') },
  ...readdirSync(assets)
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => ({ name: `assets/${f}`, path: join(assets, f) })),
];

let initial = 0;
let lazy = 0;
for (const f of files) {
  const kb = gzipSync(readFileSync(f.path), { level: 9 }).length / 1024;
  const isLazy = /assets\/cave/.test(f.name);
  if (isLazy) lazy += kb;
  else initial += kb;
  console.log(`${isLazy ? 'lazy   ' : 'initial'}  ${kb.toFixed(1).padStart(7)} KB  ${f.name}`);
}
console.log(`\ninitial download: ${initial.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB)`);
console.log(`lazy (caves):     ${lazy.toFixed(1)} KB gzipped`);
if (initial > BUDGET_KB) {
  console.error(`\n✗ Over budget by ${(initial - BUDGET_KB).toFixed(1)} KB`);
  process.exit(1);
}
console.log('✓ within budget');
