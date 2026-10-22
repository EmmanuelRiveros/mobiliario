import type { Articulo, Bloqueo, Disponibilidad, Fecha, Periodo, Reserva } from './modelo.js';
import { DatosInvalidosError, PeriodoInvalidoError } from './errores.js';
const DIA = 86_400_000;
export const FIN_ABIERTO = '9999-12-31';
export function dia(fecha: Fecha): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) throw new PeriodoInvalidoError();
  const ms = Date.parse(fecha + 'T00:00:00.000Z');
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== fecha || fecha < '1900-01-01') throw new PeriodoInvalidoError();
  return ms / DIA;
}
export function periodoValido(periodo: Periodo): number {
  const inicio = dia(periodo.desde); const fin = dia(periodo.hasta);
  if (fin < inicio) throw new PeriodoInvalidoError();
  return fin - inicio + 1;
}
export function fechaDesdeDia(numero: number): Fecha { return new Date(numero * DIA).toISOString().slice(0, 10); }
export function texto(valor: string, campo: string, maximo = 500): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) throw new DatosInvalidosError(`${campo} es obligatorio y admite hasta ${maximo} caracteres.`);
  return valor.trim();
}
export function entero(valor: number, campo: string, minimo = 0): number {
  if (!Number.isSafeInteger(valor) || valor < minimo) throw new DatosInvalidosError(`${campo} debe ser un entero seguro mayor o igual a ${minimo}.`);
  return valor;
}
export function importe(valor: number): number { return entero(valor, 'El importe'); }
function finReserva(reserva: Reserva, hoy: Fecha): Fecha {
  if (reserva.estado === 'devuelta') return reserva.recoleccionFecha!;
  if (reserva.estado === 'entregada' && reserva.periodo.hasta < hoy) return FIN_ABIERTO;
  return reserva.periodo.hasta;
}
/** Barrido temporal: máximo simultáneo, nunca suma ciega de todas las reservas. */
export function disponibilidad(articulo: Articulo, periodo: Periodo, reservas: Reserva[], bloqueos: Bloqueo[], hoy: Fecha): Disponibilidad {
  periodoValido(periodo);
  const inicio = dia(periodo.desde), fin = dia(periodo.hasta);
  const eventos = new Map<number, number>();
  function agregar(desde: Fecha, hasta: Fecha, cantidad: number) {
    const a = Math.max(inicio, dia(desde)), b = Math.min(fin, dia(hasta));
    if (a > b) return;
    eventos.set(a, (eventos.get(a) ?? 0) + cantidad);
    eventos.set(b + 1, (eventos.get(b + 1) ?? 0) - cantidad);
  }
  for (const r of reservas) {
    if (r.estado === 'cancelada') continue;
    for (const detalle of r.detalles) if (detalle.articuloId === articulo.id) agregar(r.periodo.desde, finReserva(r, hoy), detalle.cantidad);
  }
  for (const b of bloqueos) if (b.articuloId === articulo.id) agregar(b.periodo.desde, b.periodo.hasta, b.cantidad);
  let ocupadas = 0, maximo = 0;
  for (const [fecha, cantidad] of [...eventos.entries()].sort((a, b) => a[0] - b[0])) {
    if (fecha > fin) break;
    ocupadas += cantidad; maximo = Math.max(maximo, ocupadas);
  }
  return { articuloId: articulo.id, totalPiezas: articulo.totalPiezas, maximoOcupadas: maximo, disponibles: Math.max(0, articulo.totalPiezas - maximo), deficit: Math.max(0, maximo - articulo.totalPiezas) };
}
