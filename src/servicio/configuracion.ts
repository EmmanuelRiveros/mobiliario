import { createPool } from 'mysql2/promise';
export function configuracion() {
    const requeridas = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'JWT_SECRET', 'CORS_ORIGINS'];
    for (const clave of requeridas)
        if (!process.env[clave])
            throw new Error(`Falta ${clave} en la configuración local.`);
    const db = process.env.DB_NAME!;
    if (!/^[a-zA-Z0-9_]+$/.test(db))
        throw new Error('DB_NAME no es válido.');
    const secreto = process.env.JWT_SECRET!;
    if (secreto.length < 32 || /CAMBIAR|REEMPLAZAR/.test(secreto))
        throw new Error('JWT_SECRET debe ser aleatorio y tener al menos 32 caracteres.');
    const puerto = Number(process.env.PORT ?? 3000), dbPuerto = Number(process.env.DB_PORT);
    if (![puerto, dbPuerto].every(p => Number.isInteger(p) && p > 0 && p < 65536))
        throw new Error('Puerto no válido.');
    const origenes = process.env.CORS_ORIGINS!.split(',').map(o => o.trim());
    if (!origenes.length || origenes.some(o => { try {
        return new URL(o).origin !== o;
    }
    catch {
        return true;
    } }))
        throw new Error('CORS_ORIGINS debe contener orígenes exactos separados por comas.');
    return { host: process.env.HOST ?? '127.0.0.1', puerto, secreto, origenes, db };
}
export function crearPool() {
    configuracion();
    return createPool({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), user: process.env.DB_USER!, password: process.env.DB_PASSWORD!, database: process.env.DB_NAME!, connectionLimit: 10, supportBigNumbers: true, bigNumberStrings: false, charset: 'utf8mb4', multipleStatements: false });
}
