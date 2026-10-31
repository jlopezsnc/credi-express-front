import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import type { ReporteCartera, ReporteCobranza } from '@/features/reportes/reportes-api';

const BASE = '/operaciones-reportes';

/** Consultas de la pantalla de reportes. El estado vive en el componente: cada consulta es nueva. */
@Injectable({ providedIn: 'root' })
export class ReportesService {
  private readonly http = inject(HttpClient);

  /** `desde` y `hasta` en `yyyy-MM-dd`, ambos incluidos (máximo 92 días). */
  async cobranza(desde: string, hasta: string): Promise<ReporteCobranza> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<ReporteCobranza>>(apiUrl(`${BASE}/cobranza`), {
        params: new HttpParams({ fromObject: { desde, hasta } }),
      }),
    );
    return respuesta.objetoResponse;
  }

  async cartera(): Promise<ReporteCartera> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<ReporteCartera>>(apiUrl(`${BASE}/cartera`)),
    );
    return respuesta.objetoResponse;
  }
}
