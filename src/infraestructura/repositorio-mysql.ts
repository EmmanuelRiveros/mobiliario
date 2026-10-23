import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { DatosRenta, RepositorioRenta, Repository } from '../dominio/puertos.js';
import { mapas, camposDetalle, camposRecoleccion } from './mapa-sql.js';
function valorSql(valor: unknown): string | number | boolean | null {
    if (valor === null || typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean')
        return valor;
    throw new Error('Valor no escalar al guardar en SQL.');
}
type Registro = Record<string, unknown>;
const columnas = (campos: readonly string[]) => campos.map(c => `\`${c}\``).join(',');
class TablaSql<T extends {
    readonly id: string;
}> implements Repository<T> {
    constructor(private readonly conexion: PoolConnection, private readonly nombre: keyof typeof mapas) { }
    private async hidratar(fila: Registro): Promise<T> {
        const dato = { ...fila };
        if (this.nombre === 'articulos') {
            const [fotos] = await this.conexion.execute<RowDataPacket[]>('SELECT referencia FROM fotografias WHERE articuloId=? ORDER BY posicion', [String(dato.id)]);
            dato.activo = Boolean(dato.activo);
            dato.fotografias = fotos.map(f => f.referencia);
        }
        if (this.nombre === 'reservas' || this.nombre === 'bloqueos') {
            dato.periodo = { desde: dato.desde, hasta: dato.hasta };
            delete dato.desde;
            delete dato.hasta;
        }
        if (this.nombre === 'reservas') {
            dato.solicitudCancelacion = dato.solicitadaEn === null ? null : { solicitadaEn: dato.solicitadaEn, motivo: dato.motivoSolicitud, politica: dato.politicaSolicitud };
            delete dato.solicitadaEn;
            delete dato.motivoSolicitud;
            delete dato.politicaSolicitud;
            const [detalles] = await this.conexion.execute<RowDataPacket[]>(`SELECT ${columnas(camposDetalle)} FROM detalles_reserva WHERE reservaId=? ORDER BY posicion`, [String(dato.id)]);
            const [piezas] = await this.conexion.execute<RowDataPacket[]>(`SELECT ${columnas(camposRecoleccion)} FROM recolecciones WHERE reservaId=? ORDER BY posicion`, [String(dato.id)]);
            dato.detalles = detalles.map(d => ({ ...d }));
            dato.recoleccion = piezas.map(p => ({ ...p }));
        }
        return structuredClone(dato) as T;
    }
    async findById(id: string): Promise<T | null> {
        const m = mapas[this.nombre];
        const [filas] = await this.conexion.execute<RowDataPacket[]>(`SELECT ${columnas(m.campos)} FROM ${m.tabla} WHERE id=?`, [id]);
        return filas[0] ? this.hidratar(filas[0]) : null;
    }
    async findAll(): Promise<T[]> {
        const m = mapas[this.nombre];
        const [filas] = await this.conexion.query<RowDataPacket[]>(`SELECT ${columnas(m.campos)} FROM ${m.tabla} ORDER BY id`);
        return Promise.all(filas.map(f => this.hidratar(f)));
    }
    async save(entidad: T): Promise<T> {
        const dato = structuredClone(entidad) as unknown as Registro;
        const m = mapas[this.nombre];
        const periodo = dato.periodo as Registro | undefined;
        if (periodo)
            Object.assign(dato, periodo);
        if (this.nombre === 'reservas') {
            const s = dato.solicitudCancelacion as Registro | null;
            Object.assign(dato, { solicitadaEn: s?.solicitadaEn ?? null, motivoSolicitud: s?.motivo ?? null, politicaSolicitud: s?.politica ?? null });
        }
        await this.conexion.execute(`INSERT INTO ${m.tabla} (${columnas(m.campos)}) VALUES (${m.campos.map(() => '?').join(',')}) ON DUPLICATE KEY UPDATE ${m.campos.filter(c => c !== 'id').map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(',')}`, m.campos.map(c => valorSql(dato[c])));
        if (this.nombre === 'articulos') {
            await this.conexion.execute('DELETE FROM fotografias WHERE articuloId=?', [String(dato.id)]);
            for (const [posicion, referencia] of (dato.fotografias as string[]).entries())
                await this.conexion.execute('INSERT INTO fotografias (articuloId,posicion,referencia) VALUES (?,?,?)', [String(dato.id), posicion, referencia]);
        }
        if (this.nombre === 'reservas') {
            for (const [tabla, propiedad, campos] of [['detalles_reserva', 'detalles', camposDetalle], ['recolecciones', 'recoleccion', camposRecoleccion]] as const) {
                await this.conexion.execute(`DELETE FROM ${tabla} WHERE reservaId=?`, [String(dato.id)]);
                for (const [posicion, fila] of (dato[propiedad] as Registro[]).entries())
                    await this.conexion.execute(`INSERT INTO ${tabla} (reservaId,posicion,${columnas(campos)}) VALUES (${Array(campos.length + 2).fill('?').join(',')})`, [String(dato.id), posicion, ...campos.map(c => valorSql(fila[c]))]);
            }
        }
        return structuredClone(entidad);
    }
}
/** Un cerrojo de fila compartido serializa las unidades de trabajo incluso entre procesos.
 * Elegimos corrección para el volumen de clase; un despliegue mayor debe particionar el cerrojo. */
export class RepositorioRentaMysql implements RepositorioRenta {
    constructor(readonly pool: Pool) { }
    async transaccion<T>(operacion: (datos: DatosRenta) => Promise<T>): Promise<T> { return this.conConexion((datos) => operacion(datos)); }
    async conConexion<T>(operacion: (datos: DatosRenta, conexion: PoolConnection) => Promise<T>): Promise<T> {
        const c = await this.pool.getConnection();
        try {
            await c.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
            await c.beginTransaction();
            await c.query('SELECT id FROM cerrojo_dominio WHERE id=1 FOR UPDATE');
            const datos: DatosRenta = { usuarios: new TablaSql(c, 'usuarios'), articulos: new TablaSql(c, 'articulos'), reservas: new TablaSql(c, 'reservas'), bloqueos: new TablaSql(c, 'bloqueos'), ajustes: new TablaSql(c, 'ajustes') };
            const resultado = structuredClone(await operacion(datos, c));
            await c.commit();
            return resultado;
        }
        catch (error) {
            await c.rollback();
            throw error;
        }
        finally {
            c.release();
        }
    }
}
