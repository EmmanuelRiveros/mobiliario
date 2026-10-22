# Avance 1 Renta de mobiliario para eventos sociales

Proyecto 1 de Tópico de Aplicaciones Web. Este avance implementa solamente el dominio, su contrato de datos, el adaptador en memoria y un programa de consola. Las reglas no importan herramientas externas ni conocen pantallas, HTTP o bases de datos.

Repositorio: https://github.com/EmmanuelRiveros/mobiliario/tree/feat-dominio

## Requisitos y ejecución desde cero

1. Instalar Node.js 22.18 o posterior, con npm incluido. Se verificó con Node.js 24.11.1.
2. Instalar Git si se desea clonar el repositorio.
3. Abrir una terminal y ejecutar:

```bash
git clone --branch feat-dominio https://github.com/EmmanuelRiveros/mobiliario.git
cd mobiliario
npm ci
npm run demo
```

No hay variables de entorno, credenciales, servidor, puerto ni base de datos que configurar. Cada ejecución empieza con datos nuevos en memoria. El programa usa un reloj fijo en el 1 de junio de 2027 para que los escenarios no caduquen.

### Resultado esperado de los tres escenarios

1. **Aceptado:** reservar 80 de las 100 sillas del 12 al 14 de junio. Son tres días a $15.00 por pieza y día: renta $3,600.00, garantía $720.00 y total inicial $4,320.00. Quedan 20 piezas libres.
2. **Rechazado:** intentar reservar otras 30 sillas en ese mismo rango. Se obtiene `DISPONIBILIDAD_INSUFICIENTE` y no se guarda una segunda reserva.
3. **Rechazado:** intentar reducir la existencia a 70 cuando ya hay 80 sillas apartadas. Se obtiene `EXISTENCIAS_COMPROMETIDAS`; la existencia sigue siendo 100.

El programa verifica los resultados con aserciones. Si una operación que debía ser rechazada se acepta, o si falla el caso válido, termina con código distinto de cero.

## Comprobar el avance

```bash
npm run typecheck
npm test
npm run verificar:arquitectura
npm run verificar:diagrama
```

`npm test` compila y ejecuta las pruebas con el ejecutor de Node.js. Incluyen traslapes, días consecutivos, mantenimiento, cambios de existencias, dos confirmaciones concurrentes, rollback, dinero, cancelaciones, recolección y sustitución del repositorio. También se comparan 120 calendarios generados con un conteo diario independiente.

`verificar:arquitectura` analiza los imports mediante el AST de TypeScript y comprueba que los archivos del dominio solo importen archivos de esa misma carpeta. Revisa que la elección de `RepositorioRentaMemoria` ocurra una sola vez, en `src/composicion.ts`.

`verificar:diagrama` comprueba que las entidades y sus atributos en el Mermaid correspondan al modelo TypeScript. Los SVG son las vistas legibles del diagrama; los contratos de entrada y salida complementarios están en el mismo Mermaid completo.

Para guardar de nuevo el registro de la demostración y de las comprobaciones:

```bash
npm run evidencias
```

## Organización

```text
src/
  dominio/
    modelo.ts                 Entidades y contratos de entrada y salida
    puertos.ts                Repositorios, reloj y generador de identificadores
    errores.ts                Errores propios de cada rechazo de negocio
    calculos.ts               Fechas y disponibilidad por barrido temporal
    renta.service.ts          Casos de uso y reglas
  infraestructura/
    repositorio-memoria.ts     Copias, exclusión mutua y rollback en memoria
    reloj.ts                  Reloj de sistema e identificadores UUID
  composicion.ts              Único punto que selecciona el almacenamiento
  datos-demostracion.ts       Usuarios y artículos ficticios
  main.ts                    Un escenario aceptado y dos rechazados
test/                        Pruebas del dominio y del contrato
scripts/                     Comprobaciones y registro de evidencias
docs/                        Informe, diagramas y guion del video
evidencias/                  Registros reales de ejecución
```

## Reglas y decisiones del equipo

- Giro: sillas, mesas y mobiliario para reuniones y celebraciones sociales. No se mezclan reglas de herramientas, hoteles o boletos.
- Las fechas son días civiles inclusivos en formato `YYYY-MM-DD`. Viernes a domingo son tres días; las mismas piezas pueden rentarse de nuevo desde el lunes. No se ofrece rotación dentro del mismo día.
- Las piezas del mismo artículo son intercambiables. Se controla cantidad, sin números de serie individuales. Para cada rango, la disponibilidad es el mínimo libre de todos sus días, equivalente al total menos la ocupación máxima simultánea.
- Confirmar revalida y aparta de manera atómica. Cotizar no aparta. No se pueden reservar más piezas de las disponibles ni reducir la existencia por debajo de la ocupación máxima futura, que incluye mantenimiento.
- Los bloqueos de mantenimiento solo se aceptan si no invaden piezas comprometidas. Terminar un bloqueo libera las piezas al día siguiente del último día fuera de servicio.
- Los importes se guardan en centavos enteros de pesos mexicanos. La renta es cantidad por días por precio diario. La garantía es el 20 por ciento de la renta, redondeada al centavo más cercano. Es una política elegida para este proyecto; el enunciado no fija el porcentaje.
- La confirmación conserva una copia de los precios y cargos. Cambiar el catálogo no modifica una reserva anterior.
- La garantía y la renta se cobran al entregar. No se integran pagos electrónicos en este avance. La garantía no cuenta como ingreso de renta.
- Una reserva pasa de apartada a entregada y después a devuelta; desde apartada también puede pasar a cancelada. La cancelación después de la entrega no está permitida.
- Cancelar antes de la entrega no tiene penalización. Como no se cobra anticipadamente, no hay garantía que reembolsar en ese estado. Esta política se aplica con cualquier anticipación. El cliente solicita; administración aprueba y libera las piezas. La solicitud por sí sola no las libera.
- La recolección debe clasificar todas las piezas como buenas, dañadas o faltantes. Las buenas se liberan al día siguiente. Las dañadas y faltantes quedan bloqueadas hasta que se registre su reparación o recuperación. Un faltante no vuelve a ser disponible solo porque se cobre un cargo.
- El cargo por daño y el valor de reposición se configuran por artículo y se conservan en el detalle. Se descuenta el cargo de la garantía sin generar devoluciones negativas; el exceso queda como saldo pendiente.
- Una recolección atrasada mantiene ocupado el material hasta que se registre. Si un daño o faltante afecta una reserva posterior, la recolección registra la realidad y devuelve los identificadores de las reservas afectadas; además se bloquea una entrega que ya no puede cumplirse. No se cancelan compromisos silenciosamente.
- El total de piezas incluye las unidades dañadas o pendientes de recuperación; los bloqueos impiden rentarlas. Una baja definitiva se registra mediante un ajuste de existencias, después de resolver el bloqueo y sin afectar compromisos. Los datos históricos y los precios se conservan; no hay borrado de reservas.
- El calendario lista entregas y recolecciones programadas. Las fechas reales están en la reserva. Las consultas del calendario admiten hasta 366 días; las consultas de disponibilidad no tienen ese límite.

