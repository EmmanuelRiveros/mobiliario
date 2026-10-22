export abstract class ErrorDeDominio extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
    this.name = new.target.name;
  }
}
export class DatosInvalidosError extends ErrorDeDominio {
  constructor(mensaje: string) { super('DATOS_INVALIDOS', mensaje); }
}
export class PeriodoInvalidoError extends ErrorDeDominio {
  constructor(mensaje = 'El rango debe contener fechas reales y terminar después de su inicio o el mismo día.') { super('PERIODO_INVALIDO', mensaje); }
}
export class EntidadNoEncontradaError extends ErrorDeDominio {
  constructor(tipo: string, id: string) { super('NO_ENCONTRADO', `No existe ${tipo} ${id}.`); }
}
export class CorreoDuplicadoError extends ErrorDeDominio {
  constructor() { super('CORREO_DUPLICADO', 'Ya existe un usuario con ese correo.'); }
}
export class ClienteRequeridoError extends ErrorDeDominio {
  constructor() { super('CLIENTE_REQUERIDO', 'La reserva debe pertenecer a un usuario con rol cliente.'); }
}
export class ArticuloInactivoError extends ErrorDeDominio {
  constructor(id: string) { super('ARTICULO_INACTIVO', `El artículo ${id} no está disponible para nuevas reservas.`); }
}
export class DisponibilidadInsuficienteError extends ErrorDeDominio {
  constructor(id: string, solicitadas: number, libres: number) { super('DISPONIBILIDAD_INSUFICIENTE', `El artículo ${id} tiene ${libres} piezas libres; se solicitaron ${solicitadas}.`); }
}
export class ExistenciasComprometidasError extends ErrorDeDominio {
  constructor(minimo: number) { super('EXISTENCIAS_COMPROMETIDAS', `No se pueden dejar menos de ${minimo} piezas: hay reservas o bloqueos comprometidos.`); }
}
export class EstadoReservaInvalidoError extends ErrorDeDominio {
  constructor(operacion: string) { super('ESTADO_RESERVA_INVALIDO', `El estado actual no permite ${operacion}.`); }
}
export class DepositoIncorrectoError extends ErrorDeDominio {
  constructor() { super('DEPOSITO_INCORRECTO', 'El depósito cobrado debe coincidir con la garantía cotizada.'); }
}
export class CobroRentaIncorrectoError extends ErrorDeDominio {
  constructor() { super('COBRO_RENTA_INCORRECTO', 'El cobro de renta debe coincidir con la renta cotizada.'); }
}
export class RecoleccionInconsistenteError extends ErrorDeDominio {
  constructor() { super('RECOLECCION_INCONSISTENTE', 'Cada artículo debe aparecer una vez y sus piezas buenas, dañadas y faltantes deben sumar lo entregado.'); }
}
export class DevolucionDepositoInvalidaError extends ErrorDeDominio {
  constructor() { super('DEVOLUCION_DEPOSITO_INVALIDA', 'La devolución debe coincidir con el saldo liberable y solo registrarse una vez al terminar la reserva.'); }
}
export class ReservaAjenaError extends ErrorDeDominio {
  constructor() { super('RESERVA_AJENA', 'El cliente no puede solicitar la cancelación de una reserva ajena.'); }
}
export class FechaOperacionInvalidaError extends ErrorDeDominio {
  constructor(mensaje: string) { super('FECHA_OPERACION_INVALIDA', mensaje); }
}
export class SolicitudDuplicadaError extends ErrorDeDominio {
  constructor() { super('SOLICITUD_DUPLICADA', 'Ya existe una solicitud de cancelación para esa reserva.'); }
}
