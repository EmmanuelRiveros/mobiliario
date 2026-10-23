import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { crearPool } from './configuracion.js';
const pool = crearPool(), c = await pool.getConnection();
try {
    const [lock] = await c.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT(DATABASE(),':migraciones'),30) AS obtenido");
    if (lock[0]?.obtenido !== 1)
        throw new Error('No se pudo obtener el bloqueo de migraciones.');
    await c.query('CREATE TABLE IF NOT EXISTS schema_migrations (nombre VARCHAR(100) PRIMARY KEY,sha256 CHAR(64) NOT NULL,aplicadaEn TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB');
    const archivos = (await readdir('db/migraciones')).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
    for (const nombre of archivos) {
        const sql = (await readFile(`db/migraciones/${nombre}`, 'utf8')).replaceAll('\r\n', '\n'), hash = createHash('sha256').update(sql).digest('hex');
        const [previas] = await c.execute<RowDataPacket[]>('SELECT sha256 FROM schema_migrations WHERE nombre=?', [nombre]);
        if (previas[0]) {
            if (previas[0].sha256 !== hash)
                throw new Error(`La migración aplicada ${nombre} fue modificada.`);
            console.log(`Ya aplicada: ${nombre}`);
            continue;
        }
        // El DDL de MySQL confirma implícitamente. No se promete rollback de un archivo completo.
        for (const sentencia of sql.split(';').map(s => s.trim()).filter(Boolean))
            await c.query(sentencia);
        await c.execute('INSERT INTO schema_migrations (nombre,sha256) VALUES (?,?)', [nombre, hash]);
        console.log(`Aplicada: ${nombre}`);
    }
}
finally {
    await c.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(),':migraciones'))");
    c.release();
    await pool.end();
}
