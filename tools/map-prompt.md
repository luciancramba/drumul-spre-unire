# Prompt pentru harta pictată (Higgsfield · nano_banana_pro · 3:2 · 2k)

Referință: `reference/layout-sketch.png` (rol `image_references`). La 4k e nevoie de planul Plus în Higgsfield; GPT Image 2.5 cere planul Basic.

```
Turn this color-coded layout sketch into a richly detailed hand-painted historical strategy-game map (Age of Empires III art style, painterly gouache, top-down bird's-eye view with slight 3/4 perspective on buildings). Subject: the town of Alba Iulia (Gyulafehérvár), Transylvania, on 30 November 1918, grey overcast late-autumn day, thin fresh snow, bare trees and last rust-orange leaves, wet brown mud on roads. FOLLOW THE SKETCH LAYOUT EXACTLY (north is up, keep every element in the same place and size):
- CENTER: the Vauban-style Alba Carolina citadel, a seven-pointed bastioned star fortress (1715-1738) on a raised plateau, massive brick-and-stone scarp walls with pale stone corners, dry moat and snow-covered glacis ring; baroque monumental gates on the east-west axis: an outer triumphal-arch gate (Gate I) at the foot of the plateau on the east, the richly sculpted main baroque gate (Gate III) in the eastern wall, and a simpler Gate IV in the western wall.
- INSIDE the citadel: the Romanesque-Gothic Roman Catholic Cathedral of St. Michael (long stone nave oriented east-west, tall square west tower with dark pointed spire and a smaller second tower), next to it the large Princely Palace with courtyards, the baroque Batthyaneum library (a former church with a small bell tower) to the west, the Military Casino (a two-storey neoclassical building with pale facade) in the north-center, long yellow-ochre Austro-Hungarian barracks with red tile roofs along the inner walls, a small stone monument obelisk in the central square, tree-lined parade grounds. NO Orthodox Coronation Cathedral (it did not exist yet).
- WEST of the citadel: a very large open empty snowy plateau field (Campul lui Horea) with four small wooden speakers' tribunes draped in plain cloth; empty, no people.
- EAST, below the plateau: the lower town (Maieri) - dense streets of small whitewashed peasant and burgher houses with steep red tile roofs covered in snow, fenced courtyards, a small baroque Orthodox church with one bell tower, a synagogue, a market square, gardens and orchards.
- The yellow 19th-century railway station building with red roof beside the tracks near the Mures river; the single-track railway running north-south along the river bank with telegraph poles.
- The wide slate-blue Mures river on the far east with muddy banks and willows; the small Ampoi river crossing from west to east in the north, with a wooden road bridge where the north road crosses it.
- Muddy dirt roads exactly where the brown lines are: from the north, from the south, from the west and from the south-west, plus the road from the station through the lower town to the gates and through the citadel to the field.
- Plowed brown fields dusted with snow, haystacks, wooden fences, orchards; the forested snowy foothills of the Apuseni / Trascau mountains along the western edge with dark pines.
Absolutely no people, no animals, no vehicles, no trains, no flags, no text, no labels, no letters, no UI, no compass, no border frame. Muted period palette: snow white, ochre, umber, brick red, slate blue, pine green.
```

După generare: redimensionează la 2240×1494 JPEG (q80) în `assets/map-1918.jpg`, apoi refă coordonatele din `src/game.js` (vezi CLAUDE.md), pentru că AI-ul nu respectă schița la pixel.
