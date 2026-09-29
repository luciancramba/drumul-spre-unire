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
