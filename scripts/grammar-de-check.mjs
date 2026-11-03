#!/usr/bin/env node
/** grammar-de-check.mjs, the German sidecar coverage (see scripts/grammar-overlay-check.mjs for the options). */
process.argv.push('--lang', 'de');
await import('./grammar-overlay-check.mjs');
