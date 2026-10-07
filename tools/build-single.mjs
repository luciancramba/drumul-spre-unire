// Builds dist/drumul-spre-unire.html: one file with the CSS, the scripts and the two map images inlined.
// This is the version published as a claude.ai artifact.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=join(root,'dist','drumul-spre-unire.html');
const LIMIT=16*1024*1024;
const ASSETS=['assets/map-1918.jpg','assets/region-1918.jpg'];

const read=p=>readFileSync(join(root,p),'utf8');
let html=read('index.html');
let styles=0,scripts=0;
const inlined=new Set();

html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,href)=>{styles++;return `<style>\n${read(href)}</style>`});
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>{
  scripts++;
  let code=read(src);
  for(const asset of ASSETS)if(code.includes(asset)){
    inlined.add(asset);
    const uri='data:image/jpeg;base64,'+readFileSync(join(root,asset)).toString('base64');
    code=code.split(asset).join(uri);
  }
  return `<script>\n${code.replace(/<\/script/gi,'<\\/script')}</script>`;
});

if(!styles||!scripts||inlined.size!==ASSETS.length){
  console.error(`build: expected a stylesheet, scripts and a reference to every map image (got ${styles}, ${scripts}, ${inlined.size} of ${ASSETS.length} images)`);
  process.exit(1);
}
const size=Buffer.byteLength(html);
if(size>LIMIT){
  console.error(`build: ${(size/1048576).toFixed(2)} MB is over the 16 MB artifact limit`);
  process.exit(1);
}
mkdirSync(dirname(OUT),{recursive:true});
writeFileSync(OUT,html);
console.log(`build: ${OUT.slice(root.length+1)} · ${scripts} scripts · ${(size/1048576).toFixed(2)} MB`);
