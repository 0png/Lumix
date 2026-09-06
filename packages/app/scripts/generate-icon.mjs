/** Generate all app icons from the SVG master. */
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = join(scriptDir, '..');
const sourcePath = join(appDir, 'resources', 'icon.svg');
const repositoryPngPath = join(appDir, '..', '..', 'icon.png');
const resourcePngPath = join(appDir, 'resources', 'icon.png');
const windowsIconPath = join(appDir, 'resources', 'icon.ico');
const rendererIconPath = join(appDir, 'src', 'renderer', 'src', 'assets', 'icon.png');
const windowsSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];

async function renderPng(size) {
  const pipeline = sharp(sourcePath, { density: 1200 })
    .resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 });
  if (size <= 48) pipeline.sharpen({ sigma: 0.45 });
  return pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

function createIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ png }) => png)]);
}

async function generateIcons() {
  mkdirSync(dirname(rendererIconPath), { recursive: true });
  const appPng = await renderPng(1024);
  writeFileSync(repositoryPngPath, appPng);
  writeFileSync(resourcePngPath, appPng);
  writeFileSync(rendererIconPath, appPng);
  const images = await Promise.all(
    windowsSizes.map(async (size) => ({ size, png: await renderPng(size) })),
  );
  writeFileSync(windowsIconPath, createIco(images));
  console.log(`Generated 1024 px PNG and ${windowsSizes.length}-layer Windows ICO`);
}

generateIcons().catch((error) => {
  console.error('Icon generation failed:', error);
  process.exitCode = 1;
});
