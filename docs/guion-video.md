# Guion para el video del avance 1

Duración sugerida: siete minutos. El equipo debe grabar su explicación y pantalla, con audio legible. No hacen falta servidor, base de datos ni una interfaz gráfica.

| Tiempo | Mostrar y explicar |
| --- | --- |
| 00:00 a 00:50 | Presentarse y explicar el problema del cuaderno: evitar apartar las mismas piezas para dos eventos. Aclarar que el giro elegido es mobiliario para eventos sociales. |
| 00:50 a 02:00 | Abrir el diagrama de entidades. Explicar Usuario, Reserva, DetalleReserva y Articulo; mencionar los bloqueos y ajustes. Una reserva tiene uno o más detalles y cada detalle pertenece a un artículo. |
| 02:00 a 03:00 | Explicar fechas inclusivas, ocupación simultánea, garantía del veinte por ciento y conservación de precios. Señalar que estas políticas se documentaron porque el enunciado no fija todos los detalles. |
| 03:00 a 04:00 | Abrir renta.service.ts y puertos.ts. Mostrar que el constructor recibe RepositorioRenta y que no hay imports del repositorio en memoria. Abrir composicion.ts: ahí se elige el adaptador. |
| 04:00 a 05:30 | Ejecutar npm run demo. Leer el primer caso aceptado, el total de $4,320 y las veinte piezas restantes. Mostrar el rechazo de otras treinta sillas y el rechazo de reducir la existencia a setenta. Explicar que ambos preservan los datos. |
| 05:30 a 06:30 | Ejecutar npm test, npm run verificar:arquitectura y npm run verificar:diagrama. Mencionar la prueba de concurrencia, la de rollback y la de sustitución del repositorio. |
| 06:30 a 07:00 | Mostrar el diagrama de arquitectura y la rama feat-dominio. Identificar qué está implementado y qué corresponde a los siguientes avances. |

## Antes de grabar

Ejecutar npm ci una vez. Ensayar npm run demo. Aumentar el tamaño de letra de la terminal. Cerrar notificaciones y ventanas que contengan datos personales. Mostrar el repositorio y los diagramas antes de comenzar la explicación.

## Comandos durante la demostración

```bash
npm run demo
npm test
npm run verificar:arquitectura
npm run verificar:diagrama
```

El programa debe terminar con tres de tres escenarios correctos. Los dos rechazos son resultados esperados, no fallas del programa. Las reservas no se guardan entre ejecuciones porque este avance usa memoria.
