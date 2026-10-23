# Avance 2 Servicio central y seguridad

Proyecto 1 Renta de Mobiliario y Equipo para Eventos de Emmanuel Riveros, matrícula 00000240694. El dominio del avance 1 se conserva sin cambios. Este avance agrega HTTP, MySQL real, migraciones, validación, dos roles y documentación interactiva.

Repositorio: https://github.com/EmmanuelRiveros/mobiliario/tree/feat-servicio

## Requisitos

- Node.js 22.18 o posterior y npm. Verificado con Node.js 24.11.1.
- MySQL 8.0.16 o posterior, con InnoDB. Verificado con MySQL 8.0.42. Alternativamente Docker Compose.
- Git para clonar. No se necesitan programas de frontend para este avance.

## Iniciar desde cero en otra computadora

```bash
git clone --branch feat-servicio https://github.com/EmmanuelRiveros/mobiliario.git
cd mobiliario
npm ci
```

Copiar `.env.example` a `.env`. En PowerShell: `Copy-Item .env.example .env`. En macOS/Linux: `cp .env.example .env`. Editar todos los valores REEMPLAZAR. El archivo real está ignorado y no se debe subir.

| Variable | Uso |
| --- | --- |
| HOST y PORT | Dirección y puerto HTTP. Ejemplo: 127.0.0.1 y 3000. |
| DB_HOST y DB_PORT | Host y puerto de MySQL. Ejemplo: 127.0.0.1 y 3306. |
| DB_USER y DB_PASSWORD | Credenciales locales. Para crear la base se requiere permiso CREATE; para las migraciones, DDL; para el servicio, lectura y escritura de sus tablas. |
| DB_NAME | Base exclusiva del proyecto, por ejemplo mobiliario_avance2. Solo letras, números y guion bajo. |
| JWT_SECRET | Secreto aleatorio de al menos 32 caracteres. No se acepta el marcador de ejemplo. |
| CORS_ORIGINS | Orígenes exactos separados por coma. Inicialmente http://localhost:5173 y http://localhost:5174, previstos para los dos clientes. |
| SEED_ADMIN_PASSWORD | Contraseña local de arranque del administrador, mínimo 12 caracteres. |
| SEED_CLIENT_PASSWORD | Contraseña local de arranque del cliente, mínimo 12 caracteres. |

Generar un secreto y contraseñas distintas con este comando, una vez por valor, y copiarlos a `.env`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**Opción A, MySQL instalado:** iniciar MySQL y configurar en `.env` una cuenta local con los permisos indicados. No se modifican las bases ajenas al nombre elegido.

**Opción B, Docker:** Docker debe estar iniciado. Configurar DB_HOST=127.0.0.1, DB_USER=root y DB_PASSWORD con una contraseña propia; elegir un DB_PORT libre (por ejemplo 3307 si 3306 ya está ocupado). Ejecutar:

```bash
docker compose up -d --wait
```

El contenedor solo publica MySQL en la interfaz local. Conserva los datos en un volumen. Cambiar DB_PASSWORD después de inicializar el volumen no cambia automáticamente la contraseña de MySQL. Esta alternativa se entrega como configuración; la verificación de esta entrega se realizó con MySQL instalado.

Con MySQL disponible, continuar:

```bash
npm run db:crear
npm run db:migrar
npm run db:sembrar
npm start
```

Abrir http://127.0.0.1:3000/docs/ para Swagger UI y http://127.0.0.1:3000/salud para comprobar la conexión. El contrato OpenAPI vivo está en http://127.0.0.1:3000/docs/json. Las imágenes del catálogo son referencias locales ilustrativas; servir imágenes a las interfaces corresponde a los siguientes avances.

La carga inicial crea admin@example.test con rol administrador, cliente@example.test con rol cliente, cien sillas y veinte mesas. Las contraseñas son exclusivamente las configuradas en `.env`. Se puede repetir la siembra sin duplicar esos datos; tampoco reinicia contraseñas ni sobrescribe cambios existentes. Los periodos se eligen al probar para que las fechas no caduquen.

## Recorrido para el video

Dejar `npm start` en una terminal y abrir otra en el proyecto:

```bash
npm run demo:servicio
```

