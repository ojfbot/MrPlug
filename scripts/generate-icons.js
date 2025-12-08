#!/usr/bin/env node

/**
 * Generate simple placeholder icons for the extension
 * Replace these with professionally designed icons before publishing
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function generateSVGIcon(size) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#0f62fe" rx="${size * 0.2}"/>
  <text
    x="50%"
    y="50%"
    dominant-baseline="middle"
    text-anchor="middle"
    font-family="Arial, sans-serif"
    font-size="${size * 0.6}"
    font-weight="bold"
    fill="white">M</text>
</svg>`;
}

const sizes = [16, 48, 128];
const iconsDir = join(__dirname, '..', 'public', 'icons');

sizes.forEach(size => {
  const svg = generateSVGIcon(size);
  const filename = join(iconsDir, `icon-${size}.svg`);
  writeFileSync(filename, svg);
  console.log(`Generated: icon-${size}.svg`);
});

console.log('\nPlaceholder icons generated!');
console.log('For production, replace these SVGs with professionally designed icons.');
console.log('Convert to PNG using a tool like Inkscape, ImageMagick, or an online converter.');
