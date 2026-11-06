import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import type {
  MovimientoCaja,
  NuevoMovimientoCaja,
  PaginaMovimientos,
  SaldoCaja,
} from '@/features/reportes/caja-api';

const BASE = '/operaciones-caja';

/** Saldo de caja, aportaciones y retiros (docs/API-CAJA.md). */
@Injectable({ providedIn: 'root' })
export class CajaService {
  private readonly http = inject(HttpClient);

  /** `anio` `null` = toda la historia. */
  async saldo(anio: number | null): Promise<SaldoCaja> {
    const params = anio === null ? undefined : new HttpParams().set('anio', String(anio));
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<SaldoCaja>>(apiUrl(`${BASE}/saldo`), { params }),
    );
    return respuesta.objetoResponse;
  }

  async movimientos(pagina: number, tamano: number): Promise<PaginaMovimientos> {
    const respuesta = await firstValueFrom(
      this.http.get<RespuestaApi<PaginaMovimientos>>(apiUrl(`${BASE}/movimientos`), {
        params: new HttpParams().set('pagina', String(pagina)).set('tamano', String(tamano)),
      }),
    );
    return respuesta.objetoResponse;
  }

  async registrar(movimiento: NuevoMovimientoCaja): Promise<MovimientoCaja> {
    const respuesta = await firstValueFrom(
      this.http.post<RespuestaApi<MovimientoCaja>>(
        apiUrl(`${BASE}/movimiento-registrar`),
        movimiento,
      ),
    );
    return respuesta.objetoResponse;
  }

  async cancelar(idMovimiento: number, motivo: string): Promise<MovimientoCaja> {
    const respuesta = await firstValueFrom(
      this.http.put<RespuestaApi<MovimientoCaja>>(
        apiUrl(`${BASE}/movimiento-cancelar/${String(idMovimiento)}`),
        { motivo },
      ),
    );
    return respuesta.objetoResponse;
  }
}
