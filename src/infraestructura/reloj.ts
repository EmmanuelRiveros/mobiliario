import type { Reloj, GeneradorId } from '../dominio/puertos.js';
import { randomUUID } from 'node:crypto';
export class RelojSistema implements Reloj {
  ahora(): string { return new Date().toISOString(); }
  hoy(): string { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Hermosillo' }).format(new Date()); }
}
export class IdentificadoresUuid implements GeneradorId {
  siguiente(prefijo: string): string { return `${prefijo}-${randomUUID()}`; }
}
