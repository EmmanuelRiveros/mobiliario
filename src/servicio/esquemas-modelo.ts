// Generado desde el dominio sin modificarlo: npm run esquemas.
export const esquemasModelo = [
  {
    "$id": "Periodo",
    "type": "object",
    "properties": {
      "desde": {
        "type": "string"
      },
      "hasta": {
        "type": "string"
      }
    },
    "required": [
      "desde",
      "hasta"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Usuario",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "nombre": {
        "type": "string"
      },
      "correo": {
        "type": "string"
      },
      "telefono": {
        "type": "string"
      },
      "rol": {
        "anyOf": [
          {
            "type": "string",
            "const": "administrador"
          },
          {
            "type": "string",
            "const": "cliente"
          }
        ]
      }
    },
    "required": [
      "id",
      "nombre",
      "correo",
      "telefono",
      "rol"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Articulo",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "nombre": {
        "type": "string"
      },
      "descripcion": {
        "type": "string"
      },
      "categoria": {
        "type": "string"
      },
      "fotografias": {
        "type": "array",
        "items": {
          "type": "string"
        }
      },
      "precioDiaCentavos": {
        "type": "integer"
      },
      "cargoDanoCentavos": {
        "type": "integer"
      },
      "valorReposicionCentavos": {
        "type": "integer"
      },
      "totalPiezas": {
        "type": "integer"
      },
      "activo": {
        "type": "boolean"
      }
    },
    "required": [
      "id",
      "nombre",
      "descripcion",
      "categoria",
      "fotografias",
      "precioDiaCentavos",
      "cargoDanoCentavos",
      "valorReposicionCentavos",
      "totalPiezas",
      "activo"
    ],
    "additionalProperties": false
  },
  {
    "$id": "DetalleReserva",
    "type": "object",
    "properties": {
      "articuloId": {
        "type": "string"
      },
      "nombre": {
        "type": "string"
      },
      "cantidad": {
        "type": "integer"
      },
      "precioDiaCentavos": {
        "type": "integer"
      },
      "cargoDanoCentavos": {
        "type": "integer"
      },
      "valorReposicionCentavos": {
        "type": "integer"
      },
      "subtotalCentavos": {
        "type": "integer"
      }
    },
    "required": [
      "articuloId",
      "nombre",
      "cantidad",
      "precioDiaCentavos",
      "cargoDanoCentavos",
      "valorReposicionCentavos",
      "subtotalCentavos"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Cotizacion",
    "type": "object",
    "properties": {
      "periodo": {
        "$ref": "Periodo#"
      },
      "dias": {
        "type": "integer"
      },
      "detalles": {
        "type": "array",
        "items": {
          "$ref": "DetalleReserva#"
        }
      },
      "rentaCentavos": {
        "type": "integer"
      },
      "depositoCentavos": {
        "type": "integer"
      },
      "totalInicialCentavos": {
        "type": "integer"
      }
    },
    "required": [
      "periodo",
      "dias",
      "detalles",
      "rentaCentavos",
      "depositoCentavos",
      "totalInicialCentavos"
    ],
    "additionalProperties": false
  },
  {
    "$id": "ResultadoPiezas",
    "type": "object",
    "properties": {
      "articuloId": {
        "type": "string"
      },
      "buenas": {
        "type": "integer"
      },
      "danadas": {
        "type": "integer"
      },
      "faltantes": {
        "type": "integer"
      }
    },
    "required": [
      "articuloId",
      "buenas",
      "danadas",
      "faltantes"
    ],
    "additionalProperties": false
  },
  {
    "$id": "SolicitudCancelacion",
    "type": "object",
    "properties": {
      "solicitadaEn": {
        "type": "string"
      },
      "motivo": {
        "type": "string"
      },
      "politica": {
        "type": "string"
      }
    },
    "required": [
      "solicitadaEn",
      "motivo",
      "politica"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Reserva",
    "type": "object",
    "properties": {
      "periodo": {
        "$ref": "Periodo#"
      },
      "dias": {
        "type": "integer"
      },
      "detalles": {
        "type": "array",
        "items": {
          "$ref": "DetalleReserva#"
        }
      },
      "rentaCentavos": {
        "type": "integer"
      },
      "depositoCentavos": {
        "type": "integer"
      },
      "totalInicialCentavos": {
        "type": "integer"
      },
      "id": {
        "type": "string"
      },
      "clienteId": {
        "type": "string"
      },
      "direccionEntrega": {
        "type": "string"
      },
      "estado": {
        "anyOf": [
          {
            "type": "string",
            "const": "apartada"
          },
          {
            "type": "string",
            "const": "entregada"
          },
          {
            "type": "string",
            "const": "devuelta"
          },
          {
            "type": "string",
            "const": "cancelada"
          }
        ]
      },
      "creadaEn": {
        "type": "string"
      },
      "entregaReal": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "entregaFecha": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "recoleccionReal": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "recoleccionFecha": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "canceladaEn": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "motivoCancelacion": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "solicitudCancelacion": {
        "anyOf": [
          {
            "$ref": "SolicitudCancelacion#"
          },
          {
            "type": "null"
          }
        ]
      },
      "rentaCobradaCentavos": {
        "type": "integer"
      },
      "depositoCobradoCentavos": {
        "type": "integer"
      },
      "depositoDevueltoCentavos": {
        "type": "integer"
      },
      "depositoDevueltoEn": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      },
      "cargoIncidenciasCentavos": {
        "type": "integer"
      },
      "saldoIncidenciasCentavos": {
        "type": "integer"
      },
      "recoleccion": {
        "type": "array",
        "items": {
          "$ref": "ResultadoPiezas#"
        }
      }
    },
    "required": [
      "periodo",
      "dias",
      "detalles",
      "rentaCentavos",
      "depositoCentavos",
      "totalInicialCentavos",
      "id",
      "clienteId",
      "direccionEntrega",
      "estado",
      "creadaEn",
      "entregaReal",
      "entregaFecha",
      "recoleccionReal",
      "recoleccionFecha",
      "canceladaEn",
      "motivoCancelacion",
      "solicitudCancelacion",
      "rentaCobradaCentavos",
      "depositoCobradoCentavos",
      "depositoDevueltoCentavos",
      "depositoDevueltoEn",
      "cargoIncidenciasCentavos",
      "saldoIncidenciasCentavos",
      "recoleccion"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Bloqueo",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "articuloId": {
        "type": "string"
      },
      "cantidad": {
        "type": "integer"
      },
      "periodo": {
        "$ref": "Periodo#"
      },
      "tipo": {
        "anyOf": [
          {
            "type": "string",
            "const": "mantenimiento"
          },
          {
            "type": "string",
            "const": "dano"
          },
          {
            "type": "string",
            "const": "faltante"
          }
        ]
      },
      "motivo": {
        "type": "string"
      },
      "reservaId": {
        "anyOf": [
          {
            "type": "string"
          },
          {
            "type": "null"
          }
        ]
      }
    },
    "required": [
      "id",
      "articuloId",
      "cantidad",
      "periodo",
      "tipo",
      "motivo",
      "reservaId"
    ],
    "additionalProperties": false
  },
  {
    "$id": "AjusteExistencia",
    "type": "object",
    "properties": {
      "id": {
        "type": "string"
      },
      "articuloId": {
        "type": "string"
      },
      "anterior": {
        "type": "integer"
      },
      "nueva": {
        "type": "integer"
      },
      "motivo": {
        "type": "string"
      },
      "registradoEn": {
        "type": "string"
      }
    },
    "required": [
      "id",
      "articuloId",
      "anterior",
      "nueva",
      "motivo",
      "registradoEn"
    ],
    "additionalProperties": false
  },
  {
    "$id": "LineaSolicitud",
    "type": "object",
    "properties": {
      "articuloId": {
        "type": "string"
      },
      "cantidad": {
        "type": "integer"
      }
    },
    "required": [
      "articuloId",
      "cantidad"
    ],
    "additionalProperties": false
  },
  {
    "$id": "SolicitudReserva",
    "type": "object",
    "properties": {
      "clienteId": {
        "type": "string"
      },
      "periodo": {
        "$ref": "Periodo#"
      },
      "lineas": {
        "type": "array",
        "items": {
          "$ref": "LineaSolicitud#"
        }
      },
      "direccionEntrega": {
        "type": "string"
      }
    },
    "required": [
      "clienteId",
      "periodo",
      "lineas",
      "direccionEntrega"
    ],
    "additionalProperties": false
  },
  {
    "$id": "Disponibilidad",
    "type": "object",
    "properties": {
      "articuloId": {
        "type": "string"
      },
      "totalPiezas": {
        "type": "integer"
      },
      "maximoOcupadas": {
        "type": "integer"
      },
      "disponibles": {
        "type": "integer"
      },
      "deficit": {
        "type": "integer"
      }
    },
    "required": [
      "articuloId",
      "totalPiezas",
      "maximoOcupadas",
      "disponibles",
      "deficit"
    ],
    "additionalProperties": false
  },
  {
    "$id": "FiltroReservas",
    "type": "object",
    "properties": {
      "clienteId": {
        "type": "string"
      },
      "estado": {
        "anyOf": [
          {
            "type": "string",
            "const": "apartada"
          },
          {
            "type": "string",
            "const": "entregada"
          },
          {
            "type": "string",
            "const": "devuelta"
          },
          {
            "type": "string",
            "const": "cancelada"
          }
        ]
      },
      "entregaDesde": {
        "type": "string"
      },
      "entregaHasta": {
        "type": "string"
      }
    },
    "required": [],
    "additionalProperties": false
  }
];
