#!/usr/bin/env node
/** grammar-hu-check.mjs, the Hungarian sidecar coverage (see scripts/grammar-overlay-check.mjs for the options). */
process.argv.push('--lang', 'hu');
await import('./grammar-overlay-check.mjs');
