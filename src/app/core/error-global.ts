import { type ErrorHandler, Injectable, signal } from '@angular/core';

/** Recibe los errores no controlados; `App` muestra una pantalla de error en lugar de quedar en blanco. */
@Injectable({ providedIn: 'root' })
export class ErrorGlobal implements ErrorHandler {
  readonly error = signal<unknown>(undefined);

  handleError(error: unknown): void {
    console.error('Error no controlado', error);
    this.error.set(error ?? new Error('Error desconocido'));
  }
}
