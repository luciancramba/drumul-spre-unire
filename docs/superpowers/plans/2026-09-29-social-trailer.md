# Social Trailer (9:16, Seedance 2.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `tools/trailer/out/trailer-9x16.mp4`, a ~12.4 s vertical social clip: an AI‑generated 1918 dawn scene that crossfades into the game's painted map, with Romanian titles burned in.

**Architecture:** A dependency‑free Node 20 script submits two Seedance 2.0 jobs (one text‑to‑video, one image‑to‑video from a portrait crop of the map hosted on GitHub), polls them and downloads the MP4s. Pure helpers (request body, idempotency key, retry policy, error text) live in `lib.mjs` and are unit‑tested with `node:test`. A bash script drives ffmpeg to crossfade, burn text with the game's fonts and encode the final clip.

**Tech Stack:** Node 20 (`fetch`, `node:test`, `node:crypto`), bash, ffmpeg 8, GitHub CLI (`gh`), Seedance 2.0 public API.

Spec: `docs/superpowers/specs/2026-09-29-social-trailer-design.md`.

**Rules that apply throughout**
- Work on branch `feature/social-trailer` (already created). Never commit on `main`.
- Never print `SEEDANCE_API_KEY`. It loads from `~/.seedance_key` via `~/.zshrc`.
- Every paid call is preceded by a dry run. Tasks 6 and 7 spend credits; each says so.
- Task 5 pushes to GitHub. It requires Lucian's explicit "yes" in chat first.

---

## File structure

| Path | Responsibility |
|------|----------------|
| `tools/trailer/lib.mjs` | Pure helpers: `buildBody`, `idempotencyKey`, `retryDelay`, `describeError`, `API_BASE`. No I/O. |
| `tools/trailer/lib.test.mjs` | `node:test` unit tests for `lib.mjs`. |
| `tools/trailer/generate.mjs` | CLI: reads `prompts.json`, submits, polls, downloads. Flags `--dry-run`, `--only <id>`. |
| `tools/trailer/prompts.json` | The two shot definitions. |
| `tools/trailer/make-ref.sh` | Crops `assets/map-1918.jpg` into the 9:16 start frame `tools/trailer/ref/map-portrait.jpg`. |
| `tools/trailer/ref/map-portrait.jpg` | Committed output of `make-ref.sh`, served raw from GitHub for shot 2. |
| `tools/trailer/assemble.sh` | ffmpeg: scale, crossfade, drawtext, fade, encode `out/trailer-9x16.mp4`. Downloads fonts on first run. |
| `tools/trailer/README.md` | How to run, what it costs, how to regenerate a shot. |
| `.gitignore` | Add `tools/trailer/out/` and `tools/trailer/fonts/`. |

---

### Task 1: Pure helpers with tests

**Files:**
- Create: `tools/trailer/lib.mjs`
- Create: `tools/trailer/lib.test.mjs`
- Modify: `.gitignore`

- [ ] **Step 1: Add ignore rules**

Append to `.gitignore`:

```
tools/trailer/out/
tools/trailer/fonts/
```

- [ ] **Step 2: Write the failing tests**

