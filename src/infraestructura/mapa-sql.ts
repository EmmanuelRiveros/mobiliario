// Correspondencia explícita entre el modelo intacto y las columnas relacionales.
export const mapas = {
    usuarios: { tabla: 'usuarios', campos: ['id', 'nombre', 'correo', 'telefono', 'rol'] },
    articulos: { tabla: 'articulos', campos: ['id', 'nombre', 'descripcion', 'categoria', 'precioDiaCentavos', 'cargoDanoCentavos', 'valorReposicionCentavos', 'totalPiezas', 'activo'] },
    reservas: { tabla: 'reservas', campos: ['id', 'clienteId', 'desde', 'hasta', 'dias', 'rentaCentavos', 'depositoCentavos', 'totalInicialCentavos', 'direccionEntrega', 'estado', 'creadaEn', 'entregaReal', 'entregaFecha', 'recoleccionReal', 'recoleccionFecha', 'canceladaEn', 'motivoCancelacion', 'solicitadaEn', 'motivoSolicitud', 'politicaSolicitud', 'rentaCobradaCentavos', 'depositoCobradoCentavos', 'depositoDevueltoCentavos', 'depositoDevueltoEn', 'cargoIncidenciasCentavos', 'saldoIncidenciasCentavos'] },
    bloqueos: { tabla: 'bloqueos', campos: ['id', 'articuloId', 'cantidad', 'desde', 'hasta', 'tipo', 'motivo', 'reservaId'] },
    ajustes: { tabla: 'ajustes', campos: ['id', 'articuloId', 'anterior', 'nueva', 'motivo', 'registradoEn'] },
} as const;
export const camposDetalle = ['articuloId', 'nombre', 'cantidad', 'precioDiaCentavos', 'cargoDanoCentavos', 'valorReposicionCentavos', 'subtotalCentavos'];
export const camposRecoleccion = ['articuloId', 'buenas', 'danadas', 'faltantes'];
