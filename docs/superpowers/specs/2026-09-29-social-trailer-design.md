# Social trailer (9:16) generated with Seedance 2.0 — design

Date: 2026-09-29
Branch: `feature/social-trailer`
Status: approved in conversation, awaiting written review

## Goal

A vertical clip of about 13 seconds (9:16, 720×1280) for Instagram Reels, TikTok and
YouTube Shorts that announces „Drumul spre Unire" for the 1 December 2026 launch. The clip
opens with an AI‑reconstructed 1918 scene and dissolves into the game's painted map, with
Romanian text burned in locally. Nothing in the game itself changes.

## Creative

Two generated shots, stitched locally, text added with ffmpeg.

### Shot 1 — 0 to 6 s, text‑to‑video

Dawn, 1 December 1918, the plateau west of the Alba Iulia fortress. Long lines of peasants
in sheepskin coats and women in woven headscarves walk through frost toward the star‑shaped
Vauban walls, tricolour flags moving above them. Breath in cold air, low winter sun, 16 mm
film grain. Slow forward dolly at head height, then a gentle rise. Audio on: wind,
footsteps, distant church bells.

Negative constraints in the prompt: no modern buildings, no Coronation Cathedral, no
obelisk, no modern uniforms or insignia, no visible text, logos, subtitles or watermarks,
no duplicated faces, natural motion, no deformation.

### Shot 2 — 6 to 13 s, image‑to‑video

Start frame: `assets/map-1918.jpg` served from the public GitHub repo. Slow push‑in toward
the fortress while tiny figures and a steam train's smoke move along the roads and warm
lamplight glows on the field. `fixed_lens: false`, no text. Ends on a hold so the call to
action can sit over it.

### Text (ffmpeg drawtext, Cormorant SC for titles, Alegreya Sans for sub‑lines)

| Time | Line 1 | Line 2 |
|------|--------|--------|
| 1.0–5.0 s | 1 Decembrie 1918 | 1.228 de delegați. O singură zi. |
| 8.0–13.0 s | Drumul spre Unire | Joacă istoria. Din 1 Decembrie 2026. |

Crossfade 0.6 s between shots. Fade to black over the last 0.5 s.

## Pipeline

### Hosting

Create the public repo `luciancramba/drumul-spre-unire`, add it as `origin`, push `main`.
Shot 2 references
`https://raw.githubusercontent.com/luciancramba/drumul-spre-unire/main/assets/map-1918.jpg`.
The push happens only after Lucian approves it explicitly in chat.

### Files, all under `tools/trailer/`

- `prompts.json` — array of shot definitions: `id`, `mode`, `prompt`, `duration`,
  `aspect_ratio`, `resolution`, `quality_tier`, `generate_audio`, `fixed_lens`, optional
  `image_url`. Editable without touching code.
- `generate.mjs` — Node 20 script, no dependencies. Reads `SEEDANCE_API_KEY` from the
  environment. For each shot: computes an Idempotency‑Key as `dsu-<id>-<sha256 of the
  shot JSON, first 16 hex>`, submits `POST /api/v1/video/seedance2`, saves the task id in
  `out/tasks.json`, polls `GET /api/v1/tasks/{id}` every 10 s, downloads `video_url` to
  `out/<id>.mp4`. Skips a shot whose MP4 already exists. Flags: `--dry-run` (print request
  bodies and check the map URL with a HEAD request, spend nothing), `--only <id>`.
- `assemble.sh` — ffmpeg: scale/crop both clips to 720×1280, `xfade` 0.6 s, `drawtext`
  overlays with fade in/out, final fade to black, output `out/trailer-9x16.mp4` (H.264,
  AAC, 30 fps). Downloads Cormorant SC and Alegreya Sans TTFs into `fonts/` on first run.
- `README.md` — the two commands, cost note, how to regenerate a shot.

### Git

`tools/trailer/out/` and `tools/trailer/fonts/` are ignored. The finished MP4 is a local
deliverable; it is not committed unless decided later.

## Cost

Seedance 2.0, quality tier mini (the standard tier needs a paid purchase on the account; switched on 2026-09-29), 720p, audio on. The public docs quote about 30 credits
for a 5 s clip as an illustrative figure, so two clips of 6 s and 7 s should cost roughly
70–90 credits. The script prints the real `credits_used` from every submit response. A
dry run precedes any paid call.

## Errors

- 401: stop, say the key is invalid.
- 402 insufficient_credits: stop, print `required_credits` / `available_credits` when the
  API returns them.
- 429 rate_limited and 503 service_busy: honour `Retry-After` (default 15 s), retry up to
  3 times, then stop.
- 409 idempotency_conflict: the earlier submission is still running; reuse the task id
  from `out/tasks.json` and poll it.
- Task `failed`: print `error`, exit non‑zero, leave other shots untouched.
- Preflight failures (missing key, map URL not reachable for shot 2, ffmpeg missing for
  assembly): fail before any paid call with a one‑line message.

## Testing

1. `node tools/trailer/generate.mjs --dry-run` — prints both requests, no credits spent.
2. `--only shot1`, review in the browser pane, adjust the prompt if needed (a changed
   prompt changes the idempotency key, so a rerun is a deliberate new generation).
3. Push `main` (with approval), verify the map URL returns 200 and `image/jpeg`, then
   `--only shot2`.
4. `tools/trailer/assemble.sh`, review the output at 720×1280, confirm diacritics render.
5. Preflight: the repo has no `package.json`, so there is no `npm test`/`lint`/`build`.
   Run `node --check tools/trailer/generate.mjs` and `shellcheck tools/trailer/assemble.sh`
   if shellcheck is installed, and state the result plainly.

## Out of scope

Landscape trailer, real game footage, the in‑game ending cinematic, Seedance 2.5.

## Outcome (2026-09-29)

The Seedance account had no usable credits (standard tier: purchase_required; mini tier:
insufficient_credits), so the first cut was produced without the API. Shot 2 was generated
in ChatGPT as image-to-video from `tools/trailer/ref/map-portrait.jpg` (400×736, 6 s,
upscaled in assembly). Shot 1 is a ChatGPT still (`tools/trailer/ref/shot1-still.webp`)
animated by `tools/trailer/animate-still.sh` with a slow push-in. Titles are rendered with
Pillow (`titles.py`) and overlaid, because the Homebrew ffmpeg build lacks `drawtext`.
The Seedance pipeline (`generate.mjs`) stays in place for when credits are available.
