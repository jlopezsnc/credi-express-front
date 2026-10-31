/*
 * Presentación del Inicio: textos de las variaciones, el mes y la geometría de la gráfica semanal.
 * Sin Angular, para probarla sola. No calcula cifras de negocio: solo las acomoda para dibujarlas.
 */
import { formatearMoneda } from '@/core/format';
import { trazoColumna } from '@/features/reportes/reportes-vista';
import type { SemanaInicio } from '@/features/inicio/inicio-api';

const formatoMes = new Intl.DateTimeFormat('es-MX', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});
const formatoNombreMes = new Intl.DateTimeFormat('es-MX', { month: 'long', timeZone: 'UTC' });

function fechaDeMes(mes: string): Date {
  return new Date(`${mes}-01T00:00:00Z`);
}

/** "2026-10" → "Octubre 2026". */
export function etiquetaMes(mes: string): string {
  const texto = formatoMes.format(fechaDeMes(mes)).replace(' de ', ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** "2026-10" → "octubre". */
export function nombreMes(mes: string): string {
  return formatoNombreMes.format(fechaDeMes(mes));
}

/** "2026-10", -1 → "2026-09". */
export function moverMes(mes: string, meses: number): string {
  const fecha = fechaDeMes(mes);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  return fecha.toISOString().slice(0, 7);
}

export interface Variacion {
  texto: string;
  /** `bien` / `mal` según convenga que suba o baje; `neutra` si no hay juicio que hacer. */
  tono: 'bien' | 'mal' | 'neutra';
}

/**
 * Texto de la variación que calcula el back ("12.5", "-7.8" o `null`). El color dice si es buena o
 * mala noticia, pero el texto siempre lo dice también (no se depende solo del color).
 */
export function variacion(
  valor: string | null,
  mesAnterior: string,
  conviene: 'subir' | 'bajar' | 'nada',
): Variacion {
  if (valor === null) return { texto: `Sin base en ${mesAnterior}`, tono: 'neutra' };
  const numero = Number(valor);
  if (numero === 0) return { texto: `= igual que ${mesAnterior}`, tono: 'neutra' };
  const sube = numero > 0;
  const texto = `${sube ? '▲' : '▼'} ${String(Math.abs(numero))}% vs ${mesAnterior}`;
  if (conviene === 'nada') return { texto, tono: 'neutra' };
  return { texto, tono: sube === (conviene === 'subir') ? 'bien' : 'mal' };
}

/** Lienzo de la gráfica semanal (unidades del `viewBox`; escala con el ancho). */
export const LIENZO_SEMANAS = {
  ancho: 640,
  alto: 240,
  izquierda: 52,
  derecha: 8,
  arriba: 12,
  abajo: 28,
} as const;

const GROSOR_MAXIMO = 30;
const SEPARACION = 2;
const PASOS = 4;

export interface GraficaSemanas {
  ticks: { y: number; texto: string }[];
  grupos: {
    etiqueta: string;
    zona: { x: number; ancho: number };
    centro: number;
    esperado: string;
    aplicado: string;
  }[];
}

/** Escala "bonita": el tope redondeado hacia arriba a 1, 2 o 5 por potencia de 10. */
function tope(maximo: number): number {
  if (maximo <= 0) return 1;
  const base = 10 ** Math.floor(Math.log10(maximo / PASOS));
  const paso = [1, 2, 5, 10].map((m) => m * base).find((p) => p * PASOS >= maximo) ?? base * 10;
  return paso * PASOS;
}

function pesosCortos(valor: number): string {
  if (valor === 0) return '$0';
  return valor >= 1000 ? `$${String(Math.round(valor / 100) / 10)}k` : `$${String(valor)}`;
}

/**
 * Barras agrupadas (esperado | aplicado) por semana, en una sola escala, con 2 de separación entre
 * las dos barras y la punta redondeada.
 */
export function graficaSemanas(semanas: readonly SemanaInicio[]): GraficaSemanas {
  const l = LIENZO_SEMANAS;
  const base = l.alto - l.abajo;
  const altoUtil = base - l.arriba;
  const anchoUtil = l.ancho - l.izquierda - l.derecha;
  const maximo = Math.max(0, ...semanas.flatMap((s) => [Number(s.esperado), Number(s.aplicado)]));
  const escala = tope(maximo);
  const zona = anchoUtil / Math.max(1, semanas.length);
  const grueso = Math.min(GROSOR_MAXIMO, (zona - SEPARACION) / 3);
  const alto = (valor: number) => (valor / escala) * altoUtil;

  const ticks = Array.from({ length: PASOS + 1 }, (_, i) => {
    const valor = (escala / PASOS) * i;
    return { y: base - alto(valor), texto: pesosCortos(valor) };
  });
  const grupos = semanas.map((s, i) => {
    const centro = l.izquierda + zona * i + zona / 2;
    const desde = Number(s.desde.slice(8, 10));
    const hasta = Number(s.hasta.slice(8, 10));
    return {
      etiqueta: `${String(desde)}–${String(hasta)}`,
      zona: { x: l.izquierda + zona * i, ancho: zona },
      centro,
      esperado: trazoColumna(
        centro - grueso - SEPARACION / 2,
        base,
        grueso,
        alto(Number(s.esperado)),
      ),
      aplicado: trazoColumna(centro + SEPARACION / 2, base, grueso, alto(Number(s.aplicado))),
    };
  });
  return { ticks, grupos };
}

/** Una semana como la muestran el globo y la tabla. */
export function detalleSemana(s: SemanaInicio, mes: string) {
  return {
    titulo: `Del ${String(Number(s.desde.slice(8, 10)))} al ${String(Number(s.hasta.slice(8, 10)))} de ${nombreMes(mes)}`,
    esperado: formatearMoneda(s.esperado),
    aplicado: formatearMoneda(s.aplicado),
    cumplimiento: s.cumplimiento === null ? '—' : `${s.cumplimiento}%`,
  };
}
