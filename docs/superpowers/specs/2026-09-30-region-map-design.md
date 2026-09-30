# Drumul spre Unire — regional map — design

Date: 2026-09-30
Status: approved in conversation, awaiting written review

## Goal

Add a second, larger map above the Alba Iulia city map: the region of Transilvania,
Banat, Crișana and Maramureș on 30 November 1918. Delegations and trains travel across
it on real routes, events happen where they historically would, and the player zooms
continuously from the region down into the city. The city map, the crowd on Câmpul lui
Horea and the cinematic ending stay as they are.

## Decisions taken

- Two levels with continuous zoom: the region is the top level; zooming in on Alba Iulia
  dives into the city, zooming out of the city flies up to the region. A „Regiune / Oraș"
  button in the HUD does the same flight for players who do not pinch.
- The journey is played on the region: routes, blocks and located events move there.
  Actions, costs and resources do not change.
- Hybrid art: a painted background without any text (relief, forests, snow), with towns,
  rivers, railways, roads and province names drawn in code on top from real coordinates.
- Two worlds joined by a „zoom portal". The city keeps its own camera and coordinates;
  the region is a new world with its own camera. A single camera spanning both scales was
  rejected: it would rewrite working city code and fight float precision at a 1:130 ratio.

## 1. Files and boundaries

| File | Responsibility | Depends on |
|------|----------------|------------|
| `src/geo.js` | Pure data and math, no DOM. Towns (lat/lon), rivers, 1918 railways and roads as lat/lon polylines, approximate outlines of the four historical regions, the 1918 border with the Kingdom of Romania, and `project(lat, lon)` → region world units. Route definitions per province: road and rail polylines ending at the city entry. Region speeds and the located events table. Dual export like `core.js`. | core |
| `src/region.js` | `DSU.region`: region world renderer and camera. Static layers are painted once into an off-screen canvas; per frame it draws that canvas, the selected province's routes, guards, block markers and the moving markers. Handles pan and zoom inside the region. | core, geo |
| `src/portal.js` | `DSU.portal`: which world is active, the transition between them, and the zoom thresholds. Pure state machine (`level`, `progress`, `direction`) plus a draw helper for the crossfade. Owns the „Regiune / Oraș" button state and its attention dot. | core |
| `src/game.js` | Journeys get two segments: a regional one on `geo` routes, then the existing city path. Hand-off at the city entry. Located events and blocks use regional positions. Input and drawing are routed to the active world. | all |
| `assets/region-1918.jpg` | Painted background, no labels, aligned to the `geo` projection. | — |
| `tools/region-prompt.md`, `tools/make_region_layout.py` | How the background is generated and aligned, like the city map tools. | — |

`index.html` loads `core.js`, `geo.js`, `save.js`, `audio.js`, `cinematic.js`,
`region.js`, `portal.js`, `game.js`, in that order.

## 2. Geography

- Extent: about 44.6°–48.2° N and 20.3°–26.3° E, enough to show Timișoara, Arad,
  Oradea, Baia Mare, Sighet, Cluj, Târgu Mureș, Sibiu, Brașov and the Carpathian border.
- Projection: equirectangular with the longitude scaled by cos(46.4°), mapped to a world of
  about 2000 × 1740 units. Accurate enough for a school map of this size and trivial to
  invert and test.
- Towns shown: Alba Iulia, Timișoara, Lugoj, Arad, Oradea, Baia Mare, Sighet, Dej, Cluj,
  Turda, Aiud, Teiuș, Târgu Mureș, Deva, Orăștie, Vințu de Jos, Sebeș, Sibiu, Făgăraș,
  Brașov, Zlatna, Abrud. The Romanian name is drawn on the map; the official 1918 name
  (Gyulafehérvár, Kolozsvár, Nagyvárad…) goes in the town's info card, as for the station.
- Rivers: Mureș, Someș, Crișul Repede, Crișul Alb, Crișul Negru, Olt, Timiș, Ampoi.
- Borders: the 1918 Austro-Hungarian border along the Carpathians, labelled „Regatul
  României" on the far side. No 1920 or modern borders anywhere.
- The four provinces are drawn as historical regions with soft, approximate edges and
  their existing colours from `PROV`. The info card says the outlines are approximate.

## 3. Routes and journeys

| Province | Regional road | Regional rail → city line |
|---|---|---|
| Maramureș | Baia Mare → Dej → Cluj → Turda → Aiud → Teiuș | Dej → Cluj → Teiuș → `railE` |
| Crișana | Oradea → Beiuș → Apuseni (Câmpeni, Abrud) → Zlatna | Oradea → Cluj → Teiuș → `railE` |
| Banat | Timișoara → Lugoj → Deva → Orăștie → Vințu de Jos | Timișoara → Arad → Deva → Vințu de Jos → `railW` |
| Transilvania | Brașov → Făgăraș → Sibiu → Sebeș | Brașov → Făgăraș → Sibiu → Vințu de Jos → `railW` |

