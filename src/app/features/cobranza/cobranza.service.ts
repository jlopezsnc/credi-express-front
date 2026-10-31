import { HttpClient, HttpHeaders, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import { recursoApi } from '@/core/api/recurso-api';
import type {
  CuotaCobranza,
  Liquidacion,
  OperacionPago,
  OrdenCuotas,
  Pago,
  PaginaConTotal,
  PeticionLiquidacion,
  PeticionPago,
  ReciboOperacion,
  ResumenCobranza,
  SaldoPrestamo,
  SituacionCuota,
} from '@/features/cobranza/cobranza-api';

const BASE = '/operaciones-cobranza';
export const DIAS_PROXIMOS = 7;
const ENCABEZADO_LLAVE = 'Idempotency-Key';

/** Una página de cuotas por cobrar. */
export interface ConsultaCuotas {
  situacion: SituacionCuota;
  busqueda: string;
  orden: OrdenCuotas;
  direccion: 'ASC' | 'DESC';
  pagina: number;
  tamano: number;
}

/** Una página de "Cobrado hoy". */
export interface ConsultaOperaciones {
  busqueda: string;
  pagina: number;
  tamano: number;
}

function conBusqueda(params: Record<string, string | number>, busqueda: string) {
  return busqueda.trim() ? { ...params, busqueda: busqueda.trim() } : params;
}

/**
 * Cobranza: todo lo calculado (saldos, situación, días, totales y agrupación por folio) viene del
 * back. Las consultas son recursos que se vuelven a pedir solos cuando cambian sus parámetros;
 * crearlos en un contexto de inyección (campo del componente).
 */
@Injectable({ providedIn: 'root' })
export class CobranzaService {
  private readonly http = inject(HttpClient);

  resumen(): HttpResourceRef<ResumenCobranza | undefined> {
    return recursoApi<ResumenCobranza>(() => ({
      url: apiUrl(`${BASE}/resumen`),
      params: { dias: DIAS_PROXIMOS },
    }));
  }

  /** Sin consulta (`undefined`) no pide nada: la pestaña activa es otra. */
  cuotasPendientes(
    consulta: Signal<ConsultaCuotas | undefined>,
  ): HttpResourceRef<PaginaConTotal<CuotaCobranza> | undefined> {
    return recursoApi<PaginaConTotal<CuotaCobranza>>(() => {
      const c = consulta();
      if (!c) return undefined;
      return {
        url: apiUrl(`${BASE}/cuotas-pendientes`),
        params: conBusqueda(
          {
            situacion: c.situacion,
            dias: DIAS_PROXIMOS,
            orden: c.orden,
            direccion: c.direccion,
            pagina: c.pagina,
            tamano: c.tamano,
          },
          c.busqueda,
        ),
      };
    });
  }

  operaciones(
    consulta: Signal<ConsultaOperaciones | undefined>,
  ): HttpResourceRef<PaginaConTotal<OperacionPago> | undefined> {
    return recursoApi<PaginaConTotal<OperacionPago>>(() => {
      const c = consulta();
      if (!c) return undefined;
      return {
        url: apiUrl(`${BASE}/operaciones`),
        params: conBusqueda({ pagina: c.pagina, tamano: c.tamano }, c.busqueda),
      };
    });
  }

  async saldoPrestamo(idPrestamo: number): Promise<SaldoPrestamo> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<SaldoPrestamo>>(
        apiUrl(`${BASE}/prestamo-saldo/${String(idPrestamo)}`),
      ),
    );
    return respuesta.objetoResponse;
  }

  /** Datos de una operación ya cobrada, para reimprimir su recibo. */
  async recibo(folio: string): Promise<ReciboOperacion> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<ReciboOperacion>>(
        apiUrl(`${BASE}/recibo/${encodeURIComponent(folio)}`),
      ),
    );
    return respuesta.objetoResponse;
  }

  /**
   * `llave` va en `Idempotency-Key`: se genera al abrir el diálogo y se repite si se reintenta, para
   * que un doble clic o una respuesta perdida no registren el pago dos veces.
   */
  async registrarPago(peticion: PeticionPago, llave: string): Promise<Pago> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<Pago>>(apiUrl(`${BASE}/pago-registrar`), peticion, {
        headers: new HttpHeaders({ [ENCABEZADO_LLAVE]: llave }),
      }),
    );
    return respuesta.objetoResponse;
  }

  async liquidarPrestamo(peticion: PeticionLiquidacion, llave: string): Promise<Liquidacion> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<Liquidacion>>(apiUrl(`${BASE}/prestamo-liquidar`), peticion, {
        headers: new HttpHeaders({ [ENCABEZADO_LLAVE]: llave }),
      }),
    );
    return respuesta.objetoResponse;
  }
}
