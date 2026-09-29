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