La demostración inicia sesión con los dos usuarios de arranque, usando `.env` sin imprimir sus claves ni tokens. Ejecuta HTTP real en el servicio local y muestra:

1. POST /articulos sin credencial: 401.
2. La misma operación con cliente: 403.
3. Con administrador: 201.
4. Reserva de ochenta sillas nuevas por tres días: 201, renta $3,600, garantía $720, total $4,320.
5. Otras treinta sillas traslapadas: 409 DISPONIBILIDAD_INSUFICIENTE.
6. Bajar la existencia a setenta: 409 EXISTENCIAS_COMPROMETIDAS.
7. Token alterado: 401.
8. Disponibilidad de veinte piezas: 200.

Cada recorrido crea un artículo ficticio distinto y una reserva de prueba; conserva la información anterior. Sus fechas son futuras y se calculan automáticamente. La grabación la realiza el alumno. El reporte se entrega sin portada ni guion.

## Contrato HTTP y permisos

Todos los cuerpos se envían como application/json. Dinero en centavos enteros MXN, cantidades enteras y fechas civiles inclusivas YYYY-MM-DD, con reloj del negocio America/Hermosillo. Los esquemas comprueban formato de fecha, campos requeridos, tipos, límites y propiedades desconocidas. Los precios de query se reciben como cadenas numéricas validadas y se convierten explícitamente. No se convierten cantidades de texto a números dentro de JSON.

Las respuestas de negocio tienen esta forma uniforme:

```json
{"ok":true,"datos":{"ejemplo":"resultado"},"error":null,"solicitudId":"req-1"}
```

```json
{"ok":false,"datos":null,"error":{"codigo":"SIN_PERMISO","mensaje":"Tu rol no tiene permiso para esta operación."},"solicitudId":"req-2"}
```

- 200: consulta, sesión o actualización; 201: creación o registro de un evento.
- 400: petición o JSON mal formado; 401: credencial ausente, inválida, alterada o expirada.
- 403: rol incorrecto o reserva de otro cliente; 404: recurso no encontrado.
- 409: regla del dominio que impide la operación; se conserva su código concreto.
- 413: cuerpo mayor a 64 KiB; 415: tipo de contenido no admitido; 500: fallo interno con mensaje público genérico.

Los documentos HTML, los recursos estáticos de Swagger, su JSON OpenAPI y el preflight CORS tienen el formato propio de esos protocolos, no el sobre de negocio. Swagger se genera de los esquemas de cada ruta, incluidos sus resultados; los 14 esquemas del modelo se generan del AST de TypeScript y se comprueban con `verificar:esquemas`.

Los visitantes pueden explorar, consultar disponibilidad, cotizar, registrar una cuenta cliente e iniciar sesión. Los clientes pueden crear y consultar sus reservas y solicitar su cancelación. El clienteId efectivo procede de la identidad verificada; conocer otro identificador no permite suplantarlo. Los administradores gestionan catálogo, inventario, entregas, recolecciones, garantías, cancelaciones, calendario y resumen. La aprobación de una cancelación corresponde a administración. La tabla completa de rutas y códigos está en `docs/puntos-entrada.md` y en Swagger.

## Persistencia y conservación del dominio

- `src/dominio`: los mismos cinco archivos del avance 1, sin cambios.
- `src/composicion.ts`: único lugar que selecciona almacenamiento. Con pool usa MySQL; la consola original sin pool sigue usando memoria.
- `src/infraestructura/repositorio-mysql.ts`: implementa exactamente RepositorioRenta y Repository. Las consultas parametrizadas guardan columnas y tablas hijas, no un archivo JSON como sustituto de MySQL.
- `db/migraciones/001_dominio.sql`: usuarios, artículos, fotos, reservas, detalles, recolecciones, bloqueos, ajustes y cerrojo.
- `db/migraciones/002_credenciales.sql`: credenciales separadas e índices de consulta.
- `schema_migrations`: historial con nombre, fecha y SHA256 de texto con saltos de línea normalizados a LF; no se permite editar silenciosamente un archivo ya aplicado.

