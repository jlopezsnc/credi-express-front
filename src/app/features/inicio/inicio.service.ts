import type { HttpResourceRef } from '@angular/common/http';
import { Injectable, type Signal } from '@angular/core';
import { apiUrl } from '@/core/api/api';
import { recursoApi } from '@/core/api/recurso-api';
import type { Inicio } from '@/features/inicio/inicio-api';

/** Resumen de Inicio conectado a `/api/operaciones-inicio/resumen` (docs/API-INICIO.md). */
@Injectable({ providedIn: 'root' })
export class InicioService {
  /**
   * Se vuelve a pedir solo cuando cambia `mes` (`AAAA-MM`; sin él, el mes actual). Crear en un
   * contexto de inyección (campo del componente).
   */
  resumen(mes: Signal<string | undefined>): HttpResourceRef<Inicio | undefined> {
    return recursoApi<Inicio>(() => {
      const m = mes();
      return m
        ? { url: apiUrl('/operaciones-inicio/resumen'), params: { mes: m } }
        : apiUrl('/operaciones-inicio/resumen');
    });
  }
}