- The existing split of rail lines (E via Teiuș, W via Vințu) is unchanged, so „linia
  ocupată" keeps its meaning: one train per line at a time, counted across both segments.
- A delegation is one marker on the region (cart, tricolour flag, delegate count). A train
  is a small locomotive with smoke. People are drawn one by one only in the city.
- Hand-off: when a regional marker reaches the end of its route, it spawns exactly what
  the city spawns today at the start of the city path (a cart plus 24 walkers, or a train
  at `d = 0`). The city code for walking, unloading and settling is not changed.
- Spontaneous crowds from the nearby villages keep appearing at the city edge.
- Timing: the whole game still lasts about 4 minutes. At normal speed and 70 moral, a
  full journey takes at most about 45 s for Maramureș and about 30 s for Transilvania.
  Regional speeds live in `geo.js` and are covered by a test.

## 4. Located events

| Event | Location on the region | Blocks |
|---|---|---|
| Viscol în Munții Apuseni (`snowMM`) | Apuseni, on the Crișana road | `road:CR` |
| Locomotiva fără cărbune (`coalE`) | Teiuș | `rail:E` |
| Oprire la Deva (`gardaW`) | Deva | `rail:W` |
| Blocaj pe drumul dinspre Vințu (`jamBN`) | near Vințu de Jos, on the Banat road | `road:BN` |
| Trenurile sunt supraaglomerate (`overfull`) | Arad, marker only | — |
| Podul de peste Ampoi (`bridgeTR`) | stays in the city | `road:MM` |

A blocked unit stops a short distance before the event's location on its route, instead of
the current fixed 4–24 % stretch of the city path. The block marker and its label are drawn
at the location. Events without a place (rumor, lodging, neighbours) do not change.

## 5. Camera and portal

- The game starts on the region with all four provinces in view. Choosing a province
  highlights its road and railway on the region.
- Region zoom goes from „all provinces" to about 6× that. Zooming in past the maximum
  while Alba Iulia is near the centre of the screen starts the dive; zooming out of the
  city past `cam.minZ` starts the climb. A hysteresis band keeps it from flickering at the
  threshold.
- The transition lasts about 0.8 s: the region camera flies onto Alba Iulia while the city
  fades in (and the reverse). With `prefers-reduced-motion` it is a 0.2 s crossfade.
- The „Regiune / Oraș" button flies to the other level. It shows a dot when something
  happens on the level you are not looking at: an arrival in the city, a block on the
  region.
- At 10:00, if the player is on the region, the portal flies to the city first, then the
  cinematic starts as it does today.

## 6. Delivery

Five branches and PRs. 1–4 are stacked; 5 depends only on 2.

1. `feature/region-geo`: `geo.js` and its tests. Nothing visible.
2. `feature/region-view`: `region.js` on a plain paper background, region camera, the
   „Regiune / Oraș" button with a simple fade.
3. `feature/region-portal`: `portal.js`, continuous zoom, start on the region, flight to
   the city at the deadline.
4. `feature/region-journeys`: two-segment journeys, regional markers, located events,
   attention dot, timing balance.
5. `feature/region-painted`: painted background, prompt and alignment tools.

Each PR stays under 30 files and 3000 lines, passes `npm test`, `npm run lint` and
`npm run build`, and updates `CLAUDE.md` for what it adds. Nothing is pushed without
Lucian's approval in chat.

## Error handling

- Painted background fails to load: the paper fill stays and every drawn layer works.
- Canvas at 0 × 0 or resized mid-transition: the portal keeps its progress and both
  cameras recompute their limits from the new size.
- Event fires while the player looks at the other level: it opens as today (the card is
  level-independent) and the attention dot marks where it happened.

## Testing

- Unit (Node): projection order of towns (Cluj north of Alba Iulia, Arad west of Deva,
  Brașov east of Sibiu); every route is continuous and ends at its city entry; journey
  times at the configured speeds fall in 30–45 s; each located event lies on the route it
  blocks; the portal state machine switches once per crossing and never oscillates inside
  the hysteresis band.
- Browser: one bot playthrough per PR with no console errors; pinch and wheel back and
  forth between levels; phone sizes 360×780, 390×844 and 780×360; single-file build under
  16 MB.
- Balance: Lucian plays PR 4 a few times; the bot alone cannot judge difficulty.

## To check with a historian

- Which of the railway lines above were open in 1918 (in particular Dej–Baia Mare,
  Sibiu–Vințu de Jos, Brașov–Făgăraș–Sibiu, Oradea–Cluj).
- The routes delegates actually took out of the Apuseni and Maramureș.
- The approximate outlines of the four historical regions.
- Official 1918 town names shown in the info cards.

## Out of scope

Bucovina and Basarabia on the map, modern borders, new resources or actions, the teacher
mode, chapters 1–5.
