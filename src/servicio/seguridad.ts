import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Rol } from '../dominio/modelo.js';
import { RentaService } from '../dominio/renta.service.js';
import { IdentificadoresUuid, RelojSistema } from '../infraestructura/reloj.js';
import type { RepositorioRentaMysql } from '../infraestructura/repositorio-mysql.js';
const N = 32768, r = 8, p = 1;
function derivar(password: string, sal: string): Promise<Buffer> { return new Promise((resolve, reject) => scrypt(password, sal, 64, { N, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key))); }
export async function hashPassword(password: string) { const sal = randomBytes(16).toString('hex'); return `scrypt$${N}$${r}$${p}$${sal}$${(await derivar(password, sal)).toString('hex')}`; }
export async function verificarPassword(password: string, hash: string) {
    const partes = hash.split('$');
    const sal = partes[4], clave = partes[5];
    if (partes.slice(0, 4).join('$') !== `scrypt$${N}$${r}$${p}` || !sal || !clave || !/^[a-f0-9]{128}$/.test(clave))
        return false;
    return timingSafeEqual(await derivar(password, sal), Buffer.from(clave, 'hex'));
}
export class ErrorHttp extends Error {
    constructor(readonly statusCode: number, readonly codigo: string, mensaje: string) { super(mensaje); }
}
export class Seguridad {
    constructor(private readonly repo: RepositorioRentaMysql) { }
    async registrar(entrada: {
        nombre: string;
        correo: string;
        telefono: string;
        password: string;
    }, rol: Rol = 'cliente') {
        const hash = await hashPassword(entrada.password);
        return this.repo.conConexion(async (datos, c) => {
            const servicio = new RentaService({ transaccion: operacion => operacion(datos) }, new RelojSistema(), new IdentificadoresUuid());
            const usuario = await servicio.registrarUsuario({ nombre: entrada.nombre, correo: entrada.correo, telefono: entrada.telefono, rol });
            await c.execute('INSERT INTO credenciales (usuarioId,passwordHash,creadaEn) VALUES (?,?,?)', [usuario.id, hash, new Date().toISOString()]);
            return usuario;
        });
    }
    async autenticar(correo: string, password: string) {
        const [filas] = await this.repo.pool.execute<RowDataPacket[]>('SELECT u.id,c.passwordHash FROM usuarios u JOIN credenciales c ON c.usuarioId=u.id WHERE u.correo=?', [correo.trim().toLowerCase()]);
        const fila = filas[0];
        // También se deriva una clave si el correo no existe para no omitir el trabajo costoso.
        const hash = fila?.passwordHash as string | undefined ?? `scrypt$${N}$${r}$${p}$00000000000000000000000000000000$${'0'.repeat(128)}`;
        if (!await verificarPassword(password, hash) || !fila)
            throw new ErrorHttp(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');
        return this.usuario(fila.id as string);
    }
    async usuario(id: string) { return this.repo.transaccion(async (d) => { const u = await d.usuarios.findById(id); if (!u)
        throw new ErrorHttp(401, 'CREDENCIAL_INVALIDA', 'La cuenta no está disponible.'); return u; }); }
}
