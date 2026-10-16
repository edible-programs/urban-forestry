import {existsSync} from 'node:fs';
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
// Keep the reproducible compressed snapshot in Git; restore the large working
// JSON for local analysis and validation when opening a fresh checkout.
if(!existsSync('public/data/trees.json')){
 await writeFile('public/data/trees.json',gunzipSync(await readFile('public/data/trees.json.gz')));
 console.log('Restored full inventory from the bundled gzip snapshot.');
}
