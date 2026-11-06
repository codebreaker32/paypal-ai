// Draws the PWA icons (spec §4c) from the brand mark: public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
// and src/app/apple-icon.png (180 px; Next adds the apple-touch-icon link for it).
//
// Run: npx tsx scripts/make-icons.ts public/brand/mark.svg '#ffffff'
//      npx tsx scripts/make-icons.ts <mark.svg> <background hex> [scale for "any" icons, default 0.84] [maskable scale, default 0.58]
// Scales are of the mark's 64-unit box (its art is 56 units, 4..60). The mark is centred on a white tile: the full-colour
// awning and print need white behind them. At 0.84 the art fills about 74% of the "any" icons. The maskable icon's art
// (scale 0.58) keeps its corners about 4% inside the 80% safe circle, so Android's circle or squircle crop never cuts
// the awning. iOS rounds the 180 px icon's corners itself.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

async function tile(mark: Buffer, size: number, bg: string, scale: number, radius = 0): Promise<Buffer> {
  const inner = Math.round(size * scale);
  const art = await sharp(mark, { density: 1200 }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const base = radius
    ? Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/></svg>`)
    : Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/></svg>`);
  return sharp(base).composite([{ input: art, gravity: 'centre' }]).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const [svgPath, bg, scaleArg, maskArg] = process.argv.slice(2);
  if (!svgPath || !/^#[0-9a-fA-F]{6}$/.test(bg ?? '')) {
    console.error('Usage: npx tsx scripts/make-icons.ts <mark.svg> <#rrggbb background> [scale] [maskable scale]');
    process.exit(2);
  }
  const mark = fs.readFileSync(svgPath);
  const scale = scaleArg ? Number(scaleArg) : 0.84;
  const maskScale = maskArg ? Number(maskArg) : 0.58;
  const root = path.resolve(__dirname, '..');
  const icons = path.join(root, 'public', 'icons');
  fs.mkdirSync(icons, { recursive: true });
  const out: [string, Buffer][] = [
    [path.join(icons, 'icon-192.png'), await tile(mark, 192, bg, scale, 0)],
    [path.join(icons, 'icon-512.png'), await tile(mark, 512, bg, scale, 0)],
    [path.join(icons, 'icon-maskable-512.png'), await tile(mark, 512, bg, maskScale)],
    [path.join(root, 'src', 'app', 'apple-icon.png'), await tile(mark, 180, bg, scale)],
  ];
  for (const [file, buf] of out) {
    fs.writeFileSync(file, buf);
    console.log(`${path.relative(root, file)}  ${buf.length} bytes`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
