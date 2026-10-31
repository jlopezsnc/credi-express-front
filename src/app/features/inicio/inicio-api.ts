/*
 * Tipos de `GET /operaciones-inicio/resumen` (docs/API-INICIO.md). Todo lo calcula el back con las
 * mismas reglas de Cobranza y Reportes; el dinero llega como texto decimal ("109600.00").
 */
import type { ResumenCobranza } from '@/features/cobranza/cobranza-api';
import type { ReporteCartera } from '@/features/reportes/reportes-api';

export interface SemanaInicio {
  numero: number;
  desde: string;
  hasta: string;
  esperado: string;
  aplicado: string;
  /** Aplicado entre esperado, con un decimal; `null` si esa semana no vencía nada. */
  cumplimiento: string | null;
}

export interface ResumenMes {
  /** `AAAA-MM`. */
  mes: string;
  desde: string;
  /** Hasta qué día cuentan las cifras: hoy en el mes en curso, el último día en uno cerrado. */
  corte: string;
  /** Lo que entró en caja (importe + recargo). */
  cobrado: string;
  /** Lo que se aplicó a cuotas (sin recargos). */
  aplicado: string;
  esperado: string;
  esperadoALaFecha: string;
  /** Aplicado entre esperado a la fecha, con un decimal; `null` si no se esperaba nada. */
  cumplimiento: string | null;
  otorgados: number;
  colocado: string;
  liquidados: number;
  convenios: number;
  convenido: string;
  semanas: SemanaInicio[];
}

export interface Inicio {
  mes: string;
  enCurso: boolean;
  resumen: ResumenMes;
  anterior: ResumenMes;
  /** Contra el mes anterior, en %; `null` si el anterior fue 0. */
  variaciones: { cobrado: string | null; otorgados: string | null; convenios: string | null };
  hoy: {
    fecha: string;
    cartera: string;
    vencido: string;
    porcentajeVencido: string;
    prestamosActivos: number;
    clientesConAtraso: number;
    proximos7Dias: ResumenCobranza['porCobrarHoy'];
    requierenAtencion: ReporteCartera['clientesConAtraso'];
  };
}
