/*
 * Reglas de captura del diálogo "Registrar pago" / "Liquidar préstamo". Son las mismas que valida
 * el back (docs/API-COBRANZA.md §3.3); aquí solo sirven para avisar antes de enviar.
 * Los importes se manejan en centavos (enteros).
 */
import { aDecimal } from '@/features/prestamos/calculo-prestamo';
import type {
  MetodoPago,
  PeticionLiquidacion,
  PeticionPago,
} from '@/features/cobranza/cobranza-api';

export const DIAS_ATRAS_MAXIMO = 30;
export const REFERENCIA_MAXIMO = 50;
export const NOTA_MAXIMO = 200;

const formatoImporte = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Lee lo que se tecleó en un campo de importe: "1110", "1110.5" o "1,110.50" (las comas solo como
 * separador de miles). Devuelve centavos, o `NaN` si no es un importe válido.
 */
export function leerImporte(texto: string): number {
  const limpio = texto.replace(/[\s$]/g, '');
  if (!/^(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/.test(limpio)) return NaN;
  return Math.round(Number(limpio.replace(/,/g, '')) * 100);
}

/** Cómo se ve el importe en el campo al salir de él: 111000 → "1,110.00". */
export function textoImporte(centavos: number): string {
  return formatoImporte.format(centavos / 100);
}

/** Dinero del back ("710.00") a centavos. */
export function centavos(decimal: string): number {
  const valor = Number(decimal);
  return Number.isFinite(valor) ? Math.round(valor * 100) : 0;
}

/** Lo capturado en el diálogo, tal cual. */
export interface CapturaPago {
  importe: string;
  recargo: string;
  metodo: MetodoPago;
  referencia: string;
  fecha: string;
  nota: string;
}

export function capturaInicial(importeCent: number, hoy: string): CapturaPago {
  return {
    importe: importeCent > 0 ? textoImporte(importeCent) : '',
    recargo: '',
    metodo: 'EFECTIVO',
    referencia: '',
    fecha: hoy,
    nota: '',
  };
}

export function errorImporte(texto: string, saldoCent: number): string {
  if (texto.trim() === '') return 'Captura el importe recibido.';
  const importe = leerImporte(texto);
  if (Number.isNaN(importe)) return 'Captura un importe válido, por ejemplo 1,110.00.';
  if (importe <= 0) return 'El importe debe ser mayor a cero.';
  if (importe > saldoCent) return 'No puede ser mayor al saldo de la cuota.';
  return '';
}

/** El recargo es opcional: vacío vale cero. */
export function recargoCent(texto: string): number {
  return texto.trim() === '' ? 0 : leerImporte(texto);
}

export function errorRecargo(texto: string): string {
  return Number.isNaN(recargoCent(texto)) ? 'Captura un recargo válido, por ejemplo 50.00.' : '';
}

export function pideReferencia(metodo: MetodoPago): boolean {
  return metodo !== 'EFECTIVO';
}

export function errorReferencia(metodo: MetodoPago, referencia: string): string {
  return pideReferencia(metodo) && referencia.trim() === ''
    ? 'Captura la referencia del pago.'
    : '';
}

/** `hoy` en `yyyy-MM-dd`. Se permite hoy y hasta 30 días antes, igual que en el back. */
export function errorFecha(fecha: string, hoy: string): string {
  if (!fecha) return 'Elige la fecha del pago.';
  if (fecha > hoy) return 'La fecha no puede ser posterior a hoy.';
  if (fecha < restarDias(hoy, DIAS_ATRAS_MAXIMO)) {
    return `Solo se pueden registrar pagos de los últimos ${String(DIAS_ATRAS_MAXIMO)} días.`;
  }
  return '';
}

export function restarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() - dias);
  return fecha.toISOString().slice(0, 10);
}

/** Días de `desde` a `hasta` (ambas `yyyy-MM-dd`). */
export function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** Lo común a las dos peticiones; el recargo solo se envía si se admite. */
function datosComunes(c: CapturaPago, admiteRecargo: boolean) {
  const recargo = admiteRecargo ? recargoCent(c.recargo) : 0;
  return {
    recargo: aDecimal(Number.isNaN(recargo) ? 0 : recargo),
    fechaPago: c.fecha,
    metodoPago: c.metodo,
    referencia: pideReferencia(c.metodo) ? c.referencia.trim() : null,
    nota: c.nota.trim() || null,
  };
}

export function peticionPago(
  idCuota: number,
  c: CapturaPago,
  admiteRecargo: boolean,
): PeticionPago {
  return { idCuota, importe: aDecimal(leerImporte(c.importe)), ...datosComunes(c, admiteRecargo) };
}

/** En una liquidación el importe no se captura: es el saldo total del préstamo. */
export function peticionLiquidacion(
  idPrestamo: number,
  saldoTotal: string,
  c: CapturaPago,
  admiteRecargo: boolean,
): PeticionLiquidacion {
  return { idPrestamo, importe: saldoTotal, ...datosComunes(c, admiteRecargo) };
}

/**
 * Identificador de la operación para el encabezado `Idempotency-Key`. `randomUUID` solo existe en
 * contextos seguros (https o localhost); en la red local por http se arma con `getRandomValues`.
 */
export function nuevaLlave(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] ?? 0) & 0x0f) | 0x40;
  b[8] = ((b[8] ?? 0) & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
