import fs from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const source=ts.createSourceFile('modelo.ts',fs.readFileSync('src/dominio/modelo.ts','utf8'),ts.ScriptTarget.Latest,true);
const interfaces=new Map(source.statements.filter(ts.isInterfaceDeclaration).map(n=>[n.name.text,n]));
const aliases=new Map(source.statements.filter(ts.isTypeAliasDeclaration).map(n=>[n.name.text,n.type]));
function tipo(t) {
 if(t.kind===ts.SyntaxKind.StringKeyword) return {type:'string'};
 if(t.kind===ts.SyntaxKind.NumberKeyword) return {type:'integer'};
 if(t.kind===ts.SyntaxKind.BooleanKeyword) return {type:'boolean'};
 if(ts.isLiteralTypeNode(t)) {if(t.literal.kind===ts.SyntaxKind.NullKeyword)return {type:'null'};return {type:'string',const:t.literal.text};}
 if(ts.isArrayTypeNode(t))return {type:'array',items:tipo(t.elementType)};
 if(ts.isUnionTypeNode(t))return {anyOf:t.types.map(tipo)};
 if(ts.isTypeReferenceNode(t)) {const name=t.typeName.getText(source);return aliases.has(name)?tipo(aliases.get(name)):{$ref:name+'#'};}
 throw new Error('Tipo sin esquema: '+t.getText(source));
}
function interfaz(name) {
 const n=interfaces.get(name),properties={},required=[];
 for(const base of n.heritageClauses??[]) for(const t of base.types) {const b=interfaz(t.expression.getText(source));Object.assign(properties,b.properties);required.push(...b.required);}
 for(const p of n.members) {const clave=p.name.getText(source);properties[clave]=tipo(p.type);if(!p.questionToken)required.push(clave);}
 return {type:'object',properties,required,additionalProperties:false};
}
const schemas=[...interfaces.keys()].map(name=>({$id:name,...interfaz(name)}));
const texto='// Generado desde el dominio sin modificarlo: npm run esquemas.\nexport const esquemasModelo = '+JSON.stringify(schemas,null,2)+';\n';
const destino='src/servicio/esquemas-modelo.ts';
if(process.argv.includes('--check')) {assert.equal(fs.readFileSync(destino,'utf8').replaceAll('\r\n','\n'),texto);console.log(`${schemas.length} esquemas de respuesta coinciden con el dominio.`);}else fs.writeFileSync(destino,texto);
