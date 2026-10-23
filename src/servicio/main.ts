import { crearPool, configuracion } from './configuracion.js';
import { construirApp } from './app.js';
const config = configuracion(), pool = crearPool();
const app = await construirApp(pool, config);
const cerrar = async () => { await app.close(); await pool.end(); };
for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => { void cerrar(); });
try {
    await pool.query('SELECT 1');
    await app.listen({ host: config.host, port: config.puerto });
}
catch {
    app.log.error('No se pudo iniciar el servicio. Revisa la conexión y aplica las migraciones.');
    await cerrar();
    process.exitCode = 1;
}
