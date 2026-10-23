import mysql from 'mysql2/promise';
import {writeFile} from 'node:fs/promises';
const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
try {
 const [columnas]=await c.execute('SELECT TABLE_NAME tabla,COLUMN_NAME nombre,COLUMN_TYPE tipo,IS_NULLABLE permiteNulo,COLUMN_KEY clave FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION',[process.env.DB_NAME]);
 const [relaciones]=await c.execute('SELECT TABLE_NAME origen,COLUMN_NAME columna,REFERENCED_TABLE_NAME destino,REFERENCED_COLUMN_NAME columnaDestino FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,COLUMN_NAME',[process.env.DB_NAME]);
 const tablas=Object.fromEntries([...new Set(columnas.map(c=>c.tabla))].map(nombre=>[nombre,columnas.filter(c=>c.tabla===nombre)]));
 await writeFile('docs/modelo-datos.json',JSON.stringify({tablas,relaciones},null,2));
 let mmd='erDiagram\n';
 for(const [nombre,cols] of Object.entries(tablas)) {
  mmd+=`  ${nombre} {\n`;
  for(const c of cols) {const tipo=c.tipo.replace(/\(.*/, '').replaceAll(' ','_');let key=c.clave==='PRI'?' PK':c.clave==='UNI'?' UK':'';if(relaciones.some(r=>r.origen===nombre&&r.columna===c.nombre))key+=key?', FK':' FK';mmd+=`    ${tipo} ${c.nombre}${key}\n`;}
  mmd+='  }\n';
 }
 for(const r of relaciones) { const cardinalidad=r.origen==='credenciales' ? '||--o|' : r.columna==='reservaId' && r.origen==='bloqueos' ? '|o--o{' : '||--o{'; mmd+=`  ${r.destino} ${cardinalidad} ${r.origen} : "${r.columna}"\n`; }
 await writeFile('docs/modelo-datos.mmd',mmd);
 const [version]=await c.query('SELECT VERSION() AS version');const [migraciones]=await c.query('SELECT nombre,sha256,aplicadaEn FROM schema_migrations ORDER BY nombre');
 await writeFile('evidencias/avance2/persistencia.json',JSON.stringify({motor:version[0].version,tablas:Object.keys(tablas),migraciones,nota:'Sólo metadatos; no se exportan cuentas, hashes ni secretos.'},null,2));
 console.log(`${Object.keys(tablas).length} tablas, ${columnas.length} columnas y ${relaciones.length} relaciones documentadas desde MySQL.`);
} finally {await c.end();}
