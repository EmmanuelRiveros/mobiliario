import { RentaService } from './dominio/renta.service.js';
import { RepositorioRentaMemoria } from './infraestructura/repositorio-memoria.js';
import { IdentificadoresUuid, RelojSistema } from './infraestructura/reloj.js';
import type { RepositorioRenta, Reloj, GeneradorId } from './dominio/puertos.js';

/** Único punto que elige la implementación de almacenamiento. */
export function crearAplicacion(opciones: { repositorio?: RepositorioRenta; reloj?: Reloj; ids?: GeneradorId } = {}) {
  const repositorio = opciones.repositorio ?? new RepositorioRentaMemoria();
  const reloj = opciones.reloj ?? new RelojSistema();
  const ids = opciones.ids ?? new IdentificadoresUuid();
  return { servicio: new RentaService(repositorio, reloj, ids), repositorio };
}