Create `tools/trailer/lib.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBody, idempotencyKey, retryDelay, describeError, API_BASE } from './lib.mjs';

const shot = {
  id: 'shot1',
  note: 'ignored by the API',
  mode: 'text-to-video',
  quality_tier: 'standard',
  prompt: 'A cinematic dawn scene',
  aspect_ratio: '9:16',
  duration: 6,
  resolution: '720p',
  generate_audio: true,
  fixed_lens: false,
};

test('API_BASE is the public v1 base', () => {
  assert.equal(API_BASE, 'https://www.seedance2ai.io/api/v1');
});

test('buildBody keeps only API fields and stringifies duration', () => {
  const body = buildBody(shot);
  assert.deepEqual(body, {
    mode: 'text-to-video',
    quality_tier: 'standard',
    prompt: 'A cinematic dawn scene',
    aspect_ratio: '9:16',
    duration: '6',
    resolution: '720p',
    generate_audio: true,
    fixed_lens: false,
  });
  assert.equal('id' in body, false);
  assert.equal('note' in body, false);
});

test('buildBody rejects a short prompt', () => {
  assert.throws(() => buildBody({ ...shot, prompt: 'no' }), /prompt/);
});

test('buildBody requires image_url for image-to-video', () => {
  assert.throws(() => buildBody({ ...shot, mode: 'image-to-video' }), /image_url/);
  const ok = buildBody({ ...shot, mode: 'image-to-video', image_url: 'https://x.test/a.jpg' });
  assert.equal(ok.image_url, 'https://x.test/a.jpg');
});

test('idempotencyKey is stable and changes with the prompt', () => {
  const a = idempotencyKey(shot);
  const b = idempotencyKey({ ...shot });
  const c = idempotencyKey({ ...shot, prompt: 'A different prompt' });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^dsu-shot1-[0-9a-f]{16}$/);
});

test('retryDelay honours Retry-After for 429 and 503, else null', () => {
  assert.equal(retryDelay(429, '7', 1), 7000);
  assert.equal(retryDelay(503, null, 1), 15000);
  assert.equal(retryDelay(429, '7', 3), null);
  assert.equal(retryDelay(402, '7', 1), null);
  assert.equal(retryDelay(500, null, 1), null);
});

test('describeError formats code, message and credit details', () => {
  assert.equal(
    describeError(401, { error: { code: 'unauthorized', message: 'Invalid API key' } }),
    'HTTP 401 unauthorized: Invalid API key',
  );
  assert.equal(
    describeError(402, { error: { code: 'insufficient_credits', message: 'Not enough' }, required_credits: 60, available_credits: 12 }),
    'HTTP 402 insufficient_credits: Not enough (required 60, available 12)',
  );
  assert.equal(describeError(500, null), 'HTTP 500: unknown error');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node --test tools/trailer/`
Expected: failures with `Cannot find module '.../lib.mjs'`.

- [ ] **Step 4: Implement `lib.mjs`**

Create `tools/trailer/lib.mjs`:

```js
import { createHash } from 'node:crypto';

export const API_BASE = 'https://www.seedance2ai.io/api/v1';

// Field order is fixed so JSON.stringify(body) is deterministic for the idempotency key.
const API_FIELDS = [
  'mode', 'quality_tier', 'channel', 'prompt', 'aspect_ratio', 'duration',
  'resolution', 'image_url', 'end_image_url', 'media_urls',
  'generate_audio', 'fixed_lens', 'seed',
];

export function buildBody(shot) {
  const body = {};
  for (const k of API_FIELDS) if (shot[k] !== undefined) body[k] = shot[k];
  if (typeof body.duration === 'number') body.duration = String(body.duration);
  if (typeof body.prompt !== 'string' || body.prompt.length < 3) {
    throw new Error(`shot ${shot.id}: prompt must be at least 3 characters`);
  }
  if (body.mode === 'image-to-video' && !body.image_url) {
    throw new Error(`shot ${shot.id}: image-to-video needs image_url`);
  }
  return body;
}

export function idempotencyKey(shot) {
  const hash = createHash('sha256').update(JSON.stringify(buildBody(shot))).digest('hex');
  return `dsu-${shot.id}-${hash.slice(0, 16)}`;
}

// Returns milliseconds to wait before retrying, or null when the call must not be retried.
export function retryDelay(status, retryAfterHeader, attempt, maxAttempts = 3) {
  if (attempt >= maxAttempts) return null;
  if (status !== 429 && status !== 503) return null;
  const seconds = Number(retryAfterHeader);
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 15000;
}

export function describeError(status, payload) {
  const err = (payload && payload.error) || {};
  const code = err.code ? ` ${err.code}` : '';
  let text = `HTTP ${status}${code}: ${err.message || 'unknown error'}`;
  const required = payload?.required_credits ?? err.required_credits;
  const available = payload?.available_credits ?? err.available_credits;
  if (required !== undefined) text += ` (required ${required}, available ${available})`;
  return text;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --test tools/trailer/`
