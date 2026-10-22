/** Fechas civiles inclusivas YYYY-MM-DD; dinero expresado en centavos MXN. */
export type Fecha = string;
export type Rol = 'administrador' | 'cliente';
export type EstadoReserva = 'apartada' | 'entregada' | 'devuelta' | 'cancelada';
export type MotivoBloqueo = 'mantenimiento' | 'dano' | 'faltante';
export interface Periodo { desde: Fecha; hasta: Fecha }
export interface Usuario {
  readonly id: string;
  nombre: string;
  correo: string;
  telefono: string;
  rol: Rol;
}
export interface Articulo {
  readonly id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  fotografias: string[];
  precioDiaCentavos: number;
  cargoDanoCentavos: number;
  valorReposicionCentavos: number;
  totalPiezas: number;
  activo: boolean;
}
export interface DetalleReserva {
  articuloId: string;
  nombre: string;
  cantidad: number;
  precioDiaCentavos: number;
  cargoDanoCentavos: number;
  valorReposicionCentavos: number;
  subtotalCentavos: number;
}
export interface Cotizacion {
  periodo: Periodo;
  dias: number;
  detalles: DetalleReserva[];
  rentaCentavos: number;
  depositoCentavos: number;
  totalInicialCentavos: number;
}
export interface ResultadoPiezas {
  articuloId: string;
  buenas: number;
  danadas: number;
  faltantes: number;
}
export interface SolicitudCancelacion {
  solicitadaEn: string;
  motivo: string;
  politica: string;
}
export interface Reserva extends Cotizacion {
  readonly id: string;
  clienteId: string;
  direccionEntrega: string;
  estado: EstadoReserva;
  creadaEn: string;
  entregaReal: string | null;
  entregaFecha: Fecha | null;
  recoleccionReal: string | null;
  recoleccionFecha: Fecha | null;
  canceladaEn: string | null;
  motivoCancelacion: string | null;
  solicitudCancelacion: SolicitudCancelacion | null;
  rentaCobradaCentavos: number;
  depositoCobradoCentavos: number;
  depositoDevueltoCentavos: number;
  depositoDevueltoEn: string | null;
  cargoIncidenciasCentavos: number;
  saldoIncidenciasCentavos: number;
  recoleccion: ResultadoPiezas[];
}
export interface Bloqueo {
  readonly id: string;
  articuloId: string;
  cantidad: number;
  periodo: Periodo;
  tipo: MotivoBloqueo;
  motivo: string;
  reservaId: string | null;
}
export interface AjusteExistencia {
  readonly id: string;
  articuloId: string;
  anterior: number;
  nueva: number;
  motivo: string;
  registradoEn: string;
}
export interface LineaSolicitud { articuloId: string; cantidad: number }
export interface SolicitudReserva {
  clienteId: string;
  periodo: Periodo;
  lineas: LineaSolicitud[];
  direccionEntrega: string;
}
export interface Disponibilidad {
  articuloId: string;
  totalPiezas: number;
  maximoOcupadas: number;
  disponibles: number;
  deficit: number;
}
export interface FiltroReservas {
  clienteId?: string;
  estado?: EstadoReserva;
  entregaDesde?: Fecha;
  entregaHasta?: Fecha;
}
