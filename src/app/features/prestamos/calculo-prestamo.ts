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

/** "2026-11-21" + 31 → "2026-12-22" (en UTC: sin saltos por horario de verano). */
export function sumarDias(iso: string, dias: number): string {
  const fecha = new Date(`${iso}T00:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

const DIA_PRIMER_CORTE = 15;
const DIA_SEGUNDO_CORTE = 30;

/** Fecha `yyyy-MM-dd` del día `dia` del mes `mes0` (0 = enero; puede pasar de 11 y cambia de año). */
function fechaDelMes(anio: number, mes0: number, dia: number): string {
  return new Date(Date.UTC(anio, mes0, dia)).toISOString().slice(0, 10);
}

/** El 30 del mes, o su último día si el mes es más corto (febrero). `mes0` puede pasar de 11. */
function segundoCorte(anio: number, mes0: number): string {
  const ultimoDia = new Date(Date.UTC(anio, mes0 + 1, 0)).getUTCDate();
  return fechaDelMes(anio, mes0, Math.min(DIA_SEGUNDO_CORTE, ultimoDia));
}

/**
 * Si el primer pago puede caer en esa fecha. Semanal: cualquier día. Quincenal: solo en un corte,
 * el 15 o el 30 (en febrero, el último día). Igual que el back (Periodicidad.esFechaDeInicio).
 */
export function esFechaDeInicio(iso: string, p: Periodicidad): boolean {
  if (p.id === 'semanal') return true;
  const [anio = 0, mes = 1, dia = 0] = iso.split('-').map(Number);
  return dia === DIA_PRIMER_CORTE || iso === segundoCorte(anio, mes - 1);
}

/**
 * Fecha del pago número `indice` (0 = primer pago), calculada siempre desde el primero. Semanal:
 * cada 7 días. Quincenal: alterna el 15 y el 30 de cada mes (en febrero, el último día). Igual que
 * el back (Periodicidad.fechaDePago).
 */
export function fechaDePago(inicioIso: string, p: Periodicidad, indice: number): string {
  if (p.id === 'semanal') return sumarDias(inicioIso, p.dias * indice);
  const [anio = 0, mes = 1, dia = 0] = inicioIso.split('-').map(Number);
  const posicion = (dia === DIA_PRIMER_CORTE ? 0 : 1) + indice;
  const mes0 = mes - 1 + Math.floor(posicion / 2);
  return posicion % 2 === 0
    ? fechaDelMes(anio, mes0, DIA_PRIMER_CORTE)
    : segundoCorte(anio, mes0);
}

/** Cortes quincenales (15 y 30 / fin de febrero) entre dos fechas, ambas incluidas. */
export function cortesQuincenales(desde: string, hasta: string): string[] {
  const [anio = 0, mes = 1] = desde.split('-').map(Number);
  const cortes: string[] = [];
  for (let mes0 = mes - 1; ; mes0++) {
    const primero = fechaDelMes(anio, mes0, DIA_PRIMER_CORTE);
    if (primero > hasta) break;
    const segundo = segundoCorte(anio, mes0);
    for (const corte of [primero, segundo]) {
      if (corte >= desde && corte <= hasta) cortes.push(corte);
    }
  }
  return cortes;
}

/**
 * Hasta cuántos días después de hoy puede caer el primer pago de un préstamo o convenio. Igual que
 * el back (ReglaPrimerPago.MAXIMO_DIAS): una fecha lejana casi siempre es error de captura.
 */
export const MAXIMO_DIAS_PRIMER_PAGO = 31;

/** Último día que se puede elegir como primer pago. */
export function fechaMaximaPrimerPago(hoy: string): string {
  return sumarDias(hoy, MAXIMO_DIAS_PRIMER_PAGO);
}

/** Fechas que se ofrecen como primer pago quincenal: los cortes de hoy al tope. */
export function cortesPrimerPago(hoy: string): string[] {
  return cortesQuincenales(hoy, fechaMaximaPrimerPago(hoy));
}

/** Por qué no sirve la fecha del primer pago ('' si sirve). `marcarVacia`: ya se intentó enviar. */
export function errorFechaPrimerPago(
  fecha: string,
  hoy: string,
  p: Periodicidad,
  marcarVacia: boolean,
): string {
  if (!fecha) return marcarVacia ? 'Elige la fecha del primer pago.' : '';
  if (fecha < hoy) return 'La fecha no puede ser anterior a hoy.';
  if (fecha > fechaMaximaPrimerPago(hoy)) {
    return `La fecha no puede ser más de ${String(MAXIMO_DIAS_PRIMER_PAGO)} días después de hoy.`;
  }
  if (!esFechaDeInicio(fecha, p)) {
    return 'En pagos quincenales el primer pago debe ser el día 15 o el 30 (en febrero, el último día).';
  }
  return '';
}

export function textoMeses(meses: number): string {
  return meses === 1 ? '1 mes' : `${String(meses)} meses`;
}

/** 12 → "12%", 12.5 → "12.5%". */
export function textoPorcentaje(valor: number): string {
  return `${String(Math.round(valor * 100) / 100)}%`;
}
