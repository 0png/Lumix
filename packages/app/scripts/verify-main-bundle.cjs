const { readFileSync } = require('node:fs');
const { builtinModules } = require('node:module');
const { resolve } = require('node:path');

const bundlePath = resolve(__dirname, '../out/main/index.js');
const source = readFileSync(bundlePath, 'utf8');
const builtinNames = new Set(
  builtinModules.flatMap((name) => [name, name.replace(/^node:/, '')])
);
const imports = new Set(
  Array.from(source.matchAll(/require\(["']([^"']+)["']\)/g), (match) => match[1])
);
const allowedExternalModules = new Set(['electron', '@electron-internal/extract-zip']);
const unexpected = Array.from(imports)
  .filter(
    (name) =>
      !allowedExternalModules.has(name) &&
      !name.startsWith('node:') &&
      !builtinNames.has(name)
  )
  .sort();

if (unexpected.length > 0) {
  console.error(`Unexpected external modules in main bundle: ${unexpected.join(', ')}`);
  process.exit(1);
}

console.log(`Verified main bundle: ${imports.size} imports are built-in or explicitly allowed.`);
