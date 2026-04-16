#!/usr/bin/env node
'use strict';

/**
 * Minimal PNG-to-ICO converter.
 * Creates a multi-resolution .ico by embedding PNG data directly
 * (PNG-compressed ICO, supported on Windows Vista+).
 *
 * Usage: node png2ico.cjs <16.png> <32.png> <256.png> <output.ico>
 */

const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: png2ico <png...> <output.ico>');
  process.exit(1);
}

const output = args.pop();
const pngs = args.map(f => fs.readFileSync(f));

/* ICO header: reserved(2) + type(2) + count(2) */
const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2);           // type = 1 (ICO)
header.writeUInt16LE(pngs.length, 4); // image count

/* Build directory entries */
const entries = [];
let dataOffset = 6 + 16 * pngs.length;

for (const png of pngs) {
  /* Read dimensions from PNG IHDR chunk (offset 16/20, big-endian) */
  const w = png.readUInt32BE(16);
  const h = png.readUInt32BE(20);

  const entry = Buffer.alloc(16);
  entry[0] = w >= 256 ? 0 : w;       // width  (0 = 256)
  entry[1] = h >= 256 ? 0 : h;       // height (0 = 256)
  entry[2] = 0;                       // colour palette size
  entry[3] = 0;                       // reserved
  entry.writeUInt16LE(1, 4);          // colour planes
  entry.writeUInt16LE(32, 6);         // bits per pixel
  entry.writeUInt32LE(png.length, 8); // image data size
  entry.writeUInt32LE(dataOffset, 12);// offset to image data
  entries.push(entry);
  dataOffset += png.length;
}

fs.writeFileSync(output, Buffer.concat([header, ...entries, ...pngs]));
console.log(`Created ${output} (${pngs.length} image(s))`);
