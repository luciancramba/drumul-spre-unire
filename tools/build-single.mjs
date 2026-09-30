// Builds dist/drumul-spre-unire.html: one file with the CSS, the scripts and the map inlined.
// This is the version published as a claude.ai artifact.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const OUT=join(root,'dist','drumul-spre-unire.html');
const LIMIT=16*1024*1024;
const MAP='assets/map-1918.jpg';

const read=p=>readFileSync(join(root,p),'utf8');
let html=read('index.html');
let styles=0,scripts=0,maps=0;

html=html.replace(/<link rel="stylesheet" href="([^"]+)">/g,(_,href)=>{styles++;return `<style>\n${read(href)}</style>`});
html=html.replace(/<script src="([^"]+)"><\/script>/g,(_,src)=>{
  scripts++;
  let code=read(src);
  if(code.includes(MAP)){
    maps++;
    const uri='data:image/jpeg;base64,'+readFileSync(join(root,MAP)).toString('base64');
    code=code.split(MAP).join(uri);
  }
  return `<script>\n${code.replace(/<\/script/gi,'<\\/script')}</script>`;
});

if(!styles||!scripts||!maps){
  console.error(`build: expected a stylesheet, scripts and the map reference (got ${styles}, ${scripts}, ${maps})`);
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
