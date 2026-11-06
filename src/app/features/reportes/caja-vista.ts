/*
 * Cálculos de presentación del saldo de caja: nombres de mes, validación del formulario y la
 * geometría de la gráfica. Las sumas y el saldo los calcula el back.
 */
import type { MesCaja } from '@/features/reportes/caja-api';

const formatoMes = new Intl.DateTimeFormat('es-MX', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatoMesCorto = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

function fechaDeMes(mes: string): Date {
  return new Date(`${mes}-01T00:00:00Z`);
}

/** "2026-10" → "oct 2026". */
export function nombreMes(mes: string): string {
  return formatoMes.format(fechaDeMes(mes)).replace('.', '');
}

/** "2026-10" → "oct". */
export function mesCorto(mes: string): string {
  return formatoMesCorto.format(fechaDeMes(mes)).replace('.', '');
}

export const CONCEPTO_MINIMO = 3;
export const CONCEPTO_MAXIMO = 200;
export const MOTIVO_MINIMO = 5;
export const MOTIVO_MAXIMO = 200;

/** "50,000" o "1234.5" → "50000" / "1234.5"; `undefined` si no es un importe válido mayor a cero. */
export function importeValido(texto: string): string | undefined {
  const limpio = texto.replace(/[$,\s]/g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(limpio)) return undefined;
  return Number(limpio) > 0 ? limpio : undefined;
}

export interface ErroresMovimiento {
  importe?: string;
  fecha?: string;
  concepto?: string;
}

export function validarMovimiento(
  datos: { importe: string; fecha: string; concepto: string },
  hoy: string,
): ErroresMovimiento {
  const errores: ErroresMovimiento = {};
  if (!importeValido(datos.importe))
    errores.importe = 'Captura un importe mayor a cero, con hasta dos decimales.';
  if (!datos.fecha) errores.fecha = 'Elige la fecha.';
  else if (datos.fecha > hoy) errores.fecha = 'La fecha no puede ser posterior a hoy.';
  const concepto = datos.concepto.trim().length;
  if (concepto < CONCEPTO_MINIMO || concepto > CONCEPTO_MAXIMO)
    errores.concepto = `Escribe el concepto (de ${String(CONCEPTO_MINIMO)} a ${String(CONCEPTO_MAXIMO)} caracteres).`;
  return errores;
}

/** Lienzo de la gráfica (viewBox). */
export const LIENZO_CAJA = {
  ancho: 640,
  alto: 220,
  izquierda: 48,
  derecha: 12,
  arriba: 14,
  abajo: 28,
};

export interface GraficaCaja {
  marcas: { y: number; etiqueta: string }[];
  columnas: {
    mes: string;
    etiqueta: string;
    cobrado: { x: number; y: number; alto: number };
    prestado: { x: number; y: number; alto: number };
    ancho: number;
    detalle: string;
  }[];
  linea: string;
  ultimo: { x: number; y: number; etiqueta: string } | undefined;
}

/** "$45k", "−$3k", "$800". */
export function montoCorto(valor: number): string {
  const signo = valor < 0 ? '−' : '';
  const absoluto = Math.abs(valor);
  return absoluto >= 1000
    ? `${signo}$${String(Math.round(absoluto / 1000))}k`
    : `${signo}$${String(Math.round(absoluto))}`;
}

/** Paso de la escala: 1, 2 o 5 × 10ⁿ, para unas 4 líneas. */
function paso(rango: number): number {
  const crudo = rango / 4;
  const potencia = 10 ** Math.floor(Math.log10(crudo));
  const base = crudo / potencia;
  return (base <= 1 ? 1 : base <= 2 ? 2 : base <= 5 ? 5 : 10) * potencia;
}

/** Barras de cobrado y prestado por mes, y la línea del saldo acumulado, en una sola escala. */
export function graficaCaja(
  meses: readonly MesCaja[],
  detalle: (m: MesCaja) => string,
): GraficaCaja {
  const { ancho, alto, izquierda, derecha, arriba, abajo } = LIENZO_CAJA;
  const datos = meses.map((m) => ({
    m,
    cobrado: Number(m.cobrado),
    prestado: Number(m.prestado),
    acumulado: Number(m.acumulado),
  }));
  const maximo = Math.max(1, ...datos.flatMap((d) => [d.cobrado, d.prestado, d.acumulado]));
  const minimo = Math.min(0, ...datos.map((d) => d.acumulado));
  const p = paso(maximo - minimo);
  const tope = Math.ceil(maximo / p) * p;
  const piso = Math.floor(minimo / p) * p;
  const y = (v: number): number =>
    arriba + (alto - arriba - abajo) * (1 - (v - piso) / (tope - piso));
  const marcas = [];
  for (let v = piso; v <= tope + p / 2; v += p) marcas.push({ y: y(v), etiqueta: montoCorto(v) });

  const espacio = (ancho - izquierda - derecha) / Math.max(1, datos.length);
  const grueso = Math.max(2, Math.min(14, espacio * 0.32));
  const cero = y(0);
  const barra = (centro: number, valor: number) => ({
    x: centro,
    y: Math.min(y(valor), cero),
    alto: Math.abs(cero - y(valor)),
  });
  const columnas = datos.map((d, i) => {
    const centro = izquierda + espacio * i + espacio / 2;
    return {
      mes: d.m.mes,
      etiqueta:
        datos.length <= 12 || i % Math.ceil(datos.length / 12) === 0 ? mesCorto(d.m.mes) : '',
      cobrado: barra(centro - grueso - 1, d.cobrado),
      prestado: barra(centro + 1, d.prestado),
      ancho: grueso,
      detalle: detalle(d.m),
    };
  });
  const puntos = datos.map((d, i) => ({
    x: izquierda + espacio * i + espacio / 2,
    y: y(d.acumulado),
  }));
  const fin = puntos[puntos.length - 1];
  const ultimoDato = datos[datos.length - 1];
  return {
    marcas,
    columnas,
    linea: puntos.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' '),
    ultimo:
      fin && ultimoDato
        ? { x: fin.x, y: fin.y, etiqueta: montoCorto(ultimoDato.acumulado) }
        : undefined,
  };
}
