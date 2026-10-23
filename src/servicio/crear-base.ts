import { createConnection } from 'mysql2/promise';
import { configuracion } from './configuracion.js';
const config = configuracion();
const c = await createConnection({ host: process.env.DB_HOST!, port: Number(process.env.DB_PORT), user: process.env.DB_USER!, password: process.env.DB_PASSWORD! });
try {
    await c.query(`CREATE DATABASE IF NOT EXISTS \`${config.db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    console.log(`Base disponible: ${config.db}`);
}
finally {
    await c.end();
}
