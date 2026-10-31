import { HttpClient, type HttpResourceRef } from '@angular/common/http';
import { inject, Injectable, type Signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import { recursoApi } from '@/core/api/recurso-api';
import type {
  ConsultaPrestamos,
  PaginaPrestamos,
  PrestamoDetalle,
} from '@/features/prestamos/prestamo';

const BASE = '/operaciones-prestamos';

/**
 * Cuerpo de `POST /operaciones-prestamos/calcular-pagos` (docs/API-PRESTAMOS.md).
 * El back recibe todos los valores como texto.
 */
export interface PeticionPrestamo {
  idCliente: string;
  idModalidad: string;
  numeroCuota: string;
  importeCuota: string;
  fechaGeneracionOperacion: string;
  fechaInicioCredito: string;
  importeCredito: string;
  tasaInteres: string;
  totalPagar: string;
  interesGenerado: string;
  // PENDIENTE: estos cuatro debe asignarlos el back; se envían con valores fijos mientras tanto.
  estadoPago: string;
  diasMoratorios: string;
  alerta: string;
  idCalculadoraPrestamo: string;
}

export interface PrestamoGenerado {
  plazosGenerados: number;
  resultado: string;
}

@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private readonly http = inject(HttpClient);

  /**
   * Lista paginada que se vuelve a pedir sola cuando cambia `consulta` (y cancela la anterior).
   * Crear en un contexto de inyección (campo del componente).
   */
  lista(
    consulta: Signal<ConsultaPrestamos | undefined>,
  ): HttpResourceRef<PaginaPrestamos | undefined> {
    return recursoApi<PaginaPrestamos>(() => {
      const c = consulta();
      if (!c) return undefined;
      const params: Record<string, string | number> = {
        filtro: c.filtro,
        orden: c.orden,
        direccion: c.direccion,
        pagina: c.pagina,
        tamano: c.tamano,
      };
      if (c.busqueda.trim()) params['busqueda'] = c.busqueda.trim();
      if (c.idCliente !== undefined) params['idCliente'] = c.idCliente;
      return { url: apiUrl(`${BASE}/prestamos`), params };
    });
  }

  /** Calendario de un préstamo; sin id no pide nada. */
  detalle(idPrestamo: Signal<number | undefined>): HttpResourceRef<PrestamoDetalle | undefined> {
    return recursoApi<PrestamoDetalle>(() => {
      const id = idPrestamo();
      return id === undefined ? undefined : apiUrl(`${BASE}/prestamos/${String(id)}`);
    });
  }

  /** Genera el préstamo y su calendario de pagos. Devuelve el mensaje del back. */
  async generar(peticion: PeticionPrestamo): Promise<RespuestaApi<PrestamoGenerado>> {
    return firstValueFrom(
      this.http.post<RespuestaApi<PrestamoGenerado>>(apiUrl(`${BASE}/calcular-pagos`), peticion),
    );
  }
}
