# Prompt pentru fundalul pictat al hărții regiunii (Higgsfield · gpt_image_2_5 · 9:8 · sunburst · 2k)

Referință: `reference/region-layout-sketch.png`, făcută de `python3 tools/make_region_layout.py` (rol `image_references`). Fundalul e doar teren: râurile, drumurile, căile ferate, orașele, granița și numele se desenează în cod deasupra, din coordonatele din `src/geo.js`.

Parametri folosiți: model `gpt_image_2_5`, `aspect_ratio` 9:8, `variant` sunburst, `quality` medium, `resolution` 2k (rezultat 2160×1920, 1 credit). GPT Image 2.5 cere planul Basic în Higgsfield; `nano_banana_pro` nu are raportul 9:8.

```
Turn this color-coded terrain sketch into a hand-painted historical strategy-game map background (Age of Empires III art style, painterly gouache, top-down bird's-eye view). Subject: the Carpathian basin region of Transylvania, Banat, Crisana and Maramures in late November 1918, grey overcast late-autumn day, thin fresh snow on the high mountains only, rust-orange last leaves and bare trees, brown plowed fields. FOLLOW THE SKETCH LAYOUT EXACTLY (north is up; keep every area in the same place and the same size):
- Grey = high mountain ranges (the Carpathian arc along the east and south, the Apuseni Mountains in the west of Transylvania, the Banat and Maramures mountains): rugged ridges and steep valleys, dark pine forest on the lower slopes, bare rock grey on the heights; the white spots in the sketch are snow-capped peaks.
- Dark green = dense forest (spruce and beech).
- Olive = rolling hills of the Transylvanian Plateau and the Subcarpathian hills: a patchwork of fields, orchards and small woods.
- Tan = open plain (the Pannonian plain in the west and south-west): flat plowed fields in muted browns and ochres, hedgerows, a few copses.
TERRAIN ONLY. Absolutely no rivers, no lakes, no streams, no roads, no railways, no towns, no villages, no buildings, no bridges, no borders or border lines, no people, no animals, no vehicles, no flags, no text, no labels, no letters, no numbers, no compass, no legend, no map frame. Keep an even, medium level of detail over the whole image, with no strong focal point, so that lines and labels can be drawn on top of it later. Muted period palette: parchment ochre, umber, olive, pine green, slate grey, snow white.
```

După generare: `python3 tools/make_region_layout.py --finish <rezultat.png> assets/region-1918.jpg` (2000×1740, JPEG q80), apoi `python3 tools/make_region_layout.py --overlay assets/region-1918.jpg /tmp/region-overlay.jpg` și te uiți dacă munții cad unde trebuie în raport cu râurile, granița, drumurile și orașele (contururile magenta sunt reliefurile din schiță). AI-ul nu respectă schița la pixel, deci aliniarea se judecă la nivel de regiune: munții Apuseni între Crișuri și Mureș, lanțul Carpaților pe marginea de est și de sud, câmpia în vest.

Draftul păstrat (primul) a ieșit aliniat cu schița, dar cu nori la colțuri și la marginea din stânga, pentru că promptul nu îi interzicea, și cu o vedere ușor oblică. Norii se acoperă cu vălul și cu spălările din `region.js`. Dacă regenerezi, adaugă „no clouds, no fog, no mist, strictly top-down view”.
