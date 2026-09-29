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
