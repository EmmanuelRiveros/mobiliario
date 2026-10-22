import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const texto = fs.readFileSync('src/dominio/modelo.ts', 'utf8');
const ast = ts.createSourceFile('modelo.ts', texto, ts.ScriptTarget.Latest, true);
const modelos = [];
for (const node of ast.statements) {
  if (ts.isInterfaceDeclaration(node)) {
    modelos.push({ nombre: node.name.text, extiende: node.heritageClauses?.flatMap(h => h.types.map(t => t.expression.getText(ast))) ?? [], atributos: node.members.filter(ts.isPropertySignature).map(p => ({ nombre: p.name.getText(ast), tipo: p.type?.getText(ast) ?? 'unknown', opcional: !!p.questionToken, readonly: !!p.modifiers?.some(m => m.kind === ts.SyntaxKind.ReadonlyKeyword) })) });
  }
}
const lineas = ['classDiagram', 'direction TB'];
for (const m of modelos) {
  lineas.push(`class ${m.nombre} {`, '  <<interface>>', ...m.atributos.map(a => `  +${a.tipo.replaceAll(' | ', ' / ')} ${a.nombre}${a.opcional ? '?' : ''}`), '}');
  for (const padre of m.extiende) lineas.push(`${padre} <|-- ${m.nombre}`);
}
lineas.push(
 'Usuario "1" <-- "0..*" Reserva : clienteId',
 'Reserva "1" *-- "1..*" DetalleReserva : detalles',
 'Articulo "1" <-- "0..*" DetalleReserva : articuloId',
 'Reserva "1" *-- "0..1" SolicitudCancelacion : solicitud',
 'Reserva "1" *-- "0..*" ResultadoPiezas : recoleccion',
 'Articulo "1" <-- "0..*" ResultadoPiezas : articuloId',
 'Articulo "1" <-- "0..*" Bloqueo : articuloId',
 'Articulo "1" <-- "0..*" AjusteExistencia : articuloId',
 'Reserva "0..1" <-- "0..*" Bloqueo : reservaId',
 'Cotizacion "1" *-- "1" Periodo',
 'Bloqueo "1" *-- "1" Periodo',
 'SolicitudReserva "1" *-- "1" Periodo',
 'SolicitudReserva "1" *-- "1..*" LineaSolicitud',
);
const esperado = lineas.join('\n') + '\n';
const json = JSON.stringify(modelos, null, 2) + '\n';
if (process.argv.includes('--generar')) {
  fs.writeFileSync('docs/diagrama-clases.mmd', esperado);
  fs.writeFileSync('docs/modelo-diagrama.json', json);
  console.log('Diagrama generado desde las interfaces de modelo.ts.');
} else {
  assert.equal(fs.readFileSync('docs/diagrama-clases.mmd', 'utf8'), esperado, 'Actualizar el diagrama con node scripts/modelo-diagrama.mjs --generar');
  assert.equal(fs.readFileSync('docs/modelo-diagrama.json', 'utf8'), json);
  const escapar = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const [archivo, nombres] of [
    ['clases-reservas.svg', ['Usuario', 'Reserva', 'Cotizacion', 'DetalleReserva', 'SolicitudCancelacion', 'Periodo']],
    ['clases-inventario.svg', ['Articulo', 'Bloqueo', 'AjusteExistencia', 'ResultadoPiezas', 'Periodo']],
  ]) {
    const svg = fs.readFileSync('docs/' + archivo, 'utf8');
    for (const nombre of nombres) {
      const modelo = modelos.find(m => m.nombre === nombre);
      assert.ok(svg.includes('>' + nombre + '</text>'), `Falta ${nombre} en ${archivo}`);
      for (const atributo of modelo.atributos) assert.ok(svg.includes(escapar(`${atributo.nombre}${atributo.opcional ? '?' : ''}: ${atributo.tipo}`)), `Falta ${nombre}.${atributo.nombre} en ${archivo}`);
    }
  }
  console.log(`Diagrama consistente con ${modelos.length} interfaces y ${modelos.reduce((s, m) => s + m.atributos.length, 0)} atributos del modelo.`);
}
