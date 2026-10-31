import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { apiUrl, type RespuestaApi } from '@/core/api/api';
import { mensajeDeError } from '@/core/api/api-error';
import type { Cliente, DatosCliente } from '@/features/clientes/cliente';

const BASE = '/operaciones-cliente';

/** Valores de `estatusCliente` acordados con el back (docs/API-CLIENTES.md). */
export type EstatusCliente = 'ACTIVO' | 'INACTIVO';

/** Cliente tal como llega dentro de `objetoResponse` (contrato en docs/API-CLIENTES.md). */
export interface ClienteRespuesta {
  idCliente: number;
  nombreCompleto: string;
  /** Null en los clientes migrados del Excel sin CURP. */
  curp: string | null;
  telefono: string | null;
  correoElectronico: string | null;
  domicilioCalle: string | null;
  domicilioColonia: string | null;
  domicilioCiudad: string | null;
  /** Pendiente en el back: mientras no llegue, el cliente se toma como activo. */
  estatusCliente?: EstatusCliente | null;
  /** Propuesta a futuro: resumen de préstamos para las columnas y filtros de la lista. */
  prestamosActivos?: number | null;
  saldoPendiente?: string | null;
  conAtraso?: boolean | null;
}

/** Único lugar que traduce la respuesta del back al modelo de la pantalla. */
export function aCliente(r: ClienteRespuesta): Cliente {
  return {
    id: r.idCliente,
    nombreCompleto: r.nombreCompleto,
    curp: r.curp ?? '',
    telefono: r.telefono ?? '',
    correoElectronico: r.correoElectronico ?? '',
    domicilioCalle: r.domicilioCalle ?? '',
    domicilioColonia: r.domicilioColonia ?? '',
    domicilioCiudad: r.domicilioCiudad ?? '',
    activo: r.estatusCliente !== 'INACTIVO',
    prestamosActivos: r.prestamosActivos ?? undefined,
    saldoPendiente: r.saldoPendiente ?? undefined,
    conAtraso: r.conAtraso ?? undefined,
  };
}

interface EstadoLista {
  cargando: boolean;
  error: string | undefined;
  clientes: Cliente[];
}

/** Catálogo de clientes conectado a `/api/operaciones-cliente/*`. */
@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly http = inject(HttpClient);
  private readonly estado = signal<EstadoLista>({
    cargando: false,
    error: undefined,
    clientes: [],
  });

  readonly clientes = computed(() => this.estado().clientes);
  readonly cargando = computed(() => this.estado().cargando);
  readonly error = computed(() => this.estado().error);

  async cargar(): Promise<void> {
    this.estado.update((e) => ({ ...e, cargando: true, error: undefined }));
    try {
      const respuesta = await firstValueFrom(
        this.http.get<RespuestaApi<ClienteRespuesta[] | null>>(apiUrl(`${BASE}/cliente-lst`)),
      );
      const clientes = (respuesta.objetoResponse ?? []).map(aCliente);
      this.estado.set({ cargando: false, error: undefined, clientes });
    } catch (error) {
      this.estado.update((e) => ({
        ...e,
        cargando: false,
        error: mensajeDeError(error, 'No se pudo cargar la lista de clientes.'),
      }));
    }
  }

  /** Revisión rápida en pantalla; el back debe rechazar la CURP repetida de todos modos. */
  existeCurp(curp: string, excepto?: number): boolean {
    return this.clientes().some((c) => c.curp === curp && c.id !== excepto);
  }

  async agregar(datos: DatosCliente): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl(`${BASE}/cliente-agregar`), datos));
    await this.cargar();
  }

  async actualizar(id: number, datos: DatosCliente): Promise<void> {
    await firstValueFrom(this.http.put(apiUrl(`${BASE}/cliente-actualizar/${String(id)}`), datos));
    await this.cargar();
  }

  // Pendientes en el back: contrato en docs/API-CLIENTES.md.

  /** Deja al cliente inactivo; su historial se conserva. */
  async darDeBaja(id: number): Promise<void> {
    await firstValueFrom(this.http.put(apiUrl(`${BASE}/cliente-baja/${String(id)}`), null));
    await this.cargar();
  }

  async reactivar(id: number): Promise<void> {
    await firstValueFrom(this.http.put(apiUrl(`${BASE}/cliente-reactivar/${String(id)}`), null));
    await this.cargar();
  }
}
