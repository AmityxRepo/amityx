---
name: image-creation
description: Create and edit images — logos, icons, illustrations, app icon sets, favicons, og-images, and raster operations (resize, crop, compose, convert, optimize). Use for any image asset task.
---

# Image Creation & Editing

## Decision tree (in order)
1. Logos, icons, illustrations, diagrams, og-images → **author SVG by hand**. Crisp at
   any size, tiny, editable, no external service needed.
2. Existing raster needs resize/crop/compose/convert/filter → **sharp** (Node),
   **Pillow** (Python), or **ImageMagick** (CLI) — whichever the project already has.
3. Photorealistic or painterly raster from scratch → **generation API. These cost money
   per image, so they are opt-in only** (`framework/COST_POLICY.md`): use one ONLY if the
   user has already configured a key. Check env in order: `OPENAI_API_KEY` (gpt-image-1),
   `GOOGLE_API_KEY` (Imagen), `STABILITY_API_KEY`, `REPLICATE_API_TOKEN`. No key →
   `Result: blocked` naming the key, and default to the **free** fallback (an SVG
   illustration or a labeled placeholder) so the build proceeds without anyone paying.
   Never ask the user to buy a key just to proceed.

## SVG authoring rules
- Always `viewBox`, never fixed width/height attributes in the file.
- Build from simple geometry; define the palette once (`<defs>` or CSS variables).
- Optimize with `npx svgo` before shipping.
- Raster export: `sharp('in.svg', { density: 384 }).resize(512).png().toFile('out.png')`
  (the density keeps the vector crisp instead of upscaling its default raster).

## Common raster operations
```js
import sharp from "sharp";           // ESM (.mjs) — use require() only in a .cjs file
// og-image crop/resize
await sharp(src).resize(1200, 630, { fit: "cover" }).webp({ quality: 82 }).toFile(out);
// compose / watermark
await sharp(base).composite([{ input: logo, gravity: "southeast" }]).toFile(out);
// SVG → raster: raise density so the vector renders sharp, not upscaled-blurry
await sharp("in.svg", { density: 384 }).resize(512).png().toFile("out.png");
```
ImageMagick equivalent:
`magick in.png -resize 1200x630^ -gravity center -extent 1200x630 out.webp`

## App asset pipelines (generate — never hand-make sizes)
This is the framework's **brand-assets step**, sequenced right after the design system —
derive the mark and colors from `app/DESIGN.md` so favicon/og/app-icon match the app.
- **Web:** `favicon.svg` + `favicon.ico` (32) + `apple-touch-icon.png` (180) +
  og-image (1200×630) + manifest icons (192, 512).
- **Expo/mobile:** one 1024×1024 icon master → `app.json` derives platform sizes;
  adaptive-icon foreground inside the central 66% safe zone; splash tested on tall
  and short screens.
- One editable master in `assets/src/`; a script (`scripts/gen-assets.mjs`, sharp-based)
  derives every size. Regenerating must be one command.

## Optimization defaults
Photos → webp/avif quality ≈ 80 · UI raster → png only when transparency is needed,
else webp · strip metadata · targets: hero < 200 KB, everything else < 50 KB.

## Quality checklist before write-back
- [ ] Editable master in `assets/src/`; all sizes script-generated
- [ ] Legible and recognizable at the smallest size it will actually render
- [ ] File sizes within targets; formats match usage
- [ ] Filenames/paths match what the app code references

## Difficulty hints for routing
- haiku: resize/convert/optimize to given specs, rerun the asset pipeline
- sonnet: author icons/og-images in SVG, compose/watermark ops, pipeline scripts
- opus: brand/logo design from vague direction, complex multi-element illustrations
