# Drumul spre Unire — joc educațional RTS (Alba Iulia, 1918)

Prototip jucabil pentru telefon și desktop: jucătorul organizează sosirea celor 1.228 de delegați și a mulțimii la Alba Iulia, între 30 noiembrie 1918 ora 06:00 și 1 decembrie ora 10:00 (deschiderea Marii Adunări). Ținta de lansare este 1 Decembrie 2026. Proiect Cramba App Studio, cu legătură naturală cu Hotel Medieval și cu celălalt joc, „Steaua Imperiului / Apărarea Cetății”.

Versiunea publicată ca artifact: https://claude.ai/artifact/PLPbap84scVEk7H2uVxXCQ

## Rulare
Fără build. Deschide `index.html` direct în browser sau rulează `npx serve .` și intră pe http://localhost:3000.
Singura dependență externă sunt fonturile Google (Cormorant SC, Alegreya Sans).

Unelte de dezvoltare (`npm install` o dată):
- `npm test`: testele `node:test` din `tests/` și `tools/trailer/`.
- `npm run lint`: ESLint pe `src`, `tools` și `tests`.
- `npm run build`: generează `dist/drumul-spre-unire.html`, un singur fișier cu CSS-ul, scripturile și harta în base64. Asta e versiunea care se publică ca artifact. Build-ul eșuează peste 16 MB.

## Structură
- `index.html`: HUD-ul (resurse, ceas, obiectiv, provincii, cele 4 acțiuni), modalul și toast-urile.
- `src/style.css`: tema (tokeni pe `:root`, un singur look întunecat cu carduri pergament). Breakpoint-uri pentru telefon portret (sub 400 px acțiunile trec pe 2×2), telefon landscape (max-height 480px) și desktop larg. Verificat la 360×780, 390×844 și 780×360. Sub 400 px, butoanele de unelte au spațiere mai mică, iar sub 380 px Cronica rămâne doar cu iconița și punctul. Eticheta butonului „Regiune / Oraș” are lățime fixă, ca să nu mute butoanele vecine când își schimbă textul.
- `src/core.js`: logica pură, fără DOM (constante, `mkPath`/`at`, ceasul, scorul). Se atașează la `DSU.core` și se poate importa în Node pentru teste.
- `src/geo.js`: datele hărții regiunii la 30 noiembrie 1918, în coordonate reale (lat/lon): orașele cu numele oficial din 1918, râurile, granița cu Regatul României, conturul aproximativ al celor patru provincii istorice, drumurile și căile ferate pe provincii, vitezele pe regiune și locurile evenimentelor. `project(lat, lon)` le pune pe o lume de 2000×1740 de unități. Pregătește harta regiunii (spec: `docs/superpowers/specs/2026-09-30-region-map-design.md`); îl folosește `region.js`.
- `src/save.js`: progresul salvat în `localStorage` (cheia `dsu.v1`): cel mai bun rezultat, paginile din Cronică, sunetul. Dacă stocarea nu merge (mod privat), ține datele în memorie. Schema și validarea (`parseSave`) sunt în `core.js`.
- `src/audio.js`: sunetul, sintetizat cu Web Audio (fără fișiere audio): vânt, murmurul mulțimii (crește cu oamenii de pe câmp), fluierul și pufăitul trenurilor, clopotele de la 1 decembrie 06:00 și de la final, semnalele de interfață. Contextul audio pornește la „Începe misiunea”, pentru că browserul cere un gest al utilizatorului. Fără Web Audio (sau dacă pornirea eșuează), butonul de sunet dispare și totul devine no-op. Dacă browserul suspendă contextul (de exemplu iOS după un apel), următoarea apăsare pe un buton îl repornește.
- `src/cinematic.js`: finalul cinematic de 12 secunde (Sala Unirii → Poarta a IV-a → Câmpul lui Horea → vedere de sus), cu subtitrări pe canvas. Cadrele-cheie sunt multipli de `cam.minZ`, deci rezistă la resize. Pe telefon portret, ultimul cadru păstrează toată mulțimea. Orice atingere sau tastă sare la rezultate. Cu `prefers-reduced-motion`, sare direct la ultimul cadru.
- `src/region.js`: harta regiunii (`DSU.region`), desenată din `geo.js` pe un fundal de hârtie: provinciile, granița din 1918, râurile, drumurile, căile ferate, orașele și traseele provinciei alese. Are camera ei (de la „toate provinciile” până la 6× apropiere, `MAXK`), iar orașele mici (`tier` 2) apar de la 1,8× (`TIER2`). Hârtia și provinciile sunt pictate o dată pe un canvas separat; liniile și etichetele se desenează la fiecare cadru, ca să rămână clare la zoom. Etichetele respectă opacitatea primită (`globalAlpha`), ca să se estompeze odată cu harta. Atingerea unui oraș sau a unei provincii deschide o fișă (`info`) cu numele oficial din 1918 sau cota de delegați. `home()` revine la vederea cu toate provinciile.
- `src/portal.js`: trecerea dintre regiune și oraș (`DSU.portal.create`), ca mașină de stări fără DOM. `u` merge de la 0 (regiunea) la 1 (orașul) în 0,8 s (0,2 s cu reduced motion); un zbor întors la jumătate pornește înapoi de unde a rămas. `overscroll` adună zoom-ul cerut peste limita unei hărți și schimbă nivelul abia după `PUSH` (×1,5); apăsarea se stinge în 0,6 s, deci tremuratul la prag nu schimbă nivelul. `alpha()` dă opacitatea regiunii, iar `pose()` camera regiunii în timpul zborului.
- `src/game.js`: restul jocului, într-un IIFE, pe canvas 2D. Citește din `DSU.core`, `DSU.region` și `DSU.portal`, deci se încarcă ultimul (ordinea: `core`, `geo`, `save`, `audio`, `cinematic`, `region`, `portal`, `game`).
- `tests/`: teste unitare pentru modulele fără DOM (`core`, `geo`, `region`, `portal`, `save`, `audio`, `cinematic`). `region` e testat cu un context 2D fals.
- `assets/map-1918.jpg`: harta pictată cu AI (2240×1494), desenată pe lumea jocului de 1600×1067.
- `reference/`: harta originală 2K și schița de layout.
- `tools/make_layout.py` + `tools/map-prompt.md`: cum a fost generată harta.
- `tools/build-single.mjs`: build-ul cu un singur fișier (`npm run build`).
- `tools/trailer/`: trailerul social 9:16 generat cu Seedance 2.0 și lipit cu ffmpeg. Vezi `tools/trailer/README.md`.

