---
name: video-creation
description: Create and edit video — trim/concat/resize/overlay/subtitles/compress with ffmpeg, programmatic videos with Remotion, slideshows, GIFs, demo recordings. Use for any video or motion asset task.
---

# Video Creation & Editing

## Decision tree (in order)
1. Edit existing footage (trim, join, resize, overlay, audio, subtitles, convert,
   compress) → **ffmpeg**.
2. Programmatic / data-driven video (text animations, promo templates, charts over time)
   → **Remotion** (React components rendered to mp4).
3. Slideshow from images + audio → ffmpeg concat; Remotion when animated transitions matter.
4. Product demo / screen capture → record (OS tools; Playwright `video: 'on'` for web
   apps), then post-process with ffmpeg.
5. Generative video from a prompt → **paid API, opt-in only** (`framework/COST_POLICY.md`):
   use ONLY if the user already has a key configured (`GOOGLE_API_KEY` → Veo,
   `RUNWAY_API_SECRET`, `REPLICATE_API_TOKEN`). No key → `Result: blocked` naming the key,
   and default to the **free** Remotion/ffmpeg-built alternative. Never require the user to
   buy credits to proceed.

## ffmpeg recipes (covers ~90% of tasks)
| Task | Command |
|---|---|
| Trim (no re-encode) | `ffmpeg -ss 00:00:05 -to 00:00:20 -i in.mp4 -c copy out.mp4` |
| Concat same-codec clips | `ffmpeg -f concat -safe 0 -i list.txt -c copy out.mp4` |
| Resize to 1080p | `ffmpeg -i in.mp4 -vf scale=-2:1080 -c:a copy out.mp4` |
| Compress for sharing | `ffmpeg -i in.mp4 -c:v libx264 -crf 23 -preset slow -c:a aac -b:a 128k out.mp4` |
| Watermark overlay | `ffmpeg -i in.mp4 -i logo.png -filter_complex "overlay=W-w-24:H-h-24" out.mp4` |
| Burn in subtitles | `ffmpeg -i in.mp4 -vf subtitles=subs.srt out.mp4` |
| Replace audio | `ffmpeg -i in.mp4 -i music.m4a -map 0:v -map 1:a -shortest -c:v copy out.mp4` |
| High-quality GIF | `ffmpeg -i in.mp4 -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` |
| Images → video | `ffmpeg -framerate 1/3 -i img%03d.png -c:v libx264 -pix_fmt yuv420p out.mp4` |
| Thumbnail frame | `ffmpeg -ss 00:00:02 -i in.mp4 -frames:v 1 thumb.jpg` |

Windows notes: `winget install Gyan.FFmpeg`; glob inputs unsupported — use numbered
sequences (`img%03d.png`).

## Remotion workflow
`npx create-video@latest` → compositions in `src/` → `npx remotion render <CompId> out.mp4`.
Use for text/logo animation, branded templates, data-driven scenes (data as props per
render). Keep scenes as reusable components; derive ALL timing from `fps` ×
`durationInFrames` — never wall-clock time.

## Subtitles
Keep subtitles as sidecar `.srt` (from the script, or `whisper in.mp4 --model base
--output_format srt` if available); burn in only when the destination requires it.

## Output defaults
Web/social: h264 mp4, `-pix_fmt yuv420p`, even dimensions, `-movflags +faststart`.
Verify by playing the file or `ffprobe` (duration + streams) before returning — a render
that completes is not yet a render that works.

## Quality checklist before write-back
- [ ] Plays in a stock player (yuv420p, faststart, even dimensions)
- [ ] Audio levels sane — no clipping; music under voice
- [ ] Clean first and last frames (no stray black flash)
- [ ] Size fits the destination; source/project files kept in `assets/src/`

## Difficulty hints for routing
- haiku: single ffmpeg operations to given specs (trim, convert, compress, thumbnail)
- sonnet: multi-step pipelines, slideshows, subtitle work, simple Remotion compositions
- opus: full promo design from vague direction, complex Remotion motion design
