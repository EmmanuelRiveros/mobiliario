import { RepositorioRentaMysql } from './infraestructura/repositorio-mysql.js';
import type { Pool } from 'mysql2/promise';
import { RentaService } from './dominio/renta.service.js';
import { RepositorioRentaMemoria } from './infraestructura/repositorio-memoria.js';
import { IdentificadoresUuid, RelojSistema } from './infraestructura/reloj.js';
import type { RepositorioRenta, Reloj, GeneradorId } from './dominio/puertos.js';

/** Único punto que elige la implementación de almacenamiento. */
export function crearAplicacion(opciones: { repositorio?: RepositorioRenta; reloj?: Reloj; ids?: GeneradorId; pool?: Pool } = {}) {
  const repositorio = opciones.repositorio ?? (opciones.pool ? new RepositorioRentaMysql(opciones.pool) : new RepositorioRentaMemoria());
  const reloj = opciones.reloj ?? new RelojSistema();
  const ids = opciones.ids ?? new IdentificadoresUuid();
  return { servicio: new RentaService(repositorio, reloj, ids), repositorio };
}
