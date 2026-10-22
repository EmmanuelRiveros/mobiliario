import type { RentaService } from './dominio/renta.service.js';
export async function prepararDemostracion(servicio: RentaService) {
  const admin = await servicio.registrarUsuario({ nombre: 'Administración de ejemplo', correo: 'admin@example.test', telefono: '6440000000', rol: 'administrador' });
  const cliente = await servicio.registrarUsuario({ nombre: 'Cliente de ejemplo', correo: 'cliente@example.test', telefono: '6440000001', rol: 'cliente' });
  const sillas = await servicio.registrarArticulo({ nombre: 'Silla plegable blanca', descripcion: 'Silla para eventos sociales con piezas intercambiables.', categoria: 'Sillas', fotografias: ['docs/imagenes/silla.svg'], precioDiaCentavos: 1500, cargoDanoCentavos: 15000, valorReposicionCentavos: 45000, totalPiezas: 100, activo: true });
  const mesas = await servicio.registrarArticulo({ nombre: 'Mesa rectangular', descripcion: 'Mesa para seis personas.', categoria: 'Mesas', fotografias: ['docs/imagenes/mesa.svg'], precioDiaCentavos: 10000, cargoDanoCentavos: 30000, valorReposicionCentavos: 180000, totalPiezas: 20, activo: true });
  return { admin, cliente, sillas, mesas };
}
