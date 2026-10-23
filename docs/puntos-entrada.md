# Puntos de entrada del servicio

El esquema navegable y ejecutable está en /docs/. Todas las rutas provienen de src/servicio/app.ts.

| Método | Recurso | Permiso | Éxito | Operación |
| --- | --- | --- | --- | --- |
| GET | /salud | Público | 200 | Comprobar conexión real a MySQL |
| POST | /usuarios | Público | 201 | Registrar una cuenta cliente |
| GET | /usuarios | Administrador | 200 | Consultar usuarios sin credenciales |
| POST | /sesiones | Público | 200 | Obtener credencial con expiración |
| GET | /usuarios/me | Autenticado | 200 | Consultar el perfil propio |
| GET | /articulos | Público | 200 | Explorar por nombre categoría y precio |
| POST | /articulos | Administrador | 201 | Crear un artículo |
| GET | /inventario | Administrador | 200 | Consultar todos los artículos incluidos los inactivos |
| GET | /articulos/{id} | Público | 200 | Consultar un artículo activo |
| PUT | /articulos/{id} | Administrador | 200 | Reemplazar datos del catálogo conservando existencias |
| GET | /articulos/{id}/disponibilidad | Público | 200 | Consultar disponibilidad por fechas |
| POST | /cotizaciones | Público | 200 | Cotizar sin apartar piezas |
| POST | /reservas | Cliente propio o administrador | 201 | Confirmar y apartar una reserva |
| GET | /reservas | Cliente propio o administrador | 200 | Consultar reservas e historial según el rol |
| GET | /reservas/{id} | Cliente propio o administrador | 200 | Abrir una reserva propia o administrativa |
| POST | /reservas/{id}/solicitudes-cancelacion | Cliente propietario | 201 | Solicitar cancelación de una reserva propia |
| POST | /reservas/{id}/cancelacion | Administrador | 201 | Aprobar cancelación y liberar piezas |
| POST | /reservas/{id}/entrega | Administrador | 201 | Registrar salida y cobros exactos |
| POST | /reservas/{id}/recoleccion | Administrador | 201 | Registrar retorno daños y faltantes |
| POST | /reservas/{id}/devoluciones-deposito | Administrador | 201 | Registrar la devolución de la garantía |
| POST | /articulos/{id}/ajustes | Administrador | 201 | Ajustar existencias con motivo |
| GET | /ajustes | Administrador | 200 | Consultar la bitácora de existencias |
| POST | /bloqueos | Administrador | 201 | Bloquear piezas para mantenimiento |
| GET | /bloqueos | Administrador | 200 | Consultar bloqueos de mantenimiento daños y faltantes |
| PATCH | /bloqueos/{id} | Administrador | 200 | Registrar el último día fuera de servicio |
| GET | /calendario | Administrador | 200 | Consultar entregas y recolecciones programadas |
| GET | /resumen | Administrador | 200 | Consultar el resumen del negocio |

Errores de negocio: 409 con código específico. Entrada inválida: 400. Sin credencial: 401. Rol o propiedad incorrectos: 403. Recurso inexistente: 404. Cuerpo excesivo: 413. Tipo de contenido incorrecto: 415. Fallo interno: 500.
