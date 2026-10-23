import { crearPool } from './configuracion.js';
import { crearAplicacion } from '../composicion.js';
import { RepositorioRentaMysql } from '../infraestructura/repositorio-mysql.js';
import { Seguridad } from './seguridad.js';
const pool = crearPool();
try {
    const { servicio, repositorio } = crearAplicacion({ pool });
    if (!(repositorio instanceof RepositorioRentaMysql))
        throw new Error('Se requiere MySQL.');
    const seguridad = new Seguridad(repositorio);
    for (const [correo, nombre, rol, variable] of [['admin@example.test', 'Administración de ejemplo', 'administrador', 'SEED_ADMIN_PASSWORD'], ['cliente@example.test', 'Cliente de ejemplo', 'cliente', 'SEED_CLIENT_PASSWORD']] as const) {
        const password = process.env[variable];
        if (!password || password.length < 12 || password.includes('REEMPLAZAR'))
            throw new Error(`Configura ${variable} con al menos 12 caracteres.`);
        const existe = await repositorio.transaccion(async (d) => (await d.usuarios.findAll()).some(u => u.correo === correo));
        if (!existe)
            await seguridad.registrar({ nombre, correo, telefono: '6440000000', password }, rol);
    }
    const catalogo = await repositorio.transaccion(d => d.articulos.findAll());
    for (const [nombre, categoria, totalPiezas, precioDiaCentavos, cargoDanoCentavos, valorReposicionCentavos, foto] of [['Silla plegable blanca', 'Sillas', 100, 1500, 15000, 45000, 'silla'], ['Mesa rectangular', 'Mesas', 20, 10000, 30000, 180000, 'mesa']] as const) {
        if (!catalogo.some(a => a.nombre === nombre))
            await servicio.registrarArticulo({ nombre, descripcion: 'Mobiliario de ejemplo para eventos sociales', categoria, totalPiezas, precioDiaCentavos, cargoDanoCentavos, valorReposicionCentavos, activo: true, fotografias: [`docs/imagenes/${foto}.svg`] });
    }
    console.log('Datos de arranque disponibles: dos roles, sillas y mesas. Las contraseñas provienen únicamente de .env.');
}
finally {
    await pool.end();
}
