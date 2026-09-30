# Drumul spre Unire — MVP finish (roadmap step 1) — design

Date: 2026-09-29
Status: approved in conversation, awaiting written review

## Goal

Turn the playable prototype into the release for 1 December 2026, as defined by
roadmap step 1 in `CLAUDE.md`: sound, a cinematic ending with the camera over the
crowd, and phone hardening. Along the way, add the missing preflight tooling
(`npm test`, `npm run lint`, `npm run build`), persistence of progress, and fix the
small gaps found while reading the code. Chapters 1–5, the teacher mode and any new
map or content are out of scope.

## Decisions taken

- Sound is synthesized with the Web Audio API. No audio files, no licences.
- The code stays a set of classic scripts loaded by `index.html`. No bundler, no
  build step is needed to play. `index.html` keeps opening from disk.
- Pure logic moves to `src/core.js` so it can be unit-tested under Node.
- Five stacked branches and PRs, each under 30 files and 3000 lines.

## 1. Files and boundaries

All modules attach to one global namespace, `DSU`, created by `core.js`. Each module
is an IIFE. `core.js` also exports through `module.exports` when it exists, so Node
tests import it directly. `save.js` uses the same dual export.

| File | Responsibility | Depends on |
|------|----------------|------------|
| `src/core.js` | Pure logic, no DOM: `clamp`, `fmt`, `mkPath`, `at`, `distSeg`, `distPoly`, `bez`, `clockParts(t)`, `clockText(t)`, `scoreFor(total)` → `{medals, verdict}`, the save schema `parseSave(raw)` / `emptySave()`, and constants `W`, `H`, `RATE`, `DEADLINE`, `TOTAL`, `PROV` quotas. | nothing |
| `src/save.js` | `DSU.save`: `load()`, `recordResult({delegates, crowd, medals})`, `unlockFact(id)`, `setSound(bool)`, `data` getter. One localStorage key, `dsu.v1`. Every storage call in try/catch; falls back to an in-memory object. | core |
| `src/audio.js` | `DSU.audio`: `init()` (creates the AudioContext on a user gesture), `setEnabled(bool)`, `available` flag, `suspend()`/`resume()`, `ambience({crowd, running})`, and one-shot cues: `click()`, `telegram()`, `good()`, `bad()`, `whistle()`, `chuff(on)`, `bells(kind)` with kind `dawn` or `ending`. | nothing |
| `src/cinematic.js` | `DSU.cinematic`: `play(cam, opts)` returns a controller with `update(dt)`, `drawOverlay(ctx, vw, vh)`, `skip()`, `done` and an `onDone` callback. Holds the keyframes listed in section 3. Reads `prefers-reduced-motion`. | core (for `clamp`) |
| `src/game.js` | Everything else: map, camera input, state, actions, events, Chronicle, HUD, main loop. Calls the modules above. Dead helpers `star`, `poly`, `line`, `inField` are deleted. | all of the above |

`index.html` loads, in order: `core.js`, `save.js`, `audio.js`, `cinematic.js`,
`game.js`.

## 2. Sound

The AudioContext is created on the first tap of „Începe misiunea", because browsers
require a user gesture. If `window.AudioContext` is missing, `available` is false,
the speaker button is hidden and every audio call is a no-op.

Layers, all synthesized:

- **Wind**: white noise through a low-pass filter around 400 Hz, gain drifting slowly
  between 0.02 and 0.06 with an LFO. Runs while the game runs.
- **Crowd murmur**: noise through a band-pass around 250 Hz, gain proportional to the
  count on Câmpul lui Horea, mapped from 0 people → 0 to 100 000 people → 0.12. The
  field audibly fills as the game progresses.
- **Train**: `whistle()` plays two detuned sawtooth tones (about 440 and 554 Hz)
  through a low-pass filter for 0.7 s, on departure and on arrival. `chuff(true)`
  starts a repeating noise burst at about 3 Hz while a train moves; `chuff(false)`
  stops it.
- **Bells**: `bells('dawn')` plays three strikes when the game clock reaches 1
  December 06:00. `bells('ending')` plays a peal of about ten strikes across the
  cinematic. Each strike is a sine fundamental plus two partials with a 2 s decay.
- **UI**: `click()` is a 30 ms filtered noise burst on every button. `telegram()` is
  three short ticks in a dot-dot-dash pattern when an event card opens. `good()` is a
  two-note rising chime, `bad()` a low 90 Hz thud.

Master gain sits at 0.5. `suspend()` is called when the tab becomes hidden, on pause
and when a modal opens; `resume()` on the opposite transitions, only when sound is
enabled. The speaker button in the tools panel toggles `setEnabled`, and the choice
is written through `DSU.save.setSound`.

## 3. Cinematic ending

When `S.t` reaches `DEADLINE`, `game.js` stops the simulation, stamps the whole
remaining crowd so the field is full, fades the HUD to opacity 0 via a CSS class, and
calls `DSU.cinematic.play(cam, {...})`. The controller drives `cam.x`, `cam.y`,
`cam.z` from keyframes and draws captions on the canvas. Total length about 12 s.

