// Generate all PWA/favicon assets from public/icons/icon.svg using sharp.
import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const svg = readFileSync(join(dir, 'icon.svg'))

// Maskable variant: same art but on a full-bleed background (the rounded rect
// already fills the canvas, so it doubles as maskable safely).
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png()

async function main() {
  await png(192).toFile(join(dir, 'icon-192.png'))
  await png(512).toFile(join(dir, 'icon-512.png'))
  await png(192).toFile(join(dir, 'icon-192-maskable.png'))
  await png(512).toFile(join(dir, 'icon-512-maskable.png'))
  await png(180).toFile(join(dir, 'apple-touch-icon.png'))
  await png(32).toFile(join(dir, 'favicon-32.png'))

  const ico = await pngToIco([
    await png(16).toBuffer(),
    await png(32).toBuffer(),
    await png(48).toBuffer(),
  ])
  writeFileSync(join(dir, 'favicon.ico'), ico)

  console.log('Icons generated in public/icons/')
}
main().catch((e) => { console.error(e); process.exit(1) })
