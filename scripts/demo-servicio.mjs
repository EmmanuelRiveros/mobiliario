import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
const base=process.env.SERVICE_URL ?? `http://${process.env.HOST??'127.0.0.1'}:${process.env.PORT??3000}`;
const evidencias=[];
async function pedir(caso,method,ruta,estado,body,token) {
 const inicio=performance.now();const res=await fetch(base+ruta,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(token?{authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const json=await res.json();assert.equal(res.status,estado,`${caso}: ${JSON.stringify(json)}`);
 // Las sesiones se usan en memoria. Nunca se guardan sus tokens ni las contraseñas.
 if(ruta!=='/sesiones') {
  const registro={caso,metodo:method,ruta,estado:res.status,duracionMs:Math.round((performance.now()-inicio)*100)/100,respuesta:json};evidencias.push(registro);
  console.log(`\n${caso}\n${method} ${ruta} -> ${res.status}\n${JSON.stringify(json,null,2)}`);
 }
 return json.datos;
}
const admin=await pedir('Sesión administrador','POST','/sesiones',200,{correo:'admin@example.test',password:process.env.SEED_ADMIN_PASSWORD});
const cliente=await pedir('Sesión cliente','POST','/sesiones',200,{correo:'cliente@example.test',password:process.env.SEED_CLIENT_PASSWORD});
const articulo={nombre:`Silla demostración ${Date.now()}`,descripcion:'Artículo ficticio del recorrido del avance 2',categoria:'Demostración',fotografias:['docs/imagenes/silla.svg'],precioDiaCentavos:1500,cargoDanoCentavos:15000,valorReposicionCentavos:45000,totalPiezas:100,activo:true};
await pedir('1 Sin credencial','POST','/articulos',401,articulo);
await pedir('2 Credencial de rol cliente','POST','/articulos',403,articulo,cliente.token);
const creado=await pedir('3 Credencial de administrador','POST','/articulos',201,articulo,admin.token);
const desde=new Date(Date.now()+7*86400000).toISOString().slice(0,10),hasta=new Date(Date.now()+9*86400000).toISOString().slice(0,10);
const solicitud={periodo:{desde,hasta},lineas:[{articuloId:creado.id,cantidad:80}],direccionEntrega:'Domicilio ficticio del evento'};
await pedir('4 Reserva aceptada de 80 piezas por tres días','POST','/reservas',201,solicitud,cliente.token);
await pedir('5 Sobreventa rechazada por el dominio','POST','/reservas',409,{...solicitud,lineas:[{articuloId:creado.id,cantidad:30}]},cliente.token);
await pedir('6 Reducción que afecta compromisos','POST',`/articulos/${creado.id}/ajustes`,409,{nueva:70,motivo:'Baja de treinta piezas'},admin.token);
const partes=cliente.token.split('.');const carga=JSON.parse(Buffer.from(partes[1],'base64url').toString());carga.sub=admin.usuario.id;partes[1]=Buffer.from(JSON.stringify(carga)).toString('base64url');
await pedir('7 Token alterado rechazado','POST','/articulos',401,articulo,partes.join('.'));
await pedir('8 Disponibilidad persistida','GET',`/articulos/${creado.id}/disponibilidad?desde=${desde}&hasta=${hasta}`,200);
await mkdir('evidencias/avance2',{recursive:true});await writeFile('evidencias/avance2/demo-http.json',JSON.stringify({base,casos:evidencias},null,2));
console.log('\nOcho casos correctos. Las credenciales de sesión no se guardaron en la evidencia.');
