import assert from 'node:assert/strict';
import { crearAplicacion } from './composicion.js';
import { prepararDemostracion } from './datos-demostracion.js';
import { DisponibilidadInsuficienteError, ExistenciasComprometidasError } from './dominio/errores.js';
import type { GeneradorId, Reloj } from './dominio/puertos.js';

// Fecha fija para que los tres escenarios se reproduzcan cualquier día.
const reloj: Reloj = { ahora: () => '2027-06-01T12:00:00-07:00', hoy: () => '2027-06-01' };
let secuencia = 0;
const ids: GeneradorId = { siguiente: prefijo => `${prefijo}-${String(++secuencia).padStart(3, '0')}` };
const { servicio } = crearAplicacion({ reloj, ids });
const { cliente, sillas } = await prepararDemostracion(servicio);
const periodo = { desde: '2027-06-12', hasta: '2027-06-14' };
const dinero = (centavos: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(centavos / 100);
console.log('AVANCE 1 · RENTA DE MOBILIARIO PARA EVENTOS SOCIALES');
console.log('Demostración en memoria · fecha simulada: 2027-06-01');
console.log('Fechas inclusivas: del 12 al 14 de junio de 2027 = 3 días.\n');
const reserva = await servicio.confirmarReserva({ clienteId: cliente.id, periodo, direccionEntrega: 'Domicilio ficticio del evento', lineas: [{ articuloId: sillas.id, cantidad: 80 }] });
assert.equal(reserva.rentaCentavos, 360000); assert.equal(reserva.depositoCentavos, 72000);
console.log('1. ACEPTADO · reservar 80 de las 100 sillas');
console.log(`Reserva ${reserva.id} | renta: ${dinero(reserva.rentaCentavos)} | garantía: ${dinero(reserva.depositoCentavos)} | total inicial: ${dinero(reserva.totalInicialCentavos)}`);
console.log(`Disponibles en esas fechas: ${(await servicio.consultarDisponibilidad(sillas.id, periodo)).disponibles}\n`);
await assert.rejects(async () => {
  try { await servicio.confirmarReserva({ clienteId: cliente.id, periodo, direccionEntrega: 'Otro domicilio ficticio', lineas: [{ articuloId: sillas.id, cantidad: 30 }] }); }
  catch (error) { if (error instanceof DisponibilidadInsuficienteError) { console.log('2. RECHAZADO · reservar otras 30 sillas traslapadas'); console.log(`${error.codigo}: ${error.message}\n`); } throw error; }
}, DisponibilidadInsuficienteError);
await assert.rejects(async () => {
  try { await servicio.ajustarExistencias(sillas.id, 70, 'Baja solicitada de treinta piezas'); }
  catch (error) { if (error instanceof ExistenciasComprometidasError) { console.log('3. RECHAZADO · reducir existencias a 70 con 80 apartadas'); console.log(`${error.codigo}: ${error.message}\n`); } throw error; }
}, ExistenciasComprometidasError);
assert.equal((await servicio.consultarReservas()).length, 1);
assert.equal((await servicio.consultarDisponibilidad(sillas.id, periodo)).totalPiezas, 100);
console.log('Resultado: 3 de 3 escenarios correctos. Los rechazos no modificaron los datos.');
