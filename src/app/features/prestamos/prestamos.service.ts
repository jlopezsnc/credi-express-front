import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import { mensajeDeError } from '@/core/api/api-error';
import { hoyIso } from '@/features/prestamos/calculo-prestamo';
import {
  agruparPrestamos,
  type CuotaRespuesta,
  type Prestamo,
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

interface EstadoLista {
  cargando: boolean;
  error: string | undefined;
  prestamos: Prestamo[];
}

@Injectable({ providedIn: 'root' })
export class PrestamosService {
  private readonly http = inject(HttpClient);
  private readonly estado = signal<EstadoLista>({
    cargando: false,
    error: undefined,
    prestamos: [],
  });

  readonly prestamos = computed(() => this.estado().prestamos);
  readonly cargando = computed(() => this.estado().cargando);
  readonly error = computed(() => this.estado().error);

  async cargar(): Promise<void> {
    this.estado.update((e) => ({ ...e, cargando: true, error: undefined }));
    try {
      // Hoy llega un arreglo suelto; se acepta también el sobre de las demás respuestas.
      const respuesta = await firstValueFrom(
        this.http.get<CuotaRespuesta[] | RespuestaApi<CuotaRespuesta[] | null> | null>(
          apiUrl(`${BASE}/buscar-ep/todo`),
        ),
      );
      const cuotas = Array.isArray(respuesta) ? respuesta : (respuesta?.objetoResponse ?? []);
      this.estado.set({
        cargando: false,
        error: undefined,
        prestamos: agruparPrestamos(cuotas, hoyIso()),
      });
    } catch (error) {
      this.estado.update((e) => ({
        ...e,
        cargando: false,
        error: mensajeDeError(error, 'No se pudo cargar la lista de préstamos.'),
      }));
    }
  }

  /** Genera el préstamo y su calendario de pagos. Devuelve el mensaje del back. */
  async generar(peticion: PeticionPrestamo): Promise<RespuestaApi<PrestamoGenerado>> {
    return firstValueFrom(
      this.http.post<RespuestaApi<PrestamoGenerado>>(apiUrl(`${BASE}/calcular-pagos`), peticion),
    );
  }
}
