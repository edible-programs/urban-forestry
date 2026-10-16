import {build} from 'esbuild';
import './ensure-data.mjs';
import {mkdir,copyFile,cp} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/app.js'],bundle:true,minify:true,sourcemap:false,outfile:'dist/app.js',format:'esm',target:'es2022'});
await copyFile('src/index.html','dist/index.html');
await copyFile('src/style.css','dist/style.css');
await copyFile('src/favicon.svg','dist/favicon.svg');
await copyFile('node_modules/maplibre-gl/dist/maplibre-gl.css','dist/maplibre.css');
await mkdir('dist/data',{recursive:true});
for(const f of ['trees.json.gz','source-manifest.json']) await copyFile('public/data/'+f,'dist/data/'+f);
for(const f of ['species.json','pruning.json','pruning-zones.geojson','tree-pruning.json','heritage.json','landmarks.geojson']) {try {await copyFile('data/'+f,'dist/data/'+f)}catch(e){if(e.code!=='ENOENT') throw e;}}
console.log('Built Canopy Atlas → dist/');
