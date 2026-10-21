import {copyFile,mkdir,readdir,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const out=path.join(root,'dist');
await rm(out,{recursive:true,force:true});await mkdir(path.join(out,'icons'),{recursive:true});
for(const file of ['index.html','app.js','style.css','manifest.webmanifest','sw.js'])await copyFile(path.join(root,file),path.join(out,file));
for(const file of await readdir(path.join(root,'icons'))){if(/\.(png|svg|webp|ico)$/i.test(file))await copyFile(path.join(root,'icons',file),path.join(out,'icons',file))}
console.log('Static website prepared in dist; backend modules excluded.');