Expected: `# pass 7`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/trailer/lib.mjs tools/trailer/lib.test.mjs
git commit -m "feat: add seedance helpers for trailer generation"
```

---

### Task 2: The `generate.mjs` CLI

**Files:**
- Create: `tools/trailer/generate.mjs`

- [ ] **Step 1: Write the script**

Create `tools/trailer/generate.mjs`:

```js
#!/usr/bin/env node
// Submits the shots in prompts.json to Seedance 2.0, polls them and downloads the MP4s.
// Usage: node tools/trailer/generate.mjs [--dry-run] [--only <shotId>]
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { API_BASE, buildBody, idempotencyKey, retryDelay, describeError } from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'out');
const TASKS_FILE = path.join(OUT, 'tasks.json');
const POLL_MS = 10_000;

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlyAt = args.indexOf('--only');
const only = onlyAt >= 0 ? args[onlyAt + 1] : null;

const KEY = process.env.SEEDANCE_API_KEY;
if (!KEY) fail('SEEDANCE_API_KEY is not set. Put the key in ~/.seedance_key and open a new shell.');

const allShots = JSON.parse(await readFile(path.join(HERE, 'prompts.json'), 'utf8'));
const shots = allShots.filter((s) => !only || s.id === only);
if (shots.length === 0) fail(`no shot with id "${only}" in prompts.json`);

await mkdir(OUT, { recursive: true });
const tasks = await readJson(TASKS_FILE, {});

for (const shot of shots) {
  const mp4 = path.join(OUT, `${shot.id}.mp4`);
  if (await exists(mp4)) {
    console.log(`${shot.id}: ${rel(mp4)} already exists, skipping (delete it to regenerate)`);
    continue;
  }
  const body = buildBody(shot);
  const idem = idempotencyKey(shot);
  if (body.image_url) await checkImageUrl(body.image_url);

  if (dryRun) {
    console.log(`${shot.id}: would POST ${API_BASE}/video/seedance2 with Idempotency-Key ${idem}`);
    console.log(JSON.stringify(body, null, 2));
    continue;
  }

  let taskId = tasks[idem];
  if (taskId) {
    console.log(`${shot.id}: resuming task ${taskId}`);
  } else {
    taskId = await submit(shot.id, body, idem);
    tasks[idem] = taskId;
    await writeFile(TASKS_FILE, JSON.stringify(tasks, null, 2));
  }

  const task = await waitForTask(shot.id, taskId);
  await download(task.output.video_url, mp4);
  console.log(`${shot.id}: saved ${rel(mp4)} (credits used ${task.credits_used}, refunded ${task.credits_refunded ?? 0})`);
}

async function submit(label, body, idem) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${API_BASE}/video/seedance2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idem },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => null);
    if (res.ok && payload?.id) {
      console.log(`${label}: submitted ${payload.id}, credits used ${payload.credits_used}`);
      return payload.id;
    }
    const delay = retryDelay(res.status, res.headers.get('retry-after'), attempt);
    if (delay === null) fail(`${label}: ${describeError(res.status, payload)}`);
    console.log(`${label}: ${describeError(res.status, payload)}; retrying in ${delay / 1000}s`);
    await sleep(delay);
  }
}

