import { HttpClient, HttpHeaders, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import { recursoApi } from '@/core/api/recurso-api';
import type {
  ConsultaConvenios,
  Convenio,
  ConvenioDetalle,
  PaginaConvenios,
  PeticionConvenio,
  PeticionSimulacion,
  SimulacionConvenio,
} from '@/features/convenios/convenio-api';

const BASE = '/operaciones-convenios';
const ENCABEZADO_LLAVE = 'Idempotency-Key';

/** Convenios conectados a `/api/operaciones-convenios/*` (docs/API-CONVENIOS.md). */
@Injectable({ providedIn: 'root' })
export class ConveniosService {
  private readonly http = inject(HttpClient);

  /**
   * Lista paginada que se vuelve a pedir sola cuando cambia `consulta` (y cancela la anterior).
   * Crear en un contexto de inyección (campo del componente).
   */
  lista(consulta: Signal<ConsultaConvenios>): HttpResourceRef<PaginaConvenios | undefined> {
    return recursoApi<PaginaConvenios>(() => {
      const c = consulta();
      const params: Record<string, string | number> = {
        filtro: c.filtro,
        orden: c.orden,
        direccion: c.direccion,
        pagina: c.pagina,
        tamano: c.tamano,
      };
      if (c.busqueda.trim()) params['busqueda'] = c.busqueda.trim();
      return { url: apiUrl(`${BASE}/convenios`), params };
    });
  }

  /** Detalle de un convenio; sin id no pide nada. */
  detalle(idConvenio: Signal<number | undefined>): HttpResourceRef<ConvenioDetalle | undefined> {
    return recursoApi<ConvenioDetalle>(() => {
      const id = idConvenio();
      return id === undefined ? undefined : apiUrl(`${BASE}/convenios/${String(id)}`);
    });
  }

  /**
   * Plan del convenio calculado por el back; se vuelve a pedir solo cuando cambia `peticion` (y
   * cancela la anterior). Sin petición no pide nada. Crear en un contexto de inyección.
   */
  simulacion(
    peticion: Signal<PeticionSimulacion | undefined>,
  ): HttpResourceRef<SimulacionConvenio | undefined> {
    return recursoApi<SimulacionConvenio>(() => {
      const p = peticion();
      return p ? { url: apiUrl(`${BASE}/simular`), method: 'POST', body: p } : undefined;
    });
  }

  /**
   * `llave` va en `Idempotency-Key`: se repite si se reintenta, para que un doble clic o una
   * respuesta perdida no generen el convenio dos veces.
   */
  async generar(peticion: PeticionConvenio, llave: string): Promise<Convenio> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<Convenio>>(apiUrl(`${BASE}/convenio-generar`), peticion, {
        headers: new HttpHeaders({ [ENCABEZADO_LLAVE]: llave }),
      }),
    );
    return respuesta.objetoResponse;
  }

  /** Cancela un convenio vigente sin pagos; devuelve su detalle ya cancelado. */
  async cancelar(idConvenio: number, motivo: string): Promise<ConvenioDetalle> {
    const respuesta = await firstValueFrom(
      this.http.put<RespuestaApi<ConvenioDetalle>>(
        apiUrl(`${BASE}/convenio-cancelar/${String(idConvenio)}`),
        { motivo },
      ),
    );
    return respuesta.objetoResponse;
  }
}