Cada unidad de trabajo usa una conexión, aislamiento SERIALIZABLE, BEGIN, COMMIT o ROLLBACK y un cerrojo de fila compartido. Ese cerrojo también coordina procesos distintos y evita sobreventas; no depende de una cola JavaScript de un solo proceso. Las consultas devuelven copias. El registro público guarda persona y hash dentro de la misma transacción.

La solución prioriza corrección para el volumen escolar. Todas las unidades de trabajo se serializan y las consultas del contrato cargan las entidades necesarias en memoria; un volumen mayor requeriría particionar cerrojos y optimizar consultas sin perder el contrato. No se afirma que exista alta disponibilidad o escalamiento horizontal.

MySQL hace commit implícito del DDL. El ejecutor registra una migración después de aplicar sus sentencias y usa un bloqueo de migraciones. No se promete rollback completo de una migración interrumpida: revisar el esquema y completar o recuperar la base de instalación antes de reintentar. En instalaciones correctas, repetir el comando verifica el historial y no vuelve a aplicar las migraciones.

El modelo completo, con sus 11 tablas, 79 columnas y 10 relaciones, está en `docs/modelo-datos.json`, `docs/modelo-datos.mmd` y las tres vistas SVG/PNG. Los metadatos se extraen del MySQL real con `npm run documentar:base`.

## Seguridad y registro

Las contraseñas se derivan con scrypt asíncrono, sal aleatoria de 16 bytes, N=32768, r=8, p=1 y clave de 64 bytes. Se guarda la representación con sus parámetros, sal y hash, nunca la contraseña. La comparación usa timingSafeEqual.

La sesión entrega JWT firmado con HS256, emisor y audiencia verificados y vencimiento de una hora. Se requieren exp y sub. Se verifica la firma y se consulta el rol actual en la base en cada petición protegida; no se confía en un rol enviado por el cliente. El registro público no acepta rol. El administrador inicial se crea por la siembra local.

CORS responde únicamente con los dos orígenes exactos configurados, sin comodín. Es una política del navegador; las herramientas de servidor siguen necesitando autenticación. Si los puertos de los futuros clientes cambian, se actualizan explícitamente en `.env`.

La bitácora registra método, patrón de ruta, estado HTTP y duración en milisegundos de cada petición. Authorization y cookies se ocultan; no se registran cuerpos, contraseñas ni respuestas de sesión. El archivo de configuración, archivos temporales, dependencias y construcciones quedan fuera del repositorio. El servicio inicia en la interfaz local; la publicación en Internet y TLS no forman parte de esta entrega.

## Verificar

```bash
npm run typecheck
npm test
npm run test:integracion
npm run verificar:arquitectura
npm run verificar:diagrama
npm run verificar:dominio
npm run verificar:esquemas
npm audit --omit=dev
```

`npm test`: 33 pruebas del dominio. `test:integracion`: 73 escenarios contra MySQL real, ejecutados dentro de una prueba de integración; comprueban HTTP, ambos roles, propiedad de las reservas, tokens vencidos y alterados, fechas, duplicados, sobreventa, devoluciones, rollback, copias y concurrencia entre dos pools independientes. También aplican migraciones y siembra dos veces. La cuenta usada para esta prueba necesita CREATE y DROP DATABASE: se crea una base temporal con sufijo aleatorio y se elimina únicamente esa base al terminar. No borra datos del proyecto.

Se verificó además HTTP por socket y la conservación de 80 piezas ocupadas y 20 libres después de reiniciar el proceso real. Las evidencias JSON y la bitácora sanitizada están en `evidencias/avance2`. El contrato exportado en `docs/openapi.json` es una referencia; el contrato vivo de `/docs/json` se genera del código que está ejecutándose.

Para reproducir la demostración anterior en memoria: `npm run demo`. El reporte se entrega sin portada para que el alumno la agregue. La grabación y la entrega en la plataforma corresponden al alumno.

## Referencias técnicas

- Guías del profesor Proyecto 1, Avance 1 y Avance 2.
- https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/
- https://github.com/fastify/fastify-jwt
- https://github.com/fastify/fastify-cors
- https://github.com/fastify/fastify-swagger
- https://github.com/fastify/fastify-swagger-ui
- https://sidorares.github.io/node-mysql2/docs
- https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback
