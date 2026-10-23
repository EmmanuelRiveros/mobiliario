import { esquemasModelo } from './esquemas-modelo.js';
import Fastify from 'fastify';
import type { FastifyRequest, FastifyReply, HTTPMethods, FastifySchema } from 'fastify';
import jwt from '@fastify/jwt';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { Pool } from 'mysql2/promise';
import type { Usuario, Articulo, Periodo, LineaSolicitud, ResultadoPiezas, FiltroReservas } from '../dominio/modelo.js';
import { ErrorDeDominio, EntidadNoEncontradaError } from '../dominio/errores.js';
import { crearAplicacion } from '../composicion.js';
import { RepositorioRentaMysql } from '../infraestructura/repositorio-mysql.js';
import { Seguridad, ErrorHttp } from './seguridad.js';
import type { configuracion } from './configuracion.js';
declare module 'fastify' {
    interface FastifyRequest {
        actor: Usuario | null;
    }
}
type Json = Record<string, unknown>;
const texto = (maxLength = 500): Json => ({ type: 'string', minLength: 1, maxLength, pattern: '\\S' });
const id = texto(100);
const entero = (minimum = 0): Json => ({ type: 'integer', minimum, maximum: Number.MAX_SAFE_INTEGER });
const fecha: Json = { type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' };
const objeto = (properties: Json, required = Object.keys(properties)): Json => ({ type: 'object', properties, required, additionalProperties: false });
const periodo = objeto({ desde: fecha, hasta: fecha });
const lineas: Json = { type: 'array', minItems: 1, maxItems: 100, items: objeto({ articuloId: id, cantidad: entero(1) }) };
const password: Json = { type: 'string', minLength: 12, maxLength: 128 };
const correo: Json = { type: 'string', format: 'email', maxLength: 254 };
const perfil = { nombre: texto(120), correo, telefono: texto(30), password };
const articulo = { nombre: texto(120), descripcion: texto(1000), categoria: texto(80), fotografias: { type: 'array', minItems: 1, maxItems: 10, items: texto(1000) }, precioDiaCentavos: entero(1), cargoDanoCentavos: entero(), valorReposicionCentavos: entero(1), activo: { type: 'boolean' } };
const ok: Json = { type: 'object', required: ['ok', 'datos', 'error', 'solicitudId'], properties: { ok: { const: true }, datos: {}, error: { type: 'null' }, solicitudId: { type: 'string' } }, additionalProperties: false };
const fallo: Json = { type: 'object', required: ['ok', 'datos', 'error', 'solicitudId'], properties: { ok: { const: false }, datos: { type: 'null' }, error: objeto({ codigo: { type: 'string' }, mensaje: { type: 'string' } }), solicitudId: { type: 'string' } }, additionalProperties: false };
const body = <T>(r: FastifyRequest) => r.body as T;
const query = <T>(r: FastifyRequest) => r.query as T;
const param = (r: FastifyRequest) => (r.params as {
    id: string;
}).id;
type Acceso = 'publico' | 'autenticado' | 'administrador' | 'cliente';
export async function construirApp(pool: Pool, config: ReturnType<typeof configuracion>, log = true) {
    const app = Fastify({ logger: log ? { level: 'info', redact: ['req.headers.authorization', 'req.headers.cookie', 'password', 'token', 'DB_PASSWORD', 'JWT_SECRET'] } : false, bodyLimit: 65536, ajv: { customOptions: { removeAdditional: false, coerceTypes: false, allErrors: false } }, requestTimeout: 15000 });
    app.decorateRequest('actor', null);
    for (const esquema of esquemasModelo)
        app.addSchema(esquema);
    const { servicio, repositorio } = crearAplicacion({ pool });
    if (!(repositorio instanceof RepositorioRentaMysql))
        throw new Error('El servicio HTTP requiere persistencia MySQL.');
    const seguridad = new Seguridad(repositorio);
    await app.register(jwt, { secret: config.secreto, sign: { algorithm: 'HS256', expiresIn: '1h', iss: 'mobiliario', aud: 'mobiliario-clientes' }, verify: { algorithms: ['HS256'], allowedIss: 'mobiliario', allowedAud: 'mobiliario-clientes', requiredClaims: ['exp', 'sub'] } });
    await app.register(cors, { origin: config.origenes, methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: false, optionsSuccessStatus: 200 });
    // Swagger se registra antes de las rutas: el documento se genera de sus esquemas reales.
    await app.register(swagger, { openapi: { info: { title: 'Servicio de renta de mobiliario', version: '2.0.0', description: 'Dinero en centavos MXN. Fechas civiles inclusivas. Sobre uniforme en toda respuesta de negocio. Token Bearer válido por una hora.' }, components: { securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } } } });
    await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { docExpansion: 'list', persistAuthorization: false } });
    const responderError = (r: FastifyRequest, reply: FastifyReply, status: number, codigo: string, mensaje: string) => reply.code(status).send({ ok: false, datos: null, error: { codigo, mensaje }, solicitudId: r.id });
    app.setErrorHandler((error, r, reply) => {
        if (error instanceof ErrorHttp)
            return responderError(r, reply, error.statusCode, error.codigo, error.message);
        if (error instanceof ErrorDeDominio)
            return responderError(r, reply, error instanceof EntidadNoEncontradaError ? 404 : 409, error.codigo, error.message);
        const e = error as {
            validation?: unknown;
            statusCode?: number;
            code?: string;
        };
        if (e.validation || e.statusCode === 400)
            return responderError(r, reply, 400, 'PETICION_INVALIDA', 'Revisa los campos, tipos, fechas y formato JSON indicados en la documentación.');
        if (e.statusCode === 413)
            return responderError(r, reply, 413, 'CUERPO_DEMASIADO_GRANDE', 'La petición supera 64 KiB.');
        if (e.statusCode === 415)
            return responderError(r, reply, 415, 'FORMATO_NO_ADMITIDO', 'Envía un cuerpo JSON con Content-Type application/json.');
        r.log.error({ codigo: e.code ?? 'INTERNO' }, 'Fallo interno del servicio');
        return responderError(r, reply, 500, 'ERROR_INTERNO', 'No se pudo completar la operación.');
    });
    app.setNotFoundHandler((r, reply) => responderError(r, reply, 404, 'NO_ENCONTRADO', 'El recurso solicitado no existe.'));
    app.addHook('onResponse', async (r, reply) => { r.log.info({ metodo: r.method, ruta: r.routeOptions.url ?? 'desconocida', estado: reply.statusCode, duracionMs: reply.elapsedTime }, 'Petición atendida'); });
    app.addHook('onRequest', async (r, reply) => { reply.header('X-Content-Type-Options', 'nosniff'); if (!r.url.startsWith('/docs'))
        reply.header('Cache-Control', 'no-store'); });
    async function autorizar(r: FastifyRequest, acceso: Acceso) {
        if (acceso === 'publico')
            return;
        let sub: string;
        try {
            const payload = await r.jwtVerify<{
                sub: string;
            }>();
            sub = payload.sub;
            if (typeof sub !== 'string')
                throw new Error();
        }
        catch {
            throw new ErrorHttp(401, 'CREDENCIAL_INVALIDA', 'Falta una credencial válida o ha expirado.');
        }
        r.actor = await seguridad.usuario(sub);
        if (acceso !== 'autenticado' && r.actor.rol !== acceso)
            throw new ErrorHttp(403, 'SIN_PERMISO', 'Tu rol no tiene permiso para esta operación.');
    }
    async function propia(r: FastifyRequest) {
        const reserva = await servicio.detalleReserva(param(r));
        if (r.actor!.rol === 'cliente' && reserva.reserva.clienteId !== r.actor!.id)
            throw new ErrorHttp(403, 'SIN_PERMISO', 'No puedes acceder a una reserva de otro cliente.');
        return reserva;
    }
    const ref = (nombre: string): Json => ({ $ref: nombre + '#' });
    const lista = (nombre: string): Json => ({ type: 'array', items: ref(nombre) });
    const respuestas: Record<string, Json> = {
        'GET /salud': objeto({ servicio: { type: 'string' }, persistencia: { type: 'string' } }),
        'POST /usuarios': ref('Usuario'), 'GET /usuarios/me': ref('Usuario'), 'GET /usuarios': lista('Usuario'),
        'POST /sesiones': objeto({ usuario: ref('Usuario'), token: { type: 'string' }, tipo: { type: 'string' }, expiraEnSegundos: entero() }),
        'GET /articulos': lista('Articulo'), 'GET /inventario': lista('Articulo'), 'GET /articulos/:id': ref('Articulo'), 'POST /articulos': ref('Articulo'), 'PUT /articulos/:id': ref('Articulo'),
        'GET /articulos/:id/disponibilidad': ref('Disponibilidad'), 'POST /cotizaciones': ref('Cotizacion'),
        'POST /reservas': ref('Reserva'), 'GET /reservas': lista('Reserva'),
        'GET /reservas/:id': objeto({ reserva: ref('Reserva'), cliente: ref('Usuario') }),
        'POST /reservas/:id/solicitudes-cancelacion': ref('Reserva'), 'POST /reservas/:id/cancelacion': ref('Reserva'),
        'POST /reservas/:id/entrega': ref('Reserva'),
        'POST /reservas/:id/recoleccion': objeto({ reserva: ref('Reserva'), depositoLiberableCentavos: entero(), reservasAfectadas: { type: 'array', items: { type: 'string' } } }),
        'POST /reservas/:id/devoluciones-deposito': ref('Reserva'),
        'POST /articulos/:id/ajustes': ref('AjusteExistencia'), 'GET /ajustes': lista('AjusteExistencia'),
        'POST /bloqueos': ref('Bloqueo'), 'GET /bloqueos': lista('Bloqueo'), 'PATCH /bloqueos/:id': ref('Bloqueo'),
        'GET /calendario': { type: 'array', items: objeto({ fecha: { type: 'string' }, entregas: { type: 'array', items: id }, recolecciones: { type: 'array', items: id }, disponibilidad: lista('Disponibilidad') }) },
        'GET /resumen': objeto({ entregasDelDia: { type: 'array', items: id }, recoleccionesPendientes: { type: 'array', items: id }, articulosMasRentados: { type: 'array', items: objeto({ articuloId: id, nombre: texto(120), piezas: entero() }) }, ingresoRentasCentavos: entero(), piezasFueraServicio: { type: 'array', items: objeto({ articuloId: id, cantidad: entero(), motivo: { type: 'string' } }) } }),
    };
    function ruta(method: HTTPMethods, url: string, tag: string, summary: string, acceso: Acceso, schema: FastifySchema, handler: (r: FastifyRequest) => Promise<unknown>, status = 200) {
        const datos = respuestas[`${method} ${url}`];
        if (!datos)
            throw new Error(`Falta el contrato de respuesta de ${method} ${url}`);
        const response = { [status]: { ...ok, properties: { ...(ok.properties as Json), datos } }, 400: fallo, 401: fallo, 403: fallo, 404: fallo, 409: fallo, 413: fallo, 415: fallo, 500: fallo };
        app.route({ method, url, schema: { querystring: objeto({}, []), ...schema, tags: [tag], summary, security: acceso === 'publico' ? [] : [{ bearerAuth: [] }], response }, onRequest: async (r) => autorizar(r, acceso), handler: async (r, reply) => { const datos = await handler(r); return reply.code(status).send({ ok: true, datos, error: null, solicitudId: r.id }); } });
    }
    const porId = { params: objeto({ id }) };
    ruta('GET', '/salud', 'Servicio', 'Comprobar conexión real a MySQL', 'publico', {}, async () => { await pool.query('SELECT 1'); return { servicio: 'disponible', persistencia: 'mysql' }; });
    ruta('POST', '/usuarios', 'Acceso', 'Registrar una cuenta cliente', 'publico', { body: objeto(perfil) }, r => seguridad.registrar(body(r)), 201);
    ruta('POST', '/sesiones', 'Acceso', 'Obtener credencial con expiración', 'publico', { body: objeto({ correo, password: { type: 'string', minLength: 1, maxLength: 128 } }) }, async (r) => { const b = body<{
        correo: string;
        password: string;
    }>(r), u = await seguridad.autenticar(b.correo, b.password); return { usuario: u, token: app.jwt.sign({ sub: u.id }), tipo: 'Bearer', expiraEnSegundos: 3600 }; });
    ruta('GET', '/usuarios/me', 'Acceso', 'Consultar el perfil propio', 'autenticado', {}, async (r) => r.actor);
    ruta('GET', '/usuarios', 'Administración', 'Consultar usuarios sin credenciales', 'administrador', {}, () => repositorio.transaccion(d => d.usuarios.findAll()));
    ruta('GET', '/articulos', 'Catálogo', 'Explorar por nombre categoría y precio', 'publico', { querystring: objeto({ categoria: texto(80), nombre: texto(120), precioMinimoCentavos: { type: 'string', pattern: '^\\d{1,15}$' }, precioMaximoCentavos: { type: 'string', pattern: '^\\d{1,15}$' } }, []) }, r => {
        const q = query<Record<string, string>>(r);
        const filtro: Parameters<typeof servicio.explorarCatalogo>[0] = {};
        if (q.categoria !== undefined)
            filtro.categoria = q.categoria;
        if (q.nombre !== undefined)
            filtro.nombre = q.nombre;
        if (q.precioMinimoCentavos !== undefined)
            filtro.precioMinimoCentavos = Number(q.precioMinimoCentavos);
        if (q.precioMaximoCentavos !== undefined)
            filtro.precioMaximoCentavos = Number(q.precioMaximoCentavos);
        return servicio.explorarCatalogo(filtro);
    });
    ruta('GET', '/inventario', 'Administración', 'Consultar todos los artículos incluidos los inactivos', 'administrador', {}, () => repositorio.transaccion(d => d.articulos.findAll()));
    ruta('GET', '/articulos/:id', 'Catálogo', 'Consultar un artículo activo', 'publico', porId, r => repositorio.transaccion(async (d) => { const a = await d.articulos.findById(param(r)); if (!a || !a.activo)
        throw new EntidadNoEncontradaError('artículo', param(r)); return a; }));
    ruta('POST', '/articulos', 'Administración', 'Crear un artículo', 'administrador', { body: objeto({ ...articulo, totalPiezas: entero() }) }, r => servicio.registrarArticulo(body<Omit<Articulo, 'id'>>(r)), 201);
    ruta('PUT', '/articulos/:id', 'Administración', 'Reemplazar datos del catálogo conservando existencias', 'administrador', { ...porId, body: objeto(articulo) }, r => servicio.editarArticulo(param(r), body(r)));
    ruta('GET', '/articulos/:id/disponibilidad', 'Catálogo', 'Consultar disponibilidad por fechas', 'publico', { ...porId, querystring: periodo }, r => servicio.consultarDisponibilidad(param(r), query<Periodo>(r)));
    ruta('POST', '/cotizaciones', 'Reservas', 'Cotizar sin apartar piezas', 'publico', { body: objeto({ periodo, lineas }) }, r => { const b = body<{
        periodo: Periodo;
        lineas: LineaSolicitud[];
    }>(r); return servicio.cotizar(b.periodo, b.lineas); });
    ruta('POST', '/reservas', 'Reservas', 'Confirmar y apartar una reserva', 'autenticado', { body: objeto({ periodo, lineas, direccionEntrega: texto(500), clienteId: id }, ['periodo', 'lineas', 'direccionEntrega']) }, r => {
        const b = body<{
            periodo: Periodo;
            lineas: LineaSolicitud[];
            direccionEntrega: string;
            clienteId?: string;
        }>(r);
        if (r.actor!.rol === 'cliente' && b.clienteId !== undefined && b.clienteId !== r.actor!.id)
            throw new ErrorHttp(403, 'SIN_PERMISO', 'Solo puedes crear reservas para tu cuenta.');
        const clienteId = r.actor!.rol === 'cliente' ? r.actor!.id : b.clienteId;
        if (!clienteId)
            throw new ErrorHttp(400, 'PETICION_INVALIDA', 'Administración debe indicar clienteId.');
        return servicio.confirmarReserva({ ...b, clienteId });
    }, 201);
    ruta('GET', '/reservas', 'Reservas', 'Consultar reservas e historial según el rol', 'autenticado', { querystring: objeto({ clienteId: id, estado: { type: 'string', enum: ['apartada', 'entregada', 'devuelta', 'cancelada'] }, entregaDesde: fecha, entregaHasta: fecha }, []) }, r => {
        const q = query<FiltroReservas>(r);
        if (r.actor!.rol === 'cliente') {
            if (q.clienteId && q.clienteId !== r.actor!.id)
                throw new ErrorHttp(403, 'SIN_PERMISO', 'Solo puedes consultar tu historial.');
            return servicio.consultarReservas({ ...q, clienteId: r.actor!.id });
        }
        return servicio.consultarReservas(q);
    });
    ruta('GET', '/reservas/:id', 'Reservas', 'Abrir una reserva propia o administrativa', 'autenticado', porId, propia);
    ruta('POST', '/reservas/:id/solicitudes-cancelacion', 'Reservas', 'Solicitar cancelación de una reserva propia', 'cliente', { ...porId, body: objeto({ motivo: texto(500) }) }, async (r) => { await propia(r); return servicio.solicitarCancelacion(param(r), r.actor!.id, body<{
        motivo: string;
    }>(r).motivo); }, 201);
    ruta('POST', '/reservas/:id/cancelacion', 'Administración', 'Aprobar cancelación y liberar piezas', 'administrador', { ...porId, body: objeto({ motivo: texto(500) }) }, r => servicio.cancelarReserva(param(r), body<{
        motivo: string;
    }>(r).motivo), 201);
    ruta('POST', '/reservas/:id/entrega', 'Operación', 'Registrar salida y cobros exactos', 'administrador', { ...porId, body: objeto({ depositoCentavos: entero(), rentaCentavos: entero() }) }, r => servicio.registrarEntrega(param(r), body(r)), 201);
    ruta('POST', '/reservas/:id/recoleccion', 'Operación', 'Registrar retorno daños y faltantes', 'administrador', { ...porId, body: objeto({ piezas: { type: 'array', minItems: 1, maxItems: 100, items: objeto({ articuloId: id, buenas: entero(), danadas: entero(), faltantes: entero() }) } }) }, r => servicio.registrarRecoleccion(param(r), body<{
        piezas: ResultadoPiezas[];
    }>(r).piezas), 201);
    ruta('POST', '/reservas/:id/devoluciones-deposito', 'Operación', 'Registrar la devolución de la garantía', 'administrador', { ...porId, body: objeto({ montoCentavos: entero() }) }, r => servicio.registrarDevolucionDeposito(param(r), body<{
        montoCentavos: number;
    }>(r).montoCentavos), 201);
    ruta('POST', '/articulos/:id/ajustes', 'Inventario', 'Ajustar existencias con motivo', 'administrador', { ...porId, body: objeto({ nueva: entero(), motivo: texto(500) }) }, r => { const b = body<{
        nueva: number;
        motivo: string;
    }>(r); return servicio.ajustarExistencias(param(r), b.nueva, b.motivo); }, 201);
    ruta('GET', '/ajustes', 'Inventario', 'Consultar la bitácora de existencias', 'administrador', {}, () => repositorio.transaccion(d => d.ajustes.findAll()));
    ruta('POST', '/bloqueos', 'Inventario', 'Bloquear piezas para mantenimiento', 'administrador', { body: objeto({ articuloId: id, cantidad: entero(1), periodo, motivo: texto(500) }) }, r => { const b = body<{
        articuloId: string;
        cantidad: number;
        periodo: Periodo;
        motivo: string;
    }>(r); return servicio.bloquearMantenimiento(b.articuloId, b.cantidad, b.periodo, b.motivo); }, 201);
    ruta('GET', '/bloqueos', 'Inventario', 'Consultar bloqueos de mantenimiento daños y faltantes', 'administrador', {}, () => repositorio.transaccion(d => d.bloqueos.findAll()));
    ruta('PATCH', '/bloqueos/:id', 'Inventario', 'Registrar el último día fuera de servicio', 'administrador', { ...porId, body: objeto({ ultimoDiaFueraServicio: fecha }) }, r => servicio.terminarBloqueo(param(r), body<{
        ultimoDiaFueraServicio: string;
    }>(r).ultimoDiaFueraServicio));
    ruta('GET', '/calendario', 'Administración', 'Consultar entregas y recolecciones programadas', 'administrador', { querystring: periodo }, r => servicio.calendario(query<Periodo>(r)));
    ruta('GET', '/resumen', 'Administración', 'Consultar el resumen del negocio', 'administrador', { querystring: periodo }, r => servicio.resumenNegocio(query<Periodo>(r)));
    await app.ready();
    return app;
}
