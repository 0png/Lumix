/**
 * 生成帶圓角的應用程式 icon
 * 使用方式: node scripts/generate-icon.mjs
 */

import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const inputPath = join(rootDir, '../../icon.png');
const outputDir = join(rootDir, 'resources');
const outputPath = join(outputDir, 'icon.png');

// 確保 resources 目錄存在
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

// 圓角半徑（相對於 256x256 的圖片）
const size = 256;
const radius = 48; // 約 19% 的圓角

// 建立圓角遮罩 SVG
const roundedMask = Buffer.from(
  `<svg width="${size}" height="${size}">
    <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
  </svg>`
);

async function generateIcon() {
  try {
    console.log('讀取原始圖片:', inputPath);
    
    // 讀取並調整大小
    const resized = await sharp(inputPath)
      .resize(size, size, { fit: 'cover' })
      .toBuffer();

    // 套用圓角遮罩
    const rounded = await sharp(resized)
      .composite([{
        input: roundedMask,
        blend: 'dest-in'
      }])
      .png()
      .toFile(outputPath);

    console.log('圓角 icon 已生成:', outputPath);
    console.log('尺寸:', rounded.width, 'x', rounded.height);
  } catch (error) {
    console.error('生成 icon 失敗:', error);
    process.exit(1);
  }
}

generateIcon();