## Cum e organizat game.js
- **Lumea** are 1600×1067 unități, cu nordul în sus. Camera (`cam`) face pan, pinch și zoom cu rotița. `clampCam` permite o margine, ca elementele să poată fi scoase de sub HUD.
- **Pe telefon** (lățime sub 500 px), canvasul folosește cel mult DPR 1,5 și 75 de fulgi în loc de 150. `resize` ignoră dimensiunea 0×0 (pagină ascunsă) și e legat de un `ResizeObserver` pe canvas.
- **Nivelurile**: `portal` (din `portal.js`) ține nivelul, iar `regionA` e opacitatea regiunii. Fiecare joc începe pe regiune, cu toate provinciile (`begin` → `R.home()`). Apropierea peste 6× lângă Alba Iulia (la cel mult 30% din ecran de punctul de zoom sau de centru) pornește coborârea în oraș; depărtarea sub zoom-ul minim al orașului pornește urcarea. `startFlight` fixează zborul: camera regiunii merge de la vederea jucătorului la un prim-plan pe Alba Iulia, orașul așteaptă în vederea de start (`cityHome`), iar urcarea aterizează cu Alba Iulia la 3×. Capetele zborului sunt multipli ai `minZ` al regiunii (`CLOSE_K`, `OUT_K`), deci rezistă la resize. Butonul „Oraș / Regiune” face același zbor și îl poate întoarce. În timpul zborului, tragerea, zoom-ul și atingerile sunt ignorate; pauza nu oprește zborul. La 10:00, `endGame` ascunde imediat HUD-ul (clasa `cinematic` pe `body`, cu `pointer-events:none`, ca nimic să nu se deschidă în timpul zborului), zboară întâi în oraș (`afterFlight`) și abia apoi pornește cinematicul (`playEnding`). Rotița e normalizată după `deltaMode`, ca și în Firefox să se poată trece prin portal.
- **Traseele** sunt polilinii în `P`: `roadMM`, `roadCR`, `roadBN`, `roadTR`, `walk` (gară → Poarta I → prin cetate → Poarta a IV-a → câmp), `railW` (dinspre sud: Vințu / Deva / Arad) și `railE` (dinspre nord: Teiuș / Cluj). Drumurile din nord și din sud continuă cu `CIT`, axa prin cetate. `mkPath`/`at` (din `core.js`) fac interpolarea după distanță.
- **Provinciile** sunt în `PROV`, cu cota de delegați din `QUOTAS` (140 + 260 + 300 + 528 = 1.228), drumul, linia ferată și culoarea.
- **Starea** e în `newState()`: resursele (Provizii, Influență, Moral), delegații trimiși și sosiți, `walkers` (fiecare sprite = 100 de oameni), `trains`, `blocks` (trasee blocate) și `guards`.
- **Acțiunile** sunt `sendDelegation`, `organizeTrain`, `protect` și `negotiate`. Costurile sunt scrise direct în funcții și în etichetele butoanelor.
- **Evenimentele** sunt în `EVENTS`, sub formă de carduri-telegramă cu 2 alegeri. Câmpul `target` blochează un traseu, iar alegerile pot debloca, bloca temporar, cere costuri sau debloca o pagină din Cronică.
- **Cronica** e în `FACTS` și `FACT_ORDER`. Paginile se deblochează după ora din joc sau după acțiuni și rămân salvate între jocuri.
- **Reperele istorice** sunt în `LANDMARKS`: etichete pe hartă, iar la atingere se deschide o fișă (`showLandmark`). La zoom mic, cele secundare apar doar ca puncte.
- **Mulțimea** de pe Câmpul lui Horea e desenată incremental pe canvasul `crowdL`. `spots` e sortat de la centru spre margine, iar `PER_STAMP` = 25 de oameni pe figurină.
- **Finalul**: la `DEADLINE`, `endGame` oprește simularea, trece pe câmp pe toți cei încă pe drum, salvează rezultatul, ascunde HUD-ul (clasa `cinematic` pe `body`) și pornește `DSU.cinematic`. La sfârșit, `showEnding` deschide cardul cu rezultatele.
- **Ritmul** (în `core.js`): `RATE` = 7 minute de joc pe secundă reală, `DEADLINE` = 1680 de minute, adică aproximativ 4 minute de joc real. Tot acolo sunt `clockText` și `scoreFor` (pragurile pentru medalii).

