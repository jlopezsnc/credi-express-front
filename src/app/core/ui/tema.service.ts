import { DOCUMENT, effect, inject, Injectable, signal } from '@angular/core';

export type Tema = 'claro' | 'oscuro';

const CLAVE = 'credi-express:tema';

function leerTemaGuardado(): Tema | undefined {
  try {
    const valor = localStorage.getItem(CLAVE);
    return valor === 'claro' || valor === 'oscuro' ? valor : undefined;
  } catch {
    return undefined;
  }
}

/** Tema claro/oscuro: respeta el del sistema hasta que el usuario elige uno. */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);

  readonly tema = signal<Tema>(
    leerTemaGuardado() ??
      (this.documento.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'oscuro'
        : 'claro'),
  );

  constructor() {
    effect(() => {
      this.documento.documentElement.classList.toggle('dark', this.tema() === 'oscuro');
    });
  }

  alternar(): void {
    const nuevo: Tema = this.tema() === 'oscuro' ? 'claro' : 'oscuro';
    this.tema.set(nuevo);
    try {
      // Solo la preferencia visual; nunca tokens ni datos personales.
      // eslint-disable-next-line no-restricted-properties
      localStorage.setItem(CLAVE, nuevo);
    } catch {
      // Navegación privada o almacenamiento bloqueado: el tema dura solo esta visita.
    }
  }
}
