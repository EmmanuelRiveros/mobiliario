import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import assert from 'node:assert/strict';
const base = path.resolve('src/dominio');
const archivos = fs.readdirSync(base).filter(x => x.endsWith('.ts'));
for (const archivo of archivos) {
  const contenido = fs.readFileSync(path.join(base, archivo), 'utf8');
  const ast = ts.createSourceFile(archivo, contenido, ts.ScriptTarget.Latest, true);
  for (const node of ast.statements) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      const destino = node.moduleSpecifier.text;
      assert.ok(destino.startsWith('./') && !destino.includes('..'), `${archivo} importa fuera del dominio: ${destino}`);
      assert.ok(fs.existsSync(path.join(base, destino.replace(/\.js$/, '.ts'))), `Import inexistente: ${destino}`);
    }
  }
  assert.ok(!/\b(?:fetch|process|console|require)\s*[.(]/.test(contenido), `Efecto externo en ${archivo}`);
}
const servicio = fs.readFileSync(path.join(base, 'renta.service.ts'), 'utf8');
assert.ok(!servicio.includes('RepositorioRentaMemoria'));
const referencias = [];
function recorrer(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) recorrer(file);
    else if (file.endsWith('.ts') && fs.readFileSync(file, 'utf8').includes('new RepositorioRentaMemoria(')) referencias.push(file.replaceAll('\\', '/'));
  }
}
recorrer('src');
assert.deepEqual(referencias, ['src/composicion.ts']);
console.log(`Arquitectura correcta: ${archivos.length} archivos de dominio sin dependencias externas. El almacenamiento se elige únicamente en src/composicion.ts.`);
