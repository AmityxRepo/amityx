// Derives every favicon/PWA-icon/og-image size from the SVG masters in
// assets/src/. Regenerating is one command: `node scripts/gen-assets.mjs`
// (see app/DESIGN.md §9 and .claude/skills/image-creation/SKILL.md).
import sharp from 'sharp'
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const assetsSrc = path.join(root, '..', 'assets', 'src')
const publicDir = path.join(root, '..', 'public')

async function svgToPng(svgPath, outPath, size) {
  await sharp(svgPath, { density: 384 }).resize(size, size).png().toFile(outPath)
  console.log(`  ${path.relative(process.cwd(), outPath)} (${size}x${size})`)
}

async function main() {
  const mark = path.join(assetsSrc, 'mark.svg')
  const markMaskable = path.join(assetsSrc, 'mark-maskable.svg')
  const ogSvg = path.join(assetsSrc, 'og-image.svg')

  console.log('Favicon + PWA icons:')
  copyFileSync(mark, path.join(publicDir, 'favicon.svg'))
  console.log(`  public/favicon.svg (vector)`)
  await svgToPng(mark, path.join(publicDir, 'favicon-32.png'), 32)
  await svgToPng(mark, path.join(publicDir, 'apple-touch-icon.png'), 180)
  await svgToPng(mark, path.join(publicDir, 'icon-192.png'), 192)
  await svgToPng(mark, path.join(publicDir, 'icon-512.png'), 512)
  await svgToPng(markMaskable, path.join(publicDir, 'icon-maskable-512.png'), 512)

  console.log('Social share image:')
  const ogPngPath = path.join(publicDir, 'og-image.png')
  await sharp(ogSvg, { density: 384 }).resize(1200, 630).png({ quality: 90 }).toFile(ogPngPath)
  console.log(`  public/og-image.png (1200x630)`)

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
