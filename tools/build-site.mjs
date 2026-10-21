// Builds dist-site/: the waiting-list page at / and the single-file game at /joaca/ (run build-single.mjs first).
// This is the folder deployed to unire.cramba.ro.
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,rmSync,existsSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=join(root,'dist-site'),GAME=join(root,'dist','drumul-spre-unire.html');

if(!existsSync(GAME)){console.error('build-site: run "npm run build" first (dist/drumul-spre-unire.html is missing)');process.exit(1)}
rmSync(OUT,{recursive:true,force:true});
mkdirSync(join(OUT,'joaca'),{recursive:true});
for(const f of ['index.html','landing.js','app.js'])copyFileSync(join(root,'site',f),join(OUT,f));
copyFileSync(join(root,'assets','region-1918.jpg'),join(OUT,'region.jpg'));
copyFileSync(GAME,join(OUT,'joaca','index.html'));
// the landing page must always load fresh (the countdown and the form depend on it); the game and the picture can be cached
writeFileSync(join(OUT,'_headers'),`/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
/
  Cache-Control: public, max-age=0, must-revalidate
/*.js
  Cache-Control: public, max-age=0, must-revalidate
/region.jpg
  Cache-Control: public, max-age=86400
`);
const size=(readFileSync(join(OUT,'index.html')).length+readFileSync(GAME).length)/1048576;
console.log(`build-site: dist-site/ · / + /joaca/ · ${size.toFixed(2)} MB of pages`);
