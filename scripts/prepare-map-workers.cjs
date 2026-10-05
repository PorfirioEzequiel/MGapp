const { copyFileSync, mkdirSync } = require('node:fs');
const path = require('node:path');

// CRA emits URL imports as raw assets; the ESM worker needs its sibling module.
// Copy both from the installed package for development and production builds.
const source = path.join(path.dirname(require.resolve('maplibre-gl/package.json')), 'dist');
const destination = path.join(__dirname, '..', 'public', 'maplibre');
mkdirSync(destination, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(path.join(source, file), path.join(destination, file));
}
