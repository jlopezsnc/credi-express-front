import { DestroyRef, inject, Injectable, signal } from '@angular/core';

const DURACION_MS = 3200;
const DURACION_ERROR_MS = 6000;

export interface Aviso {
  tipo: 'exito' | 'error';
  mensaje: string;
}

/** Avisos breves ("toasts") que muestra el layout en la parte inferior. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  readonly aviso = signal<Aviso | undefined>(undefined);
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.temporizador);
    });
  }

  mostrar(mensaje: string): void {
    this.publicar({ tipo: 'exito', mensaje }, DURACION_MS);
  }

  /** Los errores duran más en pantalla para alcanzar a leerlos. */
  error(mensaje: string): void {
    this.publicar({ tipo: 'error', mensaje }, DURACION_ERROR_MS);
  }

  private publicar(aviso: Aviso, duracion: number): void {
    clearTimeout(this.temporizador);
    this.aviso.set(aviso);
    this.temporizador = setTimeout(() => {
      this.aviso.set(undefined);
    }, duracion);
  }
}
