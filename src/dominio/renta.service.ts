import type {
  Articulo, Bloqueo, Cotizacion, Fecha, FiltroReservas, LineaSolicitud,
  Periodo, Reserva, ResultadoPiezas, SolicitudReserva, Usuario,
} from './modelo.js';
import type { DatosRenta, GeneradorId, RepositorioRenta, Repository, Reloj } from './puertos.js';
import {
  ArticuloInactivoError, ClienteRequeridoError, CobroRentaIncorrectoError,
  CorreoDuplicadoError, DatosInvalidosError, DepositoIncorrectoError,
  DevolucionDepositoInvalidaError, DisponibilidadInsuficienteError,
  EntidadNoEncontradaError, EstadoReservaInvalidoError, ExistenciasComprometidasError,
  FechaOperacionInvalidaError, RecoleccionInconsistenteError, ReservaAjenaError,
  SolicitudDuplicadaError,
} from './errores.js';
import { dia, disponibilidad, entero, fechaDesdeDia, FIN_ABIERTO, importe, periodoValido, texto } from './calculos.js';

export class RentaService {
  constructor(private readonly repositorio: RepositorioRenta, private readonly reloj: Reloj, private readonly ids: GeneradorId) {}

  private async obtener<T extends { readonly id: string }>(repo: Repository<T>, id: string, tipo: string): Promise<T> {
    const dato = await repo.findById(texto(id, 'Identificador', 100));
    if (!dato) throw new EntidadNoEncontradaError(tipo, id);
    return dato;
  }
  private futuro(periodo: Periodo): void {
    periodoValido(periodo);
    if (periodo.desde < this.reloj.hoy()) throw new FechaOperacionInvalidaError('No se puede apartar ni bloquear desde una fecha pasada.');
  }
  private validarArticulo(entrada: Omit<Articulo, 'id'>): Omit<Articulo, 'id'> {
    if (!Array.isArray(entrada.fotografias) || entrada.fotografias.length === 0 || entrada.fotografias.length > 10) throw new DatosInvalidosError('El artículo necesita entre una y diez referencias de fotografías.');
    if (typeof entrada.activo !== 'boolean') throw new DatosInvalidosError('activo debe ser booleano.');
    const precio = entero(entrada.precioDiaCentavos, 'Precio diario', 1);
    const dano = entero(entrada.cargoDanoCentavos, 'Cargo por daño');
    const reposicion = entero(entrada.valorReposicionCentavos, 'Valor de reposición', 1);
    if (dano > reposicion) throw new DatosInvalidosError('El cargo por daño no puede superar el valor de reposición.');
    return {
      nombre: texto(entrada.nombre, 'Nombre', 120), descripcion: texto(entrada.descripcion, 'Descripción', 1000),
      categoria: texto(entrada.categoria, 'Categoría', 80), fotografias: entrada.fotografias.map(f => texto(f, 'Fotografía', 1000)),
      precioDiaCentavos: precio, cargoDanoCentavos: dano, valorReposicionCentavos: reposicion,
      totalPiezas: entero(entrada.totalPiezas, 'Existencias'), activo: entrada.activo,
    };
  }
  async registrarUsuario(entrada: Omit<Usuario, 'id'>): Promise<Usuario> {
    return this.repositorio.transaccion(async datos => {
      const correo = texto(entrada.correo, 'Correo', 254).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) throw new DatosInvalidosError('El correo no tiene formato válido.');
      if (entrada.rol !== 'cliente' && entrada.rol !== 'administrador') throw new DatosInvalidosError('Rol no reconocido.');
      if ((await datos.usuarios.findAll()).some(u => u.correo === correo)) throw new CorreoDuplicadoError();
      return datos.usuarios.save({ id: this.ids.siguiente('U'), nombre: texto(entrada.nombre, 'Nombre', 120), correo, telefono: texto(entrada.telefono, 'Teléfono', 30), rol: entrada.rol });
    });
  }
  async registrarArticulo(entrada: Omit<Articulo, 'id'>): Promise<Articulo> {
    const validado = this.validarArticulo(entrada);
    return this.repositorio.transaccion(datos => datos.articulos.save({ ...validado, id: this.ids.siguiente('A') }));
  }
  async editarArticulo(id: string, cambios: Omit<Articulo, 'id' | 'totalPiezas'>): Promise<Articulo> {
    return this.repositorio.transaccion(async datos => {
      const actual = await this.obtener(datos.articulos, id, 'artículo');
      return datos.articulos.save({ ...this.validarArticulo({ ...cambios, totalPiezas: actual.totalPiezas }), id });
    });
  }
  async explorarCatalogo(filtro: { categoria?: string; nombre?: string; precioMinimoCentavos?: number; precioMaximoCentavos?: number } = {}): Promise<Articulo[]> {
    const minimo = filtro.precioMinimoCentavos === undefined ? 0 : importe(filtro.precioMinimoCentavos);
    const maximo = filtro.precioMaximoCentavos === undefined ? Number.MAX_SAFE_INTEGER : importe(filtro.precioMaximoCentavos);
    if (maximo < minimo) throw new DatosInvalidosError('El precio máximo no puede ser menor que el mínimo.');
    return this.repositorio.transaccion(async datos => (await datos.articulos.findAll()).filter(a => a.activo && (!filtro.categoria || a.categoria === filtro.categoria) && (!filtro.nombre || a.nombre.toLocaleLowerCase('es').includes(filtro.nombre.toLocaleLowerCase('es'))) && a.precioDiaCentavos >= minimo && a.precioDiaCentavos <= maximo));
  }
  async consultarDisponibilidad(articuloId: string, periodo: Periodo) {
    periodoValido(periodo);
    return this.repositorio.transaccion(async datos => disponibilidad(await this.obtener(datos.articulos, articuloId, 'artículo'), periodo, await datos.reservas.findAll(), await datos.bloqueos.findAll(), this.reloj.hoy()));
  }
  private async cotizarEn(datos: DatosRenta, periodo: Periodo, lineas: LineaSolicitud[]): Promise<Cotizacion> {
    this.futuro(periodo);
    if (!Array.isArray(lineas) || lineas.length === 0) throw new DatosInvalidosError('La reserva debe tener al menos un artículo.');
    const repetidos = new Set<string>();
    const reservas = await datos.reservas.findAll(), bloqueos = await datos.bloqueos.findAll();
    const dias = periodoValido(periodo);
    const detalles = [];
    for (const linea of lineas) {
      entero(linea.cantidad, 'Cantidad solicitada', 1);
      if (repetidos.has(linea.articuloId)) throw new DatosInvalidosError('Agrupa cada artículo en una sola línea de la reserva.');
      repetidos.add(linea.articuloId);
      const articulo = await this.obtener(datos.articulos, linea.articuloId, 'artículo');
      if (!articulo.activo) throw new ArticuloInactivoError(articulo.id);
      const libres = disponibilidad(articulo, periodo, reservas, bloqueos, this.reloj.hoy()).disponibles;
      if (linea.cantidad > libres) throw new DisponibilidadInsuficienteError(articulo.id, linea.cantidad, libres);
      detalles.push({ articuloId: articulo.id, nombre: articulo.nombre, cantidad: linea.cantidad, precioDiaCentavos: articulo.precioDiaCentavos, cargoDanoCentavos: articulo.cargoDanoCentavos, valorReposicionCentavos: articulo.valorReposicionCentavos, subtotalCentavos: importe(linea.cantidad * dias * articulo.precioDiaCentavos) });
    }
    const rentaCentavos = importe(detalles.reduce((s, d) => importe(s + d.subtotalCentavos), 0));
    const depositoCentavos = Math.round(rentaCentavos / 5);
    return { periodo: { ...periodo }, dias, detalles, rentaCentavos, depositoCentavos, totalInicialCentavos: importe(rentaCentavos + depositoCentavos) };
  }
  async cotizar(periodo: Periodo, lineas: LineaSolicitud[]): Promise<Cotizacion> {
    return this.repositorio.transaccion(datos => this.cotizarEn(datos, periodo, lineas));
  }
  async confirmarReserva(entrada: SolicitudReserva): Promise<Reserva> {
    return this.repositorio.transaccion(async datos => {
      const cliente = await this.obtener(datos.usuarios, entrada.clienteId, 'cliente');
      if (cliente.rol !== 'cliente') throw new ClienteRequeridoError();
      const direccion = texto(entrada.direccionEntrega, 'Dirección de entrega', 500);
      // Vuelve a cotizar y verificar dentro de la misma transacción que aparta.
      const cotizacion = await this.cotizarEn(datos, entrada.periodo, entrada.lineas);
      return datos.reservas.save({ ...cotizacion, id: this.ids.siguiente('R'), clienteId: cliente.id, direccionEntrega: direccion, estado: 'apartada', creadaEn: this.reloj.ahora(), entregaReal: null, entregaFecha: null, recoleccionReal: null, recoleccionFecha: null, canceladaEn: null, motivoCancelacion: null, solicitudCancelacion: null, rentaCobradaCentavos: 0, depositoCobradoCentavos: 0, depositoDevueltoCentavos: 0, depositoDevueltoEn: null, cargoIncidenciasCentavos: 0, saldoIncidenciasCentavos: 0, recoleccion: [] });
    });
  }
  async ajustarExistencias(articuloId: string, nueva: number, motivo: string) {
    entero(nueva, 'Nueva existencia'); const razon = texto(motivo, 'Motivo', 500);
    return this.repositorio.transaccion(async datos => {
      const articulo = await this.obtener(datos.articulos, articuloId, 'artículo');
      const compromiso = disponibilidad(articulo, { desde: this.reloj.hoy(), hasta: FIN_ABIERTO }, await datos.reservas.findAll(), await datos.bloqueos.findAll(), this.reloj.hoy()).maximoOcupadas;
      if (nueva < compromiso) throw new ExistenciasComprometidasError(compromiso);
      const ajuste = await datos.ajustes.save({ id: this.ids.siguiente('E'), articuloId, anterior: articulo.totalPiezas, nueva, motivo: razon, registradoEn: this.reloj.ahora() });
      articulo.totalPiezas = nueva; await datos.articulos.save(articulo);
      return ajuste;
    });
  }
  async bloquearMantenimiento(articuloId: string, cantidad: number, periodo: Periodo, motivo: string): Promise<Bloqueo> {
    this.futuro(periodo); entero(cantidad, 'Piezas para mantenimiento', 1); const razon = texto(motivo, 'Motivo', 500);
    return this.repositorio.transaccion(async datos => {
      const articulo = await this.obtener(datos.articulos, articuloId, 'artículo');
      const libres = disponibilidad(articulo, periodo, await datos.reservas.findAll(), await datos.bloqueos.findAll(), this.reloj.hoy()).disponibles;
      if (cantidad > libres) throw new DisponibilidadInsuficienteError(articuloId, cantidad, libres);
      return datos.bloqueos.save({ id: this.ids.siguiente('B'), articuloId, cantidad, periodo: { ...periodo }, tipo: 'mantenimiento', motivo: razon, reservaId: null });
    });
  }
  async terminarBloqueo(id: string, ultimoDiaFueraServicio: Fecha): Promise<Bloqueo> {
    dia(ultimoDiaFueraServicio);
    return this.repositorio.transaccion(async datos => {
      const bloqueo = await this.obtener(datos.bloqueos, id, 'bloqueo');
      if (ultimoDiaFueraServicio < bloqueo.periodo.desde || ultimoDiaFueraServicio > bloqueo.periodo.hasta || ultimoDiaFueraServicio < this.reloj.hoy()) throw new FechaOperacionInvalidaError('El cierre debe estar dentro del bloqueo y no puede modificar días pasados.');
      bloqueo.periodo.hasta = ultimoDiaFueraServicio;
      return datos.bloqueos.save(bloqueo);
    });
  }
  async consultarReservas(filtro: FiltroReservas = {}): Promise<Reserva[]> {
    if (filtro.entregaDesde) dia(filtro.entregaDesde);
    if (filtro.entregaHasta) dia(filtro.entregaHasta);
    if (filtro.entregaDesde && filtro.entregaHasta) periodoValido({ desde: filtro.entregaDesde, hasta: filtro.entregaHasta });
    if (filtro.estado && !['apartada', 'entregada', 'devuelta', 'cancelada'].includes(filtro.estado)) throw new DatosInvalidosError('Estado no reconocido.');
    return this.repositorio.transaccion(async datos => (await datos.reservas.findAll()).filter(r => (!filtro.clienteId || r.clienteId === filtro.clienteId) && (!filtro.estado || r.estado === filtro.estado) && (!filtro.entregaDesde || r.periodo.desde >= filtro.entregaDesde) && (!filtro.entregaHasta || r.periodo.desde <= filtro.entregaHasta)));
  }
  async detalleReserva(id: string) {
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      return { reserva, cliente: await this.obtener(datos.usuarios, reserva.clienteId, 'cliente') };
    });
  }
  async solicitarCancelacion(id: string, clienteId: string, motivo: string): Promise<Reserva> {
    const razon = texto(motivo, 'Motivo', 500);
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      if (reserva.clienteId !== clienteId) throw new ReservaAjenaError();
      if (reserva.estado !== 'apartada') throw new EstadoReservaInvalidoError('solicitar cancelación');
      if (reserva.solicitudCancelacion) throw new SolicitudDuplicadaError();
      reserva.solicitudCancelacion = { solicitadaEn: this.reloj.ahora(), motivo: razon, politica: 'Sin penalización antes de la entrega. La garantía se cobra al entregar, por lo que no hay depósito cobrado que devolver en una reserva apartada. La solicitud no libera piezas hasta que administración la aprueba.' };
      return datos.reservas.save(reserva);
    });
  }
  async cancelarReserva(id: string, motivo: string): Promise<Reserva> {
    const razon = texto(motivo, 'Motivo', 500);
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      if (reserva.estado !== 'apartada') throw new EstadoReservaInvalidoError('cancelar la reserva');
      reserva.estado = 'cancelada'; reserva.canceladaEn = this.reloj.ahora(); reserva.motivoCancelacion = razon;
      return datos.reservas.save(reserva);
    });
  }
  async registrarEntrega(id: string, cobro: { depositoCentavos: number; rentaCentavos: number }): Promise<Reserva> {
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      if (reserva.estado !== 'apartada') throw new EstadoReservaInvalidoError('entregar material');
      const hoy = this.reloj.hoy();
      if (hoy < reserva.periodo.desde || hoy > reserva.periodo.hasta) throw new FechaOperacionInvalidaError('La entrega debe registrarse dentro del periodo reservado.');
      if (cobro.depositoCentavos !== reserva.depositoCentavos) throw new DepositoIncorrectoError();
      if (cobro.rentaCentavos !== reserva.rentaCentavos) throw new CobroRentaIncorrectoError();
      // Los daños y las recolecciones atrasadas pueden afectar reservas posteriores.
      for (const detalle of reserva.detalles) {
        const articulo = await this.obtener(datos.articulos, detalle.articuloId, 'artículo');
        const libres = disponibilidad(articulo, { desde: hoy, hasta: reserva.periodo.hasta }, (await datos.reservas.findAll()).filter(r => r.id !== id), await datos.bloqueos.findAll(), hoy).disponibles;
        if (detalle.cantidad > libres) throw new DisponibilidadInsuficienteError(articulo.id, detalle.cantidad, libres);
      }
      reserva.estado = 'entregada'; reserva.entregaReal = this.reloj.ahora(); reserva.entregaFecha = hoy;
      reserva.depositoCobradoCentavos = cobro.depositoCentavos; reserva.rentaCobradaCentavos = cobro.rentaCentavos;
      return datos.reservas.save(reserva);
    });
  }
  async registrarRecoleccion(id: string, piezas: ResultadoPiezas[]) {
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      if (reserva.estado !== 'entregada') throw new EstadoReservaInvalidoError('registrar la recolección');
      const hoy = this.reloj.hoy();
      if (hoy < reserva.entregaFecha!) throw new FechaOperacionInvalidaError('No se puede recoger antes de la entrega real.');
      if (!Array.isArray(piezas) || piezas.length !== reserva.detalles.length || new Set(piezas.map(p => p.articuloId)).size !== piezas.length) throw new RecoleccionInconsistenteError();
      let cargos = 0;
      for (const detalle of reserva.detalles) {
        const resultado = piezas.find(p => p.articuloId === detalle.articuloId);
        if (!resultado || [resultado.buenas, resultado.danadas, resultado.faltantes].some(n => !Number.isSafeInteger(n) || n < 0) || resultado.buenas + resultado.danadas + resultado.faltantes !== detalle.cantidad) throw new RecoleccionInconsistenteError();
        cargos = importe(cargos + resultado.danadas * detalle.cargoDanoCentavos + resultado.faltantes * detalle.valorReposicionCentavos);
        // El día de recogida sigue ocupado. Las buenas se liberan al día siguiente;
        // dañadas/faltantes quedan bloqueadas hasta una resolución explícita.
        const siguiente = fechaDesdeDia(dia(hoy) + 1);
        for (const [tipo, cantidad] of [['dano', resultado.danadas], ['faltante', resultado.faltantes]] as const) {
          if (cantidad > 0) await datos.bloqueos.save({ id: this.ids.siguiente('B'), articuloId: detalle.articuloId, cantidad, periodo: { desde: siguiente, hasta: FIN_ABIERTO }, tipo, motivo: `Incidencia en la recolección de ${id}`, reservaId: id });
        }
      }
      reserva.estado = 'devuelta'; reserva.recoleccionReal = this.reloj.ahora(); reserva.recoleccionFecha = hoy;
      reserva.recoleccion = structuredClone(piezas); reserva.cargoIncidenciasCentavos = cargos;
      reserva.saldoIncidenciasCentavos = Math.max(0, cargos - reserva.depositoCobradoCentavos);
      await datos.reservas.save(reserva);
      const reservasAfectadas = new Set<string>();
      const todas = await datos.reservas.findAll(), bloqueos = await datos.bloqueos.findAll();
      for (const futura of todas.filter(r => r.estado === 'apartada' && r.periodo.hasta >= hoy)) {
        for (const detalle of futura.detalles) {
          const articulo = await this.obtener(datos.articulos, detalle.articuloId, 'artículo');
          if (disponibilidad(articulo, { desde: futura.periodo.desde < hoy ? hoy : futura.periodo.desde, hasta: futura.periodo.hasta }, todas, bloqueos, hoy).deficit > 0) reservasAfectadas.add(futura.id);
        }
      }
      return { reserva, depositoLiberableCentavos: Math.max(0, reserva.depositoCobradoCentavos - cargos), reservasAfectadas: [...reservasAfectadas] };
    });
  }
  async registrarDevolucionDeposito(id: string, montoCentavos: number): Promise<Reserva> {
    importe(montoCentavos);
    return this.repositorio.transaccion(async datos => {
      const reserva = await this.obtener(datos.reservas, id, 'reserva');
      const liberable = Math.max(0, reserva.depositoCobradoCentavos - reserva.cargoIncidenciasCentavos);
      if (!['devuelta', 'cancelada'].includes(reserva.estado) || reserva.depositoDevueltoEn !== null || montoCentavos !== liberable) throw new DevolucionDepositoInvalidaError();
      reserva.depositoDevueltoCentavos = montoCentavos; reserva.depositoDevueltoEn = this.reloj.ahora();
      return datos.reservas.save(reserva);
    });
  }
  async calendario(periodo: Periodo) {
    const dias = periodoValido(periodo);
    if (dias > 366) throw new DatosInvalidosError('El calendario admite hasta 366 días por consulta.');
    return this.repositorio.transaccion(async datos => {
      const reservas = await datos.reservas.findAll(), articulos = await datos.articulos.findAll(), bloqueos = await datos.bloqueos.findAll();
      return Array.from({ length: dias }, (_, i) => {
        const fecha = fechaDesdeDia(dia(periodo.desde) + i);
        return { fecha, entregas: reservas.filter(r => r.estado !== 'cancelada' && r.periodo.desde === fecha).map(r => r.id), recolecciones: reservas.filter(r => r.estado !== 'cancelada' && r.periodo.hasta === fecha).map(r => r.id), disponibilidad: articulos.map(a => disponibilidad(a, { desde: fecha, hasta: fecha }, reservas, bloqueos, this.reloj.hoy())) };
      });
    });
  }
  async resumenNegocio(periodo: Periodo) {
    periodoValido(periodo);
    return this.repositorio.transaccion(async datos => {
      const reservas = await datos.reservas.findAll(), bloqueos = await datos.bloqueos.findAll(), hoy = this.reloj.hoy();
      const cobradas = reservas.filter(r => r.entregaFecha !== null && r.entregaFecha >= periodo.desde && r.entregaFecha <= periodo.hasta);
      const demanda = new Map<string, { articuloId: string; nombre: string; piezas: number }>();
      for (const r of reservas.filter(r => r.estado !== 'cancelada' && r.periodo.desde >= periodo.desde && r.periodo.desde <= periodo.hasta)) {
        for (const d of r.detalles) { const actual = demanda.get(d.articuloId) ?? { articuloId: d.articuloId, nombre: d.nombre, piezas: 0 }; actual.piezas += d.cantidad; demanda.set(d.articuloId, actual); }
      }
      return {
        entregasDelDia: reservas.filter(r => r.estado === 'apartada' && r.periodo.desde === hoy).map(r => r.id),
        recoleccionesPendientes: reservas.filter(r => r.estado === 'entregada' && r.periodo.hasta <= hoy).map(r => r.id),
        articulosMasRentados: [...demanda.values()].sort((a, b) => b.piezas - a.piezas),
        ingresoRentasCentavos: importe(cobradas.reduce((s, r) => s + r.rentaCobradaCentavos, 0)),
        piezasFueraServicio: bloqueos.filter(b => b.periodo.desde <= hoy && b.periodo.hasta >= hoy).map(b => ({ articuloId: b.articuloId, cantidad: b.cantidad, motivo: b.tipo })),
      };
    });
  }
}
