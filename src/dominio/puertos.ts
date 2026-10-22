import type { Articulo, AjusteExistencia, Bloqueo, Reserva, Usuario, Fecha } from './modelo.js';

export interface Repository<T extends { readonly id: string }> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  save(entidad: T): Promise<T>;
}
export interface DatosRenta {
  articulos: Repository<Articulo>;
  usuarios: Repository<Usuario>;
  reservas: Repository<Reserva>;
  bloqueos: Repository<Bloqueo>;
  ajustes: Repository<AjusteExistencia>;
}
/** Cada operación debe ser atómica y serializable, con rollback al lanzar un error.
 * Los resultados son copias; el callback no debe conservar referencias a los repositorios.
 * Una implementación futura de base de datos debe respetar este mismo contrato.
 */
export interface RepositorioRenta {
  transaccion<T>(operacion: (datos: DatosRenta) => Promise<T>): Promise<T>;
}
export interface Reloj { ahora(): string; hoy(): Fecha }
export interface GeneradorId { siguiente(prefijo: string): string }
