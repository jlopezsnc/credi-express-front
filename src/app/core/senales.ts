import { type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';

/** Tiempo que se espera a que el usuario deje de escribir antes de consultar al back. */
export const ESPERA_BUSQUEDA_MS = 300;

/**
 * Copia de `fuente` que cambia cuando deja de cambiar durante `ms` (para no consultar al back con
 * cada tecla). Debe crearse en un contexto de inyección (campo de un componente).
 */
export function conRetraso<T>(fuente: Signal<T>, ms = ESPERA_BUSQUEDA_MS): Signal<T> {
  return toSignal(toObservable(fuente).pipe(debounceTime(ms), distinctUntilChanged()), {
    initialValue: fuente(),
  });
}
