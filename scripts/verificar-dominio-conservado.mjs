import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const registros=[];
for(const nombre of fs.readdirSync('src/dominio').filter(n=>n.endsWith('.ts'))) {
 const ruta=`src/dominio/${nombre}`;
 const original=execFileSync('git',['show',`feat-dominio:${ruta}`]);
 // Git normaliza CRLF; la comparación se realiza después de normalizar saltos de línea.
 const actual=fs.readFileSync(ruta,'utf8').replaceAll('\r\n','\n');
 assert.equal(actual,original.toString('utf8').replaceAll('\r\n','\n'),`${ruta} cambió respecto al avance 1`);
 registros.push({ruta,sha256:createHash('sha256').update(actual).digest('hex')});
}
fs.mkdirSync('evidencias/avance2',{recursive:true});fs.writeFileSync('evidencias/avance2/dominio-conservado.json',JSON.stringify(registros,null,2));
console.log(`${registros.length} archivos del dominio idénticos al avance 1.`);
