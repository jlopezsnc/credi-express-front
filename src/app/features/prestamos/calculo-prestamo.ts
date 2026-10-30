/*
 * Cálculo del préstamo que se muestra en pantalla mientras se captura.
 *
 * PENDIENTE (docs/PENDIENTES.md): el back debe repetir este cálculo al generar el préstamo y no
 * confiar en los montos que envía el front. Mientras tanto la regla vive aquí; es la única
 * excepción a "el front no hace cálculos con dinero".
 *
 * Regla acordada:
 * 1. Plazo en meses = número de pagos / pagos por mes (12 semanas = 3 meses; 8 quincenas = 4 meses).
 * 2. Interés = monto × interés mensual × plazo en meses.
 * 3. Total a pagar = monto + interés.
 * 4. Cuota = total / número de pagos; el último pago absorbe el ajuste de centavos.
 *
 * Todo se calcula en centavos (enteros) para no perder precisión.
 */

export type IdPeriodicidad = 'semanal' | 'quincenal';

export interface Periodicidad {
  id: IdPeriodicidad;
  /** Supuesto: 1 = semanal, 2 = quincenal (confirmar con el back). */
  idModalidad: number;
  etiqueta: string;
  unidad: string;
  adjetivo: string;
  /** Días entre un pago y el siguiente. */
  dias: number;
  /** Pagos de esta periodicidad que equivalen a un mes. */
  porMes: number;
  /** Números de pagos permitidos. */
  plazos: readonly number[];
}

export const PERIODICIDADES: readonly Periodicidad[] = [
  {
    id: 'semanal',
    idModalidad: 1,
    etiqueta: 'Semanal',
    unidad: 'semanas',
    adjetivo: 'semanales',
    dias: 7,
    porMes: 4,
    plazos: [12, 16],
  },
  {
    id: 'quincenal',
    idModalidad: 2,
    etiqueta: 'Quincenal',
    unidad: 'quincenas',
    adjetivo: 'quincenales',
    dias: 15,
    porMes: 2,
    plazos: [8, 10, 12, 14],
  },
];

// Límites provisionales (por definir con el negocio).
export const MONTO_MINIMO = 1000;
export const MONTO_MAXIMO = 50000;
export const TASA_INICIAL = '12';
export const TASA_MAXIMA = 100;

export function periodicidad(id: IdPeriodicidad): Periodicidad {
  return PERIODICIDADES.find((p) => p.id === id) ?? (PERIODICIDADES[0] as Periodicidad);
}

/** Lee un número capturado ("6,000.50", "12 %") con hasta dos decimales; `NaN` si no es válido. */
export function leerDecimal(texto: string): number {
  const limpio = texto.replace(/[\s,$%]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(limpio)) return NaN;
  return Number(limpio);
}

export interface DatosCalculo {
  periodicidad: Periodicidad;
  plazos: number;
  /** En pesos. */
  monto: number;
  /** Porcentaje mensual, p. ej. 12. */
  tasaMensual: number;
}

export interface CalculoPrestamo {
  meses: number;
  montoCent: number;
  interesCent: number;
  totalCent: number;
  cuotaCent: number;
  /** Último pago, con el ajuste de centavos. */
  ultimaCent: number;
}

export function calcularPrestamo(datos: DatosCalculo): CalculoPrestamo {
  const meses = datos.plazos / datos.periodicidad.porMes;
  const montoCent = Math.round(datos.monto * 100);
  const interesCent = Math.round(((montoCent * datos.tasaMensual) / 100) * meses);
  const totalCent = montoCent + interesCent;
  const cuotaCent = Math.round(totalCent / datos.plazos);
  const ultimaCent = totalCent - cuotaCent * (datos.plazos - 1);
  return { meses, montoCent, interesCent, totalCent, cuotaCent, ultimaCent };
}

/** Centavos a pesos para mostrar o enviar: 216050 → 2160.5. */
export function aPesos(centavos: number): number {
  return centavos / 100;
}

/** Centavos al decimal en texto que espera el back: 216050 → "2160.50". */
export function aDecimal(centavos: number): string {
  return (centavos / 100).toFixed(2);
}

/** Fecha de hoy en la zona del usuario, como `yyyy-MM-dd`. */
export function hoyIso(ahora = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${String(ahora.getFullYear())}-${mes}-${dia}`;
}

/** Fecha del pago número `indice` (0 = primer pago) a partir de la fecha del primer pago. */
export function fechaDePago(inicioIso: string, p: Periodicidad, indice: number): string {
  const fecha = new Date(`${inicioIso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + p.dias * indice);
  return fecha.toISOString().slice(0, 10);
}

export function textoMeses(meses: number): string {
  return meses === 1 ? '1 mes' : `${String(meses)} meses`;
}

/** 12 → "12%", 12.5 → "12.5%". */
export function textoPorcentaje(valor: number): string {
  return `${String(Math.round(valor * 100) / 100)}%`;
}
