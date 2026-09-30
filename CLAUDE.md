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
- `src/style.css`: tema (tokeni pe `:root`, un singur look întunecat cu carduri pergament). Breakpoint-uri pentru telefon portret (sub 400 px acțiunile trec pe 2×2), telefon landscape (max-height 480px) și desktop larg. Verificat la 360×780, 390×844 și 780×360.
- `src/core.js`: logica pură, fără DOM (constante, `mkPath`/`at`, ceasul, scorul). Se atașează la `DSU.core` și se poate importa în Node pentru teste.
- `src/save.js`: progresul salvat în `localStorage` (cheia `dsu.v1`): cel mai bun rezultat, paginile din Cronică, sunetul. Dacă stocarea nu merge (mod privat), ține datele în memorie. Schema și validarea (`parseSave`) sunt în `core.js`.
- `src/audio.js`: sunetul, sintetizat cu Web Audio (fără fișiere audio): vânt, murmurul mulțimii (crește cu oamenii de pe câmp), fluierul și pufăitul trenurilor, clopotele de la 1 decembrie 06:00 și de la final, semnalele de interfață. Contextul audio pornește la „Începe misiunea”, pentru că browserul cere un gest al utilizatorului. Fără Web Audio (sau dacă pornirea eșuează), butonul de sunet dispare și totul devine no-op. Dacă browserul suspendă contextul (de exemplu iOS după un apel), următoarea apăsare pe un buton îl repornește.
- `src/cinematic.js`: finalul cinematic de 12 secunde (Sala Unirii → Poarta a IV-a → Câmpul lui Horea → vedere de sus), cu subtitrări pe canvas. Cadrele-cheie sunt multipli de `cam.minZ`, deci rezistă la resize. Pe telefon portret, ultimul cadru păstrează toată mulțimea. Orice atingere sau tastă sare la rezultate. Cu `prefers-reduced-motion`, sare direct la ultimul cadru.
- `src/game.js`: restul jocului, într-un IIFE, pe canvas 2D. Citește din `DSU.core`, deci `core.js` se încarcă înaintea lui.
- `tests/`: teste unitare pentru `core.js`.
- `assets/map-1918.jpg`: harta pictată cu AI (2240×1494), desenată pe lumea jocului de 1600×1067.
- `reference/`: harta originală 2K și schița de layout.
- `tools/make_layout.py` + `tools/map-prompt.md`: cum a fost generată harta.
- `tools/build-single.mjs`: build-ul cu un singur fișier (`npm run build`).
- `tools/trailer/`: trailerul social 9:16 generat cu Seedance 2.0 și lipit cu ffmpeg. Vezi `tools/trailer/README.md`.

## Cum e organizat game.js
- **Lumea** are 1600×1067 unități, cu nordul în sus. Camera (`cam`) face pan, pinch și zoom cu rotița. `clampCam` permite o margine, ca elementele să poată fi scoase de sub HUD.
- **Pe telefon** (lățime sub 500 px), canvasul folosește cel mult DPR 1,5 și 75 de fulgi în loc de 150. `resize` ignoră dimensiunea 0×0 (pagină ascunsă) și e legat de un `ResizeObserver` pe canvas.
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

## Roadmap propus
1. MVP pentru 1 Decembrie 2026: capitolele 6–7, adică jocul actual, plus sunet, finalul cinematic cu camera deasupra mulțimii și testare pe telefoane medii.
2. Modul pentru profesori: aceeași misiune pentru toată clasa, plus un quiz din Cronică.
3. Sezonul 2 (2027): capitolele 1–5, adică 1916–1918, Mărășești, Basarabia și Bucovina.