## Dacă se regenerează harta
AI-ul nu respectă schița la pixel. După ce pui o hartă nouă, refă coordonatele din `P`, `CIT`, `F`, `FIELD`, `TRIBS`, `STATION`, `ch_list` și `LANDMARKS`, măsurându-le pe imaginea redimensionată la 1600 px lățime.

## Acuratețe istorică: reguli
- În 1918 **nu existau** Catedrala Încoronării (1921–1922) și obeliscul lui Horea, Cloșca și Crișan (1937). Nu le adăuga.
- Gara se numea oficial Gyulafehérvár. Calea ferată Arad–Alba Iulia a fost deschisă în 1868.
- Câmpul lui Horea era platoul din spatele cetății, la vest. Participanții au intrat pe Poarta I sau pe intrarea de vest și au fost așezați pe localități.
- Delegații s-au adunat în Casina militară, azi Sala Unirii. Adunarea a fost prezidată de Gheorghe Pop de Băsești, discursul principal l-a ținut Vasile Goldiș, iar Iuliu Hossu a citit rezoluția mulțimii.
- Inamicii din capitolele de război sunt Puterile Centrale. Faza Unirii e diplomatică și logistică, fără tabăra „ungurii”. Transilvania apare ca regiune multietnică, vezi evenimentul „Vecinii întreabă” și punctul III al Rezoluției.

### De verificat cu un istoric (de exemplu Muzeul Național al Unirii)
- Poziția exactă a clădirilor din cetate pe hartă. E interpretarea AI-ului.
- Numărul tribunelor. Sursele diferă, așa că în text scriem „mai multe tribune”.
- Celula lui Horea: tradiția o pune în Poarta a III-a, unii istorici în Poarta a IV-a. Fișa menționează ambele variante.
- Toate datele din `FACTS`, înainte de a ajunge în școli.
- Liniile de cale ferată din `geo.js` și dacă erau deschise în 1918 (mai ales Dej–Baia Mare, Sibiu–Vințu de Jos, Brașov–Făgăraș–Sibiu, Oradea–Cluj). Deocamdată delegații din Maramureș iau trenul de la Dej.
- Contururile provinciilor istorice din `geo.js`, care sunt aproximative.
- Numele oficiale din 1918 ale orașelor (`official` în `geo.js`).

## Roadmap propus
1. MVP pentru 1 Decembrie 2026: capitolele 6–7, adică jocul actual, plus sunet, finalul cinematic cu camera deasupra mulțimii și testare pe telefoane medii.
2. Modul pentru profesori: aceeași misiune pentru toată clasa, plus un quiz din Cronică.
3. Sezonul 2 (2027): capitolele 1–5, adică 1916–1918, Mărășești, Basarabia și Bucovina.
