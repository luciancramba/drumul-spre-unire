# Trailer social 9:16

Două cadre generate cu Seedance 2.0, lipite local cu ffmpeg.

## Rulare

    node tools/trailer/generate.mjs --dry-run   # arată cererile, nu costă nimic
    node tools/trailer/generate.mjs             # generează shot1 și shot2 în out/
    tools/trailer/assemble.sh                   # scrie out/trailer-9x16.mp4

Cheia se citește din `SEEDANCE_API_KEY` (încărcată din `~/.seedance_key` de `~/.zshrc`).
Opțiuni: `--only shot1` / `--only shot2`.

## Costuri

Seedance 2.0, `quality_tier: mini` (tier-ul `standard` cere o achiziție de credite pe cont),
720p, cu audio. Scriptul afișează `credits_used` la fiecare trimitere. Un cadru deja
descărcat în `out/` nu se mai generează; șterge fișierul MP4 ca să regenerezi. Un prompt
schimbat înseamnă o cheie de idempotență nouă, deci o generare nouă, plătită.

## Fișiere

- `prompts.json`: cele două cadre. `image_url` de la shot2 arată spre ramura
  `feature/social-trailer`; după merge, schimbă-l pe `main`.
- `make-ref.sh` → `ref/map-portrait.jpg`: decupajul 9:16 al hărții, cadrul de start pentru shot2.
- `lib.mjs` + `lib.test.mjs`: funcțiile pure și testele (`node --test tools/trailer/`).
- `assemble.sh`: crossfade, titluri (Cormorant SC + Alegreya Sans), fade final.
- `out/` și `fonts/` sunt ignorate de git.