async function waitForTask(label, taskId) {
  for (;;) {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, { headers: { Authorization: `Bearer ${KEY}` } });
    const task = await res.json().catch(() => null);
    if (!res.ok) {
      const delay = retryDelay(res.status, res.headers.get('retry-after'), 1);
      if (delay === null) fail(`${label}: ${describeError(res.status, task)}`);
      await sleep(delay);
      continue;
    }
    if (task.status === 'completed') return task;
    if (task.status === 'failed') fail(`${label}: task ${taskId} failed: ${JSON.stringify(task.error)}`);
    console.log(`${label}: ${task.status}…`);
    await sleep(POLL_MS);
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok || !res.body) fail(`download failed: HTTP ${res.status} for ${url}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
}

async function checkImageUrl(url) {
  const res = await fetch(url, { method: 'HEAD' });
  const type = res.headers.get('content-type') || '';
  if (!res.ok || !type.startsWith('image/')) {
    fail(`reference image is not reachable as an image: ${url} (HTTP ${res.status}, ${type || 'no content-type'})`);
  }
  console.log(`reference ok: ${url} (${type})`);
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, 'utf8')); } catch { return fallback; }
}
async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}
function rel(file) { return path.relative(process.cwd(), file); }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function fail(message) { console.error(message); process.exit(1); }
```

- [ ] **Step 2: Syntax check and the missing-key path**

Run: `node --check tools/trailer/generate.mjs && env -u SEEDANCE_API_KEY node tools/trailer/generate.mjs --dry-run; echo "exit=$?"`
Expected: prints `SEEDANCE_API_KEY is not set...` and `exit=1`.

- [ ] **Step 3: Commit**

```bash
git add tools/trailer/generate.mjs
git commit -m "feat: add seedance generate script for the trailer"
```

---

### Task 3: Portrait reference frame from the map

**Files:**
- Create: `tools/trailer/make-ref.sh`
- Create: `tools/trailer/ref/map-portrait.jpg` (generated)

Why: `assets/map-1918.jpg` is 2240×1494 (landscape). Seedance follows the start frame, so shot 2 needs a 9:16 frame. In map pixels the fortress centre is at x≈903 and the field at x≈329 (game world coordinates × 1.4). A full‑height crop of 840×1494 starting at x=196 holds both.

- [ ] **Step 1: Write the crop script**

Create `tools/trailer/make-ref.sh`:

```bash
#!/usr/bin/env bash
# Crops the painted map into the 9:16 start frame used by shot 2.
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
mkdir -p tools/trailer/ref
# 840x1494 window from x=196 keeps the field (left) and the star fortress (centre-right).
ffmpeg -hide_banner -loglevel error -y -i assets/map-1918.jpg \
  -vf "crop=840:1494:196:0,scale=1080:1920:flags=lanczos" -q:v 3 \
  tools/trailer/ref/map-portrait.jpg
echo "wrote tools/trailer/ref/map-portrait.jpg"
```

- [ ] **Step 2: Run it and verify the output**

Run: `chmod +x tools/trailer/make-ref.sh && tools/trailer/make-ref.sh && sips -g pixelWidth -g pixelHeight tools/trailer/ref/map-portrait.jpg && ls -l tools/trailer/ref/map-portrait.jpg | awk '{print $5" bytes"}'`
Expected: `pixelWidth: 1080`, `pixelHeight: 1920`, well under 30 MB.

- [ ] **Step 3: Look at it**

Open `tools/trailer/ref/map-portrait.jpg` (Read tool or browser pane). The star fortress must be fully inside the frame with the field visible on the left. If not, adjust the `196` offset and rerun.

- [ ] **Step 4: Commit**

```bash
git add tools/trailer/make-ref.sh tools/trailer/ref/map-portrait.jpg
git commit -m "feat: add portrait map reference frame for shot 2"
```

---

### Task 4: Shot definitions

**Files:**
- Create: `tools/trailer/prompts.json`

- [ ] **Step 1: Write the prompts**

Create `tools/trailer/prompts.json`. The `image_url` points at the feature branch until the branch is merged; the README (Task 8) says to switch it to `main` afterwards.

```json
[
  {
    "id": "shot1",
    "note": "0-6 s. AI reconstruction of the crowd walking to the fortress at dawn, 1 December 1918.",
    "mode": "text-to-video",
    "quality_tier": "standard",
    "channel": "standard",
    "aspect_ratio": "9:16",
    "duration": "6",
    "resolution": "720p",
    "generate_audio": true,
    "fixed_lens": false,
    "prompt": "Dawn on 1 December 1918 on the frosted plateau west of the Alba Iulia fortress in Transylvania. Long columns of Romanian peasants in white sheepskin coats and black lambskin hats, and women in woven headscarves and embroidered blouses under dark wool, walk quietly toward low star-shaped brick Vauban ramparts and a baroque stone gate on the horizon. Blue, yellow and red tricolour flags and church banners sway above the crowd. Breath fogs in the cold air, a low golden winter sun rakes across frozen grass, thin mist lies in the hollows. Camera: slow forward dolly at head height moving with the crowd, then a gentle rise to reveal the length of the columns and the fortress walls. Vertical 9:16 framing, crowd centred, clear headroom in the top quarter for a title. Style: a 1910s photograph come to life, muted earth tones, 16 mm film grain, soft halation, cinematic quality, high detail, stable faces, natural walking motion, no deformation. Sound: cold wind, thousands of footsteps on frozen ground, distant church bells. Strictly no modern buildings, no cathedral with tall towers, no obelisk or monuments, no cars, no modern clothing, no military insignia, no visible text, letters, subtitles, logos or watermarks, no duplicated faces."
  },
  {
    "id": "shot2",
    "note": "6-13 s. The painted map comes alive. Start frame is the portrait crop of assets/map-1918.jpg.",
    "mode": "image-to-video",
    "quality_tier": "standard",
    "channel": "standard",
    "aspect_ratio": "9:16",
    "duration": "7",
    "resolution": "720p",
    "generate_audio": true,
    "fixed_lens": false,
    "image_url": "https://raw.githubusercontent.com/luciancramba/drumul-spre-unire/feature/social-trailer/tools/trailer/ref/map-portrait.jpg",
    "prompt": "Use the supplied image as the exact opening frame: a hand-painted 1918 map of Alba Iulia with a star-shaped fortress in the centre and an open field on the left. Animate it as a living map. Camera: very slow, smooth push-in toward the star fortress, no rotation, no tilt. Along the painted roads, tiny dark figures in long columns flow toward the fortress; on the railway line a small steam locomotive trails white smoke; warm lantern light glows on the field and along the ramparts as if at dusk; faint mist drifts over the rivers. Keep the painted paper texture, the colours and every drawn detail exactly as in the image: no redrawing, no new buildings, no added labels, no text, no logos, no watermarks. Hold the final frame steady for the last two seconds. Sound: a soft distant crowd murmur, one far-away train whistle, quiet wind."
  }
]
```

- [ ] **Step 2: Dry run for shot 1 only (no credits)**

Run: `zsh -ic 'node tools/trailer/generate.mjs --dry-run --only shot1' 2>/dev/null`
Expected: prints `shot1: would POST .../video/seedance2 with Idempotency-Key dsu-shot1-…` and the JSON body with `"duration": "6"`. No `id`/`note` fields in the body.

Shot 2's dry run fails until Task 5 because the image URL is not public yet. That is expected.

- [ ] **Step 3: Commit**

```bash
git add tools/trailer/prompts.json
git commit -m "feat: add trailer shot prompts"
```

---

### Task 5: Publish the repo so the reference frame has a public URL

**Files:** none changed. Remote operations only.

- [ ] **Step 1: STOP and ask Lucian for push approval**

Say exactly what will happen: create the public GitHub repo `luciancramba/drumul-spre-unire`, add it as `origin`, push `main` and `feature/social-trailer`. Wait for an explicit yes. Do not proceed on silence.

- [ ] **Step 2: Create the repo and push (after the yes)**

```bash
gh repo create luciancramba/drumul-spre-unire --public --source=. --remote=origin --description "Drumul spre Unire — joc educațional RTS, Alba Iulia 1918"
git push -u origin main
git push -u origin feature/social-trailer
```

Expected: both pushes succeed; `git remote -v` shows `origin`.

- [ ] **Step 3: Verify the raw URL**

Run: `curl -sI https://raw.githubusercontent.com/luciancramba/drumul-spre-unire/feature/social-trailer/tools/trailer/ref/map-portrait.jpg | grep -iE '^(HTTP|content-type)'`
Expected: `HTTP/2 200` and `content-type: image/jpeg`. If 404, wait a minute and retry (raw CDN lag).

- [ ] **Step 4: Full dry run (no credits)**

Run: `zsh -ic 'node tools/trailer/generate.mjs --dry-run' 2>/dev/null`
Expected: `reference ok: … (image/jpeg)` for shot 2 and both request bodies printed.

---

### Task 6: Generate shot 1 (spends credits)

- [ ] **Step 1: Generate**

Run: `zsh -ic 'node tools/trailer/generate.mjs --only shot1' 2>/dev/null`
Expected: `shot1: submitted sd2_…, credits used N`, then `processing…` lines every 10 s, then `shot1: saved tools/trailer/out/shot1.mp4 (credits used N, refunded 0)`. Typical wait 1–4 minutes.

If it stops with `HTTP 402 insufficient_credits`, report the numbers and stop; Lucian tops up.

- [ ] **Step 2: Review**

Run: `ffprobe -v error -show_entries stream=codec_type,width,height,duration -of compact tools/trailer/out/shot1.mp4`
Expected: a video stream 720×1280 (or close, 9:16), about 6 s, and an audio stream.

Then open the file in the browser pane (`preview_start` with a local static server, e.g. `npx serve tools/trailer/out`) and watch it. Check for: anachronistic buildings, text or logos, deformed faces, wrong flags. If the shot is unusable, edit the prompt in `prompts.json`, delete `tools/trailer/out/shot1.mp4`, commit the prompt change with `fix: adjust shot1 prompt`, and rerun Step 1 (new prompt = new idempotency key = new paid task; say so before running).

---

### Task 7: Generate shot 2 (spends credits)

- [ ] **Step 1: Generate**

Run: `zsh -ic 'node tools/trailer/generate.mjs --only shot2' 2>/dev/null`
Expected: `reference ok…`, `shot2: submitted sd2_…`, polling, then `shot2: saved tools/trailer/out/shot2.mp4 (…)`.

- [ ] **Step 2: Review**

Run: `ffprobe -v error -show_entries stream=codec_type,width,height,duration -of compact tools/trailer/out/shot2.mp4`
Expected: video 9:16 about 7 s, plus audio. Watch it in the browser pane. The opening frame must be the map; the fortress must stay recognisable. Same regenerate procedure as Task 6 Step 2 if not.

---

### Task 8: Assemble with ffmpeg

**Files:**
- Create: `tools/trailer/assemble.sh`

- [ ] **Step 1: Write the script**

Create `tools/trailer/assemble.sh`:

```bash
#!/usr/bin/env bash
# Crossfades shot1 + shot2, burns the Romanian titles, writes out/trailer-9x16.mp4.
set -euo pipefail
cd "$(dirname "$0")"

command -v ffmpeg >/dev/null || { echo "ffmpeg not found (brew install ffmpeg)"; exit 1; }
for f in out/shot1.mp4 out/shot2.mp4; do
  [ -f "$f" ] || { echo "missing $f — run: node tools/trailer/generate.mjs"; exit 1; }
done

# Fonts: same families as the game (src/style.css). Fetched once from the google/fonts repo.
mkdir -p fonts
fetch_font() {  # $1 = file name, $2 = google/fonts ofl directory
  [ -f "fonts/$1" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/$2/$1" -o "fonts/$1"
}
fetch_font CormorantSC-Bold.ttf cormorantsc
fetch_font AlegreyaSans-Medium.ttf alegreyasans
TITLE_FONT=fonts/CormorantSC-Bold.ttf
BODY_FONT=fonts/AlegreyaSans-Medium.ttf

dur()   { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
has_a() { [ -n "$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$1")" ]; }

XF=0.6
D1=$(dur out/shot1.mp4)
D2=$(dur out/shot2.mp4)
OFFSET=$(awk -v d="$D1" -v x="$XF" 'BEGIN{printf "%.3f", d - x}')
TOTAL=$(awk -v a="$D1" -v b="$D2" -v x="$XF" 'BEGIN{printf "%.3f", a + b - x}')
FADE_ST=$(awk -v t="$TOTAL" 'BEGIN{printf "%.3f", t - 0.5}')

# alpha expression: fade in over 0.6 s at $1, hold, fade out over 0.6 s ending at $2 (or hold to the end if $2 is empty).
alpha() {
  local s=$1 e=${2:-}
  if [ -z "$e" ]; then
    printf "if(lt(t\\,%s)\\,0\\,if(lt(t\\,%s+0.6)\\,(t-%s)/0.6\\,1))" "$s" "$s" "$s"
  else
    printf "if(lt(t\\,%s)\\,0\\,if(lt(t\\,%s+0.6)\\,(t-%s)/0.6\\,if(lt(t\\,%s-0.6)\\,1\\,if(lt(t\\,%s)\\,(%s-t)/0.6\\,0))))" "$s" "$s" "$s" "$e" "$e" "$e"
  fi
}
title() {  # $1 font, $2 size, $3 y, $4 colour, $5 alpha expr, $6 text
  printf "drawtext=fontfile=%s:fontsize=%s:x=(w-text_w)/2:y=%s:fontcolor=%s:alpha='%s':shadowcolor=black@0.7:shadowx=2:shadowy=2:text='%s'" \
    "$1" "$2" "$3" "$4" "$5" "$6"
}
BRASS=0xecd08a
PARCH=0xecdfc2

T1=$(title "$TITLE_FONT" 64 200 "$BRASS" "$(alpha 1.0 5.0)" "1 Decembrie 1918")
T2=$(title "$BODY_FONT"  34 290 "$PARCH" "$(alpha 1.3 5.0)" "1.228 de delegați. O singură zi.")
T3=$(title "$TITLE_FONT" 78 880 "$BRASS" "$(alpha 8.0)"     "Drumul spre Unire")
T4=$(title "$BODY_FONT"  34 990 "$PARCH" "$(alpha 8.4)"     "Joacă istoria. Din 1 Decembrie 2026.")

FILTER="[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v0];
[1:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,setsar=1[v1];
[v0][v1]xfade=transition=fade:duration=${XF}:offset=${OFFSET}[vx];
[vx]${T1},${T2},${T3},${T4},fade=t=out:st=${FADE_ST}:d=0.5[vout]"

AUDIO_ARGS=(-an)
if has_a out/shot1.mp4 && has_a out/shot2.mp4; then
  FILTER="${FILTER};[0:a][1:a]acrossfade=d=${XF}[aout]"
  AUDIO_ARGS=(-map "[aout]" -c:a aac -b:a 160k)
else
  echo "note: a shot has no audio track; writing a silent clip"
fi

ffmpeg -hide_banner -loglevel error -y -i out/shot1.mp4 -i out/shot2.mp4 \
  -filter_complex "$FILTER" -map "[vout]" "${AUDIO_ARGS[@]}" \
  -c:v libx264 -pix_fmt yuv420p -crf 20 -preset medium -movflags +faststart \
  out/trailer-9x16.mp4
echo "wrote out/trailer-9x16.mp4 (${TOTAL}s)"
```

- [ ] **Step 2: Syntax check, then run**

Run: `bash -n tools/trailer/assemble.sh && chmod +x tools/trailer/assemble.sh && tools/trailer/assemble.sh`
Expected: `wrote out/trailer-9x16.mp4 (12.400s)` (± the real shot durations). If ffmpeg complains about the filtergraph, print `$FILTER` and check the `\,` escapes inside `alpha`.

- [ ] **Step 3: Verify the output**

Run: `ffprobe -v error -show_entries stream=codec_type,width,height:format=duration -of compact tools/trailer/out/trailer-9x16.mp4`
Expected: video 720×1280 h264, audio aac, duration ≈ 12.4.

Watch it in the browser pane. Check: both titles readable, diacritics `ț`, `ă` render, the crossfade lands around 5.4–6.0 s, the end fades to black. Adjust `y` values or font sizes in the `title` calls if text collides with faces or the fortress.

- [ ] **Step 4: Commit**

```bash
git add tools/trailer/assemble.sh
git commit -m "feat: add ffmpeg assembly for the social trailer"
```

---

### Task 9: README and final checks

**Files:**
- Create: `tools/trailer/README.md`
- Modify: `CLAUDE.md` (one line under „Structură")

- [ ] **Step 1: Write the README**

Create `tools/trailer/README.md`:

```markdown
# Trailer social 9:16

Două cadre generate cu Seedance 2.0, lipite local cu ffmpeg.

## Rulare

    node tools/trailer/generate.mjs --dry-run   # arată cererile, nu costă nimic
    node tools/trailer/generate.mjs             # generează shot1 și shot2 în out/
    tools/trailer/assemble.sh                   # scrie out/trailer-9x16.mp4

Cheia se citește din `SEEDANCE_API_KEY` (încărcată din `~/.seedance_key` de `~/.zshrc`).
Opțiuni: `--only shot1` / `--only shot2`.

## Costuri

Seedance 2.0, `quality_tier: standard`, 720p, cu audio. Scriptul afișează `credits_used`
la fiecare trimitere. Un cadru deja descărcat în `out/` nu se mai generează; șterge
fișierul MP4 ca să regenerezi. Un prompt schimbat înseamnă o cheie de idempotență nouă,
deci o generare nouă, plătită.

## Fișiere

- `prompts.json`: cele două cadre. `image_url` de la shot2 arată spre ramura
  `feature/social-trailer`; după merge, schimbă-l pe `main`.
- `make-ref.sh` → `ref/map-portrait.jpg`: decupajul 9:16 al hărții, cadrul de start pentru shot2.
- `lib.mjs` + `lib.test.mjs`: funcțiile pure și testele (`node --test tools/trailer/`).
- `out/` și `fonts/` sunt ignorate de git.
```

- [ ] **Step 2: One line in CLAUDE.md**

Under „## Structură", after the `tools/make_layout.py` bullet, add:

```
- `tools/trailer/`: trailerul social 9:16 generat cu Seedance 2.0 și lipit cu ffmpeg. Vezi `tools/trailer/README.md`.
```

- [ ] **Step 3: Preflight**

There is no `package.json`, so `npm test`, `npm run lint` and `npm run build` do not exist here. Run the equivalents and report them verbatim:

```bash
node --test tools/trailer/ && node --check tools/trailer/generate.mjs && bash -n tools/trailer/assemble.sh tools/trailer/make-ref.sh && echo PREFLIGHT_OK
```

Expected: `# pass 7`, then `PREFLIGHT_OK`.

- [ ] **Step 4: Commit**

```bash
git add tools/trailer/README.md CLAUDE.md
git commit -m "docs: document the social trailer pipeline"
```

- [ ] **Step 5: Hand over**

Report: where `out/trailer-9x16.mp4` is, total credits spent (sum of `credits_used`), the branch name, and that the PR is the next step (the branch is already on `origin`; opening the PR needs no new push approval, but say so anyway). Remind Lucian to rotate the Seedance key that was typed into chat.
