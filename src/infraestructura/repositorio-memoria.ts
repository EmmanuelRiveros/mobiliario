import type { DatosRenta, RepositorioRenta, Repository } from '../dominio/puertos.js';
import type { Articulo, AjusteExistencia, Bloqueo, Reserva, Usuario } from '../dominio/modelo.js';

class TablaMemoria<T extends { readonly id: string }> implements Repository<T> {
  constructor(private readonly tabla: Map<string, T>) {}
  async findById(id: string): Promise<T | null> { const dato = this.tabla.get(id); return dato ? structuredClone(dato) : null; }
  async findAll(): Promise<T[]> { return structuredClone([...this.tabla.values()]); }
  async save(entidad: T): Promise<T> { this.tabla.set(entidad.id, structuredClone(entidad)); return structuredClone(entidad); }
}
interface Estado {
  articulos: Map<string, Articulo>; usuarios: Map<string, Usuario>;
  reservas: Map<string, Reserva>; bloqueos: Map<string, Bloqueo>; ajustes: Map<string, AjusteExistencia>;
}
export class RepositorioRentaMemoria implements RepositorioRenta {
  private estado: Estado = { articulos: new Map(), usuarios: new Map(), reservas: new Map(), bloqueos: new Map(), ajustes: new Map() };
  private turno: Promise<void> = Promise.resolve();
  async transaccion<T>(operacion: (datos: DatosRenta) => Promise<T>): Promise<T> {
    const anterior = this.turno;
    let liberar!: () => void;
    this.turno = new Promise<void>(resolve => { liberar = resolve; });
    await anterior;
    try {
      const copia = structuredClone(this.estado);
      const datos: DatosRenta = { articulos: new TablaMemoria(copia.articulos), usuarios: new TablaMemoria(copia.usuarios), reservas: new TablaMemoria(copia.reservas), bloqueos: new TablaMemoria(copia.bloqueos), ajustes: new TablaMemoria(copia.ajustes) };
      const resultado = await operacion(datos);
      const salida = structuredClone(resultado);
      this.estado = copia;
      return salida;
    } finally { liberar(); }
  }
}
