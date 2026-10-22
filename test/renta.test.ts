import assert from 'node:assert/strict';
import test from 'node:test';
import { crearAplicacion } from '../src/composicion.js';
import { RepositorioRentaMemoria } from '../src/infraestructura/repositorio-memoria.js';
import type { RepositorioRenta, Reloj } from '../src/dominio/puertos.js';
import type { Articulo, Reserva, Periodo } from '../src/dominio/modelo.js';
import { disponibilidad, periodoValido } from '../src/dominio/calculos.js';
import {
  ArticuloInactivoError, ClienteRequeridoError, CobroRentaIncorrectoError, CorreoDuplicadoError,
  DatosInvalidosError, DepositoIncorrectoError, DevolucionDepositoInvalidaError,
  DisponibilidadInsuficienteError, EntidadNoEncontradaError, EstadoReservaInvalidoError,
  ExistenciasComprometidasError, FechaOperacionInvalidaError, PeriodoInvalidoError,
  RecoleccionInconsistenteError, ReservaAjenaError, SolicitudDuplicadaError,
} from '../src/dominio/errores.js';

const periodo: Periodo = { desde: '2027-06-12', hasta: '2027-06-14' };
class RelojManual implements Reloj {
  fecha = '2027-06-01';
  ahora() { return this.fecha + 'T12:00:00-07:00'; }
  hoy() { return this.fecha; }
}
const articuloBase: Omit<Articulo, 'id'> = { nombre: 'Silla', descripcion: 'Silla plegable', categoria: 'Sillas', fotografias: ['silla.svg'], precioDiaCentavos: 1500, cargoDanoCentavos: 15000, valorReposicionCentavos: 45000, totalPiezas: 100, activo: true };
async function fixture(total = 100, repositorio?: RepositorioRenta) {
  const reloj = new RelojManual(); let n = 0;
  const app = crearAplicacion({ reloj, ids: { siguiente: p => `${p}-${++n}` }, ...(repositorio ? { repositorio } : {}) });
  const s = app.servicio;
  const cliente = await s.registrarUsuario({ nombre: 'Ana', correo: 'ana@example.test', telefono: '6440000000', rol: 'cliente' });
  const articulo = await s.registrarArticulo({ ...articuloBase, totalPiezas: total });
  const reservar = (cantidad: number, fechas = periodo) => s.confirmarReserva({ clienteId: cliente.id, periodo: fechas, direccionEntrega: 'Domicilio de prueba', lineas: [{ articuloId: articulo.id, cantidad }] });
  return { ...app, s, reloj, cliente, articulo, reservar };
}
async function entregada(cantidad = 10) {
  const f = await fixture(); const reserva = await f.reservar(cantidad); f.reloj.fecha = periodo.desde;
  await f.s.registrarEntrega(reserva.id, { depositoCentavos: reserva.depositoCentavos, rentaCentavos: reserva.rentaCentavos });
  return { ...f, reserva };
}