| Time | Camera | Caption |
|------|--------|---------|
| 0–3 s | Ease from the current view to Sala Unirii (664, 410) at zoom `minZ×3.0`. | „10:00 · Sala Unirii" |
| 3–7 s | Glide west through Poarta a IV-a (395, 478) onto the field centre (235, 585) at zoom `minZ×2.4`, flags waving, crowd full. | „Câmpul lui Horea" |
| 7–11 s | Pull back to (450, 540) at zoom `minZ×1.15` so fortress and field both fit. Bells peal. | „Peste 100.000 de oameni" |
| 11–12 s | Hold. | none |

Captions use Cormorant SC, drawn at the bottom third of the screen with a dark
translucent band, fading in over 0.4 s and out over 0.4 s. Any tap or key press calls
`skip()`, which jumps the camera to the final keyframe and fires `onDone`. With
`prefers-reduced-motion`, `play` cuts straight to the final keyframe and fires
`onDone` after 0.5 s. `onDone` restores the HUD and opens the existing results card.
The camera clamp is relaxed while the cinematic runs so the keyframes are reachable
at every screen size.

## 4. Persistence and small gaps

- Save data: `{v:1, best:{delegates, crowd, medals, date}|null, facts:string[],
  sound:boolean, plays:number}`. `parseSave` rejects anything that does not match and
  returns `emptySave()`.
- Start screen shows „Cel mai bun rezultat: ★★☆ · 1.100 delegați" when `best` exists,
  and a „Cronica" button, since unlocked pages now survive reloads. `unlock()` writes
  through `save.unlockFact`; `showChronicle` reads the union of the current game's
  facts and the saved ones.
- A help button („?") in the tools panel reopens the tutorial card mid-game. The
  game is already frozen while a modal is open, so no extra pause logic is needed.
- `visibilitychange` sets `paused = true` when the tab is hidden and suspends audio.
  The player resumes manually with the pause button. `last` is reset on the next
  frame so `dt` stays capped.

## 5. Phone hardening

- Device pixel ratio is capped at 1.5 when `vw < 500`, otherwise 2.
- Snowflake count is 75 instead of 150 when `vw < 500`.
- `#hud` and `#scene` use `100dvh` with a `100vh` fallback, so the bottom bar stays
  above mobile browser chrome.
- Layout verified in the built-in browser at 360×780, 390×844 and 780×360
  (landscape), looking for HUD overlap, unreadable labels and clipped cards. Real
  devices are tested by Lucian.

## 6. Tooling and delivery

- `package.json` (private, `"type"` unset so classic scripts stay CommonJS-compatible
  in tests). Only dev dependency: `eslint`. Scripts:
  - `test`: `node --test tests/`
  - `lint`: `eslint src tools tests`
  - `build`: `node tools/build-single.mjs`, which inlines the CSS, the five scripts and
    `assets/map-1918.jpg` as base64 into `dist/drumul-spre-unire.html`, and fails if
    the result exceeds 16 MB. `dist/` is ignored. The hand-made
    `reference/artifact-single-file.html` is removed in favour of the build.
- `eslint.config.js` in flat config, `browser` and `node` globals, `DSU` declared as a
  global.
- Tests in `tests/core.test.js` and `tests/save.test.js`: path length and
  interpolation, clock conversion across the midnight boundary, medal thresholds,
  save parsing of valid, malformed and legacy input, and `save.js` against a fake
  `localStorage` that can throw.

### Branches and PRs, stacked in this order

1. `chore/tooling-core`: package.json, eslint, tests, `core.js` extraction, dead-code
   removal, single-file build, this spec.
2. `feature/save-progress`: `save.js`, start-screen best result, Chronicle
   persistence, help button, visibility pause.
3. `feature/sound`: `audio.js`, speaker button, cue calls in `game.js`.
4. `feature/cinematic-ending`: `cinematic.js`, HUD fade, ending flow.
5. `fix/phone-hardening`: DPR cap, snow count, `dvh`, layout fixes found in testing.

Each branch is based on the previous one and each PR targets the previous branch.
Nothing is pushed until Lucian approves in chat. `feature/social-trailer` is
untouched. `CLAUDE.md` is updated in the last PR to describe the new files and the
npm scripts.

## Error handling

- No AudioContext: silent game, hidden speaker button.
- AudioContext creation throws or stays `suspended`: `available` becomes false after
  the first failed `resume`, same fallback.
- localStorage throws (private mode, quota): in-memory fallback, no toast.
- Corrupt save: replaced by `emptySave()` on next write.
- Map image fails to load: existing behaviour, dark background, game still runs.
- Cinematic interrupted by resize: keyframes are expressed as multiples of `minZ`, so
  `resize()` keeps them valid.

## Testing

- Unit: the node:test suites above, run by `npm test`.
- Lint and build: `npm run lint`, `npm run build`, output size printed.
- Manual, in the built-in browser: one full playthrough per PR at desktop width, plus
  the three phone sizes in PR 5; console must show no errors; sound toggled on and
  off; cinematic watched once and skipped once; reload confirms saved best result and
  Chronicle pages.

## Out of scope

Teacher mode and quiz, chapters 1–5, recorded audio, new map, translation, analytics,
the social trailer.
