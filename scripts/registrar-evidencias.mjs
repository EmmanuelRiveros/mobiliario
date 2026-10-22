import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
const tareas = [
  ['compilacion', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json']],
  ['tres-escenarios', ['dist/src/main.js']],
  ['pruebas', ['--test', '--test-reporter=spec', 'dist/test/renta.test.js']],
  ['arquitectura', ['scripts/verificar-arquitectura.mjs']],
  ['diagrama', ['scripts/modelo-diagrama.mjs']],
];
fs.mkdirSync('evidencias', { recursive: true });
const resultados = [];
for (const [nombre, args] of tareas) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });
  const salida = `$ node ${args.join(' ')}\n\n${r.stdout ?? ''}${r.stderr ?? ''}\nCódigo de salida: ${r.status}\n`;
  fs.writeFileSync(`evidencias/${nombre}.txt`, salida);
  resultados.push({ comprobacion: nombre, codigo: r.status });
  if (r.status !== 0) throw new Error(salida);
}
fs.writeFileSync('evidencias/resultados.json', JSON.stringify({ node: process.version, ejecutadoEn: new Date().toISOString(), resultados }, null, 2) + '\n');
console.log('Demostración y verificaciones guardadas en evidencias.');