test('cotiza días inclusivos, renta y garantía del 20 por ciento', async () => {
  const f = await fixture(); const r = await f.reservar(80);
  assert.equal(r.dias, 3); assert.equal(r.rentaCentavos, 360000); assert.equal(r.depositoCentavos, 72000);
  assert.equal(r.totalInicialCentavos, 432000); assert.equal(r.estado, 'apartada');
});
test('acepta la capacidad exacta y rechaza una pieza adicional', async () => {
  const f = await fixture(10); await f.reservar(10);
  await assert.rejects(f.reservar(1), DisponibilidadInsuficienteError);
  assert.equal((await f.s.consultarReservas()).length, 1);
});
test('rechaza reservas traslapadas incluso por el último día', async () => {
  const f = await fixture(10); await f.reservar(8);
  await assert.rejects(f.reservar(3, { desde: '2027-06-14', hasta: '2027-06-16' }), DisponibilidadInsuficienteError);
});
test('permite reutilizar todas las piezas el día siguiente al final', async () => {
  const f = await fixture(10); await f.reservar(10); await f.reservar(10, { desde: '2027-06-15', hasta: '2027-06-16' });
  assert.equal((await f.s.consultarReservas()).length, 2);
});
test('consulta amplia usa el máximo simultáneo y no suma reservas separadas', async () => {
  const f = await fixture(10); await f.reservar(6, { desde: '2027-06-10', hasta: '2027-06-11' }); await f.reservar(6, { desde: '2027-06-13', hasta: '2027-06-14' });
  const d = await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-10', hasta: '2027-06-14' }); assert.equal(d.disponibles, 4);
});
test('el mantenimiento descuenta únicamente en su rango y respeta reservas', async () => {
  const f = await fixture(10); await f.reservar(6);
  await f.s.bloquearMantenimiento(f.articulo.id, 4, periodo, 'Limpieza');
  await assert.rejects(f.reservar(1), DisponibilidadInsuficienteError);
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-15', hasta: '2027-06-15' })).disponibles, 10);
  await assert.rejects(f.s.bloquearMantenimiento(f.articulo.id, 1, periodo, 'Otro bloqueo'), DisponibilidadInsuficienteError);
});
test('ajuste rechaza menos piezas que el máximo futuro y registra el motivo', async () => {
  const f = await fixture(10); await f.reservar(8);
  await assert.rejects(f.s.ajustarExistencias(f.articulo.id, 7, 'Baja'), ExistenciasComprometidasError);
  assert.equal((await f.s.ajustarExistencias(f.articulo.id, 8, 'Baja de dos piezas libres')).anterior, 10);
});
test('un bloqueo también compromete existencias y los periodos separados no se suman', async () => {
  const f = await fixture(10); await f.reservar(8);
  await f.s.bloquearMantenimiento(f.articulo.id, 9, { desde: '2027-07-01', hasta: '2027-07-03' }, 'Revisión');
  await assert.rejects(f.s.ajustarExistencias(f.articulo.id, 8, 'Baja'), ExistenciasComprometidasError);
  await f.s.ajustarExistencias(f.articulo.id, 9, 'Una pieza menos');
});
test('dos confirmaciones concurrentes no sobreasignan las mismas piezas', async () => {
  const f = await fixture(10); const resultados = await Promise.allSettled([f.reservar(6), f.reservar(6)]);
  assert.equal(resultados.filter(r => r.status === 'fulfilled').length, 1);
  const fallo = resultados.find(r => r.status === 'rejected'); assert.ok(fallo && fallo.reason instanceof DisponibilidadInsuficienteError);
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, periodo)).disponibles, 4);
});
test('cotizar no aparta y confirmar recalcula disponibilidad', async () => {
  const f = await fixture(10); await f.s.cotizar(periodo, [{ articuloId: f.articulo.id, cantidad: 8 }]);
  assert.equal((await f.s.consultarReservas()).length, 0);
  await f.reservar(5); await assert.rejects(f.reservar(8), DisponibilidadInsuficienteError);
});
test('una reserva de varios artículos se rechaza completa si falla uno', async () => {
  const f = await fixture(10); const mesa = await f.s.registrarArticulo({ ...articuloBase, nombre: 'Mesa', totalPiezas: 1 });
  await assert.rejects(f.s.confirmarReserva({ clienteId: f.cliente.id, direccionEntrega: 'Dirección', periodo, lineas: [{ articuloId: f.articulo.id, cantidad: 8 }, { articuloId: mesa.id, cantidad: 2 }] }), DisponibilidadInsuficienteError);
  assert.equal((await f.s.consultarReservas()).length, 0); assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, periodo)).disponibles, 10);
});
test('las cantidades deben ser enteras positivas y cada artículo aparece una vez', async () => {
  const f = await fixture(); for (const cantidad of [0, -1, 1.5, Number.NaN, Infinity]) await assert.rejects(f.reservar(cantidad), DatosInvalidosError);
  await assert.rejects(f.s.cotizar(periodo, [{ articuloId: f.articulo.id, cantidad: 1 }, { articuloId: f.articulo.id, cantidad: 1 }]), DatosInvalidosError);
  await assert.rejects(f.s.cotizar(periodo, []), DatosInvalidosError);
});
test('valida fechas reales, orden y años bisiestos', () => {
  assert.equal(periodoValido({ desde: '2028-02-28', hasta: '2028-03-01' }), 3);
  for (const p of [{ desde: '2027-02-29', hasta: '2027-03-01' }, { desde: '2027-06-15', hasta: '2027-06-14' }, { desde: '12/06/2027', hasta: '2027-06-14' }]) assert.throws(() => periodoValido(p), PeriodoInvalidoError);
});
test('rechaza nuevas reservas y mantenimiento en el pasado', async () => {
  const f = await fixture(); await assert.rejects(f.reservar(1, { desde: '2027-05-31', hasta: '2027-06-02' }), FechaOperacionInvalidaError);
  await assert.rejects(f.s.bloquearMantenimiento(f.articulo.id, 1, { desde: '2027-05-31', hasta: '2027-06-02' }, 'Limpieza'), FechaOperacionInvalidaError);
});
test('correo se normaliza y no se puede repetir', async () => {
  const f = await fixture(); await assert.rejects(f.s.registrarUsuario({ nombre: 'Otro', correo: ' ANA@example.test ', telefono: '1', rol: 'cliente' }), CorreoDuplicadoError);
  await assert.rejects(f.s.registrarUsuario({ nombre: 'Otro', correo: 'sin-arroba', telefono: '1', rol: 'cliente' }), DatosInvalidosError);
});
test('las reservas solo pueden asociarse a un usuario cliente existente', async () => {
  const f = await fixture(); const admin = await f.s.registrarUsuario({ nombre: 'Admin', correo: 'admin@example.test', telefono: '1', rol: 'administrador' });
  await assert.rejects(f.s.confirmarReserva({ clienteId: admin.id, periodo, direccionEntrega: 'Dirección', lineas: [{ articuloId: f.articulo.id, cantidad: 1 }] }), ClienteRequeridoError);
  await assert.rejects(f.s.detalleReserva('no-existe'), EntidadNoEncontradaError);
});
test('rechaza precios y existencias inválidos y desbordamientos monetarios', async () => {
  const f = await fixture(); await assert.rejects(f.s.registrarArticulo({ ...articuloBase, precioDiaCentavos: 1.5 }), DatosInvalidosError);
  await assert.rejects(f.s.registrarArticulo({ ...articuloBase, totalPiezas: -1 }), DatosInvalidosError);
  await assert.rejects(f.s.registrarArticulo({ ...articuloBase, cargoDanoCentavos: 999999 }), DatosInvalidosError);
  const caro = await f.s.registrarArticulo({ ...articuloBase, precioDiaCentavos: Number.MAX_SAFE_INTEGER });
  await assert.rejects(f.s.cotizar(periodo, [{ articuloId: caro.id, cantidad: 2 }]), DatosInvalidosError);
});
test('conserva precios históricos aunque cambie el catálogo', async () => {
  const f = await fixture(); const r = await f.reservar(1); const { totalPiezas: _, id: __, ...cambios } = f.articulo;
  await f.s.editarArticulo(f.articulo.id, { ...cambios, precioDiaCentavos: 5000 });
  assert.equal((await f.s.detalleReserva(r.id)).reserva.rentaCentavos, 4500);
  assert.equal((await f.s.cotizar(periodo, [{ articuloId: f.articulo.id, cantidad: 1 }])).rentaCentavos, 15000);
});
test('filtra catálogo y no permite nuevas reservas de artículos inactivos', async () => {
  const f = await fixture(); assert.equal((await f.s.explorarCatalogo({ categoria: 'Sillas', nombre: 'si', precioMinimoCentavos: 1000, precioMaximoCentavos: 2000 })).length, 1);
  const { totalPiezas: _, id: __, ...cambios } = f.articulo; await f.s.editarArticulo(f.articulo.id, { ...cambios, activo: false });
  assert.equal((await f.s.explorarCatalogo()).length, 0); await assert.rejects(f.reservar(1), ArticuloInactivoError);
});
test('la solicitud de cancelación no libera stock; la cancelación administrativa sí', async () => {
  const f = await fixture(10); const r = await f.reservar(8); const solicitud = await f.s.solicitarCancelacion(r.id, f.cliente.id, 'Cambio de fecha');
  assert.match(solicitud.solicitudCancelacion!.politica, /Sin penalización/);
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, periodo)).disponibles, 2);
  await assert.rejects(f.s.solicitarCancelacion(r.id, f.cliente.id, 'Otra solicitud'), SolicitudDuplicadaError);
  await f.s.cancelarReserva(r.id, 'Solicitud aprobada'); assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, periodo)).disponibles, 10);
});
test('no permite solicitar cancelar una reserva ajena ni cancelar una ya entregada', async () => {
  const f = await entregada(); await assert.rejects(f.s.solicitarCancelacion(f.reserva.id, 'otro-cliente', 'Motivo'), ReservaAjenaError);
  await assert.rejects(f.s.cancelarReserva(f.reserva.id, 'Motivo'), EstadoReservaInvalidoError);
});
test('la entrega requiere fecha, depósito y renta correctos; no se repite', async () => {
  const f = await fixture(); const r = await f.reservar(2); const cobro = { depositoCentavos: r.depositoCentavos, rentaCentavos: r.rentaCentavos };
  await assert.rejects(f.s.registrarEntrega(r.id, cobro), FechaOperacionInvalidaError); f.reloj.fecha = periodo.desde;
  await assert.rejects(f.s.registrarEntrega(r.id, { ...cobro, depositoCentavos: 0 }), DepositoIncorrectoError);
  await assert.rejects(f.s.registrarEntrega(r.id, { ...cobro, rentaCentavos: 0 }), CobroRentaIncorrectoError);
  await f.s.registrarEntrega(r.id, cobro); await assert.rejects(f.s.registrarEntrega(r.id, cobro), EstadoReservaInvalidoError);
});
test('recolección valida sumas y no guarda un resultado parcial incorrecto', async () => {
  const f = await entregada(10); await assert.rejects(f.s.registrarRecoleccion(f.reserva.id, [{ articuloId: f.articulo.id, buenas: 9, danadas: 0, faltantes: 0 }]), RecoleccionInconsistenteError);
  assert.equal((await f.s.detalleReserva(f.reserva.id)).reserva.estado, 'entregada');
});
test('recolección temprana libera buenas al día siguiente y bloquea dañadas y faltantes', async () => {
  const f = await entregada(10); f.reloj.fecha = '2027-06-13';
  const resultado = await f.s.registrarRecoleccion(f.reserva.id, [{ articuloId: f.articulo.id, buenas: 8, danadas: 1, faltantes: 1 }]);
  assert.equal(resultado.reserva.cargoIncidenciasCentavos, 60000); assert.equal(resultado.depositoLiberableCentavos, 0); assert.equal(resultado.reserva.saldoIncidenciasCentavos, 51000);
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-14', hasta: '2027-06-14' })).disponibles, 98);
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-13', hasta: '2027-06-13' })).disponibles, 90);
});
test('devuelve solo el depósito liberable y no permite devolverlo dos veces', async () => {
  const f = await entregada(10); f.reloj.fecha = '2027-06-14'; await f.s.registrarRecoleccion(f.reserva.id, [{ articuloId: f.articulo.id, buenas: 10, danadas: 0, faltantes: 0 }]);
  await assert.rejects(f.s.registrarDevolucionDeposito(f.reserva.id, 1), DevolucionDepositoInvalidaError);
  const r = await f.s.registrarDevolucionDeposito(f.reserva.id, f.reserva.depositoCentavos); assert.equal(r.depositoDevueltoCentavos, 9000);
  await assert.rejects(f.s.registrarDevolucionDeposito(f.reserva.id, 9000), DevolucionDepositoInvalidaError);
});
test('saldo del depósito se limita a cero y el exceso queda como cargo pendiente', async () => {
  const f = await entregada(10); f.reloj.fecha = '2027-06-14';
  const r = await f.s.registrarRecoleccion(f.reserva.id, [{ articuloId: f.articulo.id, buenas: 0, danadas: 0, faltantes: 10 }]);
  assert.equal(r.depositoLiberableCentavos, 0); assert.equal(r.reserva.saldoIncidenciasCentavos, 441000);
});
test('una recolección atrasada mantiene piezas ocupadas y bloquea nuevas reservas', async () => {
  const f = await entregada(100); f.reloj.fecha = '2027-06-15';
  assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-16', hasta: '2027-06-20' })).disponibles, 0);
  await assert.rejects(f.reservar(1, { desde: '2027-06-16', hasta: '2027-06-20' }), DisponibilidadInsuficienteError);
});
test('daños reales se registran y señalan reservas futuras afectadas', async () => {
  const f = await fixture(10); const primera = await f.reservar(10); const segunda = await f.reservar(10, { desde: '2027-06-15', hasta: '2027-06-16' });
  f.reloj.fecha = '2027-06-12'; await f.s.registrarEntrega(primera.id, { depositoCentavos: primera.depositoCentavos, rentaCentavos: primera.rentaCentavos });
  f.reloj.fecha = '2027-06-14'; const resultado = await f.s.registrarRecoleccion(primera.id, [{ articuloId: f.articulo.id, buenas: 9, danadas: 1, faltantes: 0 }]);
  assert.deepEqual(resultado.reservasAfectadas, [segunda.id]); f.reloj.fecha = '2027-06-15';
  await assert.rejects(f.s.registrarEntrega(segunda.id, { depositoCentavos: segunda.depositoCentavos, rentaCentavos: segunda.rentaCentavos }), DisponibilidadInsuficienteError);
});
test('cerrar un bloqueo libera piezas al día siguiente y rechaza cierre retroactivo', async () => {
  const f = await fixture(10); const b = await f.s.bloquearMantenimiento(f.articulo.id, 3, { desde: '2027-06-01', hasta: '2027-06-20' }, 'Reparación');
  await f.s.terminarBloqueo(b.id, '2027-06-02'); assert.equal((await f.s.consultarDisponibilidad(f.articulo.id, { desde: '2027-06-03', hasta: '2027-06-03' })).disponibles, 10);
  f.reloj.fecha = '2027-06-03'; await assert.rejects(f.s.terminarBloqueo(b.id, '2027-06-02'), FechaOperacionInvalidaError);
});
test('calendario e historial se filtran y el ingreso excluye la garantía', async () => {
  const f = await entregada(2); const calendario = await f.s.calendario(periodo); assert.equal(calendario.length, 3);
  assert.deepEqual(calendario[0]!.entregas, [f.reserva.id]); assert.deepEqual(calendario[2]!.recolecciones, [f.reserva.id]);
  const resumen = await f.s.resumenNegocio(periodo); assert.equal(resumen.ingresoRentasCentavos, 9000);
  assert.equal((await f.s.consultarReservas({ clienteId: f.cliente.id, estado: 'entregada', entregaDesde: periodo.desde, entregaHasta: periodo.desde })).length, 1);
  assert.equal((await f.s.consultarReservas({ clienteId: 'otro' })).length, 0);
  await assert.rejects(f.s.calendario({ desde: '2027-01-01', hasta: '2028-12-31' }), DatosInvalidosError);
});
test('el repositorio entrega copias y revierte una transacción que falla', async () => {
  const repo = new RepositorioRentaMemoria(); const f = await fixture(100, repo);
  const catalogo = await f.s.explorarCatalogo(); catalogo[0]!.totalPiezas = 0;
  assert.equal((await f.s.explorarCatalogo())[0]!.totalPiezas, 100);
  await assert.rejects(repo.transaccion(async datos => { const a = (await datos.articulos.findById(f.articulo.id))!; a.totalPiezas = 1; await datos.articulos.save(a); throw new Error('Fallo simulado'); }), /Fallo simulado/);
  assert.equal((await f.s.explorarCatalogo())[0]!.totalPiezas, 100); await f.reservar(80);
});
test('el repositorio alternativo se inyecta sin modificar el servicio', async () => {
  let llamadas = 0; const base = new RepositorioRentaMemoria();
  const alternativo: RepositorioRenta = { transaccion: async operacion => { llamadas++; return base.transaccion(operacion); } };
  const f = await fixture(10, alternativo); await f.reservar(8); assert.ok(llamadas >= 3);
});
test('el barrido de disponibilidad coincide con un conteo diario independiente', () => {
  let semilla = 193; const azar = (max: number) => { semilla = (semilla * 48271) % 2147483647; return semilla % max; };
  const articulo: Articulo = { ...articuloBase, id: 'A' };
  for (let prueba = 0; prueba < 120; prueba++) {
    const reservas: Reserva[] = Array.from({ length: 12 }, (_, i) => {
      const desde = azar(20) + 1, hasta = desde + azar(8), cantidad = azar(8) + 1;
      return { id: String(i), estado: 'apartada', periodo: { desde: `2027-06-${String(desde).padStart(2, '0')}`, hasta: `2027-06-${String(hasta).padStart(2, '0')}` }, detalles: [{ articuloId: 'A', cantidad }] } as Reserva;
    });
    const esperado = Math.max(...Array.from({ length: 30 }, (_, i) => { const fecha = `2027-06-${String(i + 1).padStart(2, '0')}`; return reservas.filter(r => r.periodo.desde <= fecha && r.periodo.hasta >= fecha).reduce((s, r) => s + r.detalles[0]!.cantidad, 0); }));
    assert.equal(disponibilidad(articulo, { desde: '2027-06-01', hasta: '2027-06-30' }, reservas, [], '2027-06-01').maximoOcupadas, esperado);
  }
});