Los nombres, contactos y domicilios de la demostración son ficticios. Las imágenes SVG locales son ilustraciones propias para representar las referencias visuales del catálogo, no fotografías de inventario real.

## Casos de uso del proyecto y su contrato de dominio

| Caso del proyecto | Operación implementada |
| --- | --- |
| Registrar y gestionar catálogo | `registrarArticulo`, `editarArticulo` |
| Ajustar existencias con motivo | `ajustarExistencias` |
| Bloquear mantenimiento o terminar reparación | `bloquearMantenimiento`, `terminarBloqueo` |
| Explorar por nombre, categoría y precio | `explorarCatalogo` |
| Consultar piezas libres por fechas | `consultarDisponibilidad` |
| Armar y cotizar una reserva | `cotizar` |
| Confirmar y apartar piezas | `confirmarReserva` |
| Consultar, filtrar y abrir una reserva | `consultarReservas`, `detalleReserva` |
| Historial del cliente | `consultarReservas` con `clienteId` |
| Registrar salida y cobros | `registrarEntrega` |
| Registrar retorno, daños y faltantes | `registrarRecoleccion` |
| Registrar devolución de la garantía | `registrarDevolucionDeposito` |
| Solicitar y aprobar cancelación | `solicitarCancelacion`, `cancelarReserva` |
| Calendario de ocupación | `calendario` |
| Resumen del negocio | `resumenNegocio` |
| Datos de la persona y su rol | `registrarUsuario` |

En este avance no existe una sesión ni un usuario autenticado. `registrarUsuario` modela los datos de la persona y su rol para probar el dominio; no es un endpoint público de registro. Contraseñas, login, validación de credenciales y autorización de las llamadas se implementarán en el avance 2. El futuro registro público solo podrá crear clientes; las operaciones administrativas tendrán que verificar al administrador antes de llamar al dominio. Conocer un `clienteId` no será una prueba de identidad.

## Almacenamiento y arquitectura elegidos

Se propone MySQL, de tipo relacional, para el siguiente avance. Usuario se relaciona con reservas; cada reserva contiene detalles de artículos; los bloqueos y ajustes pertenecen al inventario. Las claves foráneas y las transacciones permitirán conservar esas relaciones y coordinar confirmaciones simultáneas. La disponibilidad depende de intervalos y cantidades, por lo que no se sustituye con una simple restricción única de fecha.

La arquitectura elegida separa portal público, panel administrativo y un servicio central. Ambos clientes consumirán el mismo contrato del servicio. El dominio contiene las reglas y depende únicamente de interfaces. Hoy el adaptador implementado es en memoria y el único consumidor es el programa de consola.

El contrato `RepositorioRenta.transaccion` exige operaciones atómicas y serializables, copias de los resultados y rollback si falla el callback. Dentro de la unidad de trabajo se exponen repositorios de usuarios, artículos, reservas, bloqueos y ajustes. La implementación futura deberá garantizar estas condiciones con transacciones de la base de datos y el control de concurrencia adecuado. La exclusión mutua actual sirve solo para este proceso en memoria.

Para sustituir el almacenamiento se cambia la construcción del repositorio en `src/composicion.ts`, sin editar `RentaService`, sus entidades ni sus reglas. La prueba de sustitución usa otro objeto que cumple el mismo contrato; no afirma haber implementado una base de datos real.

## Entregables y siguiente paso del alumno

- Informe PDF y versión editable sin portada en `docs`.
- Diagrama de entidades y arquitectura en Mermaid, SVG y PNG.
- Código en la rama `feat-dominio`.
- Tres escenarios y registros en `evidencias`.
- Guion con tiempos en `docs/guion-video.md`.

**Pendiente del equipo:** grabar el video de cinco a diez minutos explicando el modelo y mostrando `npm run demo`. No se incluye una grabación que suplante la presentación del equipo. El guion deja preparado el recorrido.

## Fuentes

- Proyecto 1 Renta de Mobiliario y Equipo para Eventos, proporcionado por el profesor.
- Avance 01 El Dominio y la Arquitectura, proporcionado por el profesor.
- Prácticas de clase sobre entidades tipadas, Repository e inyección de dependencias.
- TypeScript: https://www.typescriptlang.org/docs/handbook/modules/reference.html
