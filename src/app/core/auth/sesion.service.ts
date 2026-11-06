import { DOCUMENT, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@/core/auth/auth.service';
import {
  leerUltimaActividad,
  type MotivoCierre,
  motivoDeCierre,
  registrarActividad,
} from '@/core/auth/sesion';

/** Eventos que cuentan como actividad del usuario. */
const EVENTOS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
/** Cada cuánto se revisa sin que haya actividad (los navegadores lo espacian en segundo plano). */
const REVISION_MS = 15_000;
/** La actividad se guarda como máximo cada 5 s (mover el mouse dispara cientos de eventos). */
const GUARDADO_MS = 5_000;

/**
 * Cierra la sesión por inactividad (15 min) o por duración máxima (12 h). Lo arranca el layout con
 * sesión (`Shell`). Antes de contar una acción como actividad revisa si ya había vencido: regresar a
 * una pestaña olvidada no "revive" la sesión.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly documento = inject(DOCUMENT);

  /** Empieza a vigilar; devuelve la función para dejar de hacerlo. Al cerrar la sesión se detiene sola. */
  vigilar(): () => void {
    if (leerUltimaActividad() === undefined) registrarActividad(Date.now());

    let activo = true;
    let ultimoGuardado = 0;
    const opciones = { capture: true, passive: true };

    /** Regresa `true` si la sesión venció; en ese caso deja de vigilar y la cierra (una sola vez). */
    const revisar = (): boolean => {
      if (!activo) return true;
      const ahora = Date.now();
      const motivo = motivoDeCierre(
        ahora,
        leerUltimaActividad() ?? ahora,
        this.auth.inicioSesion(),
      );
      if (!motivo) return false;
      detener();
      void this.cerrar(motivo);
      return true;
    };
    const alActuar = (): void => {
      if (revisar()) return;
      const ahora = Date.now();
      if (ahora - ultimoGuardado >= GUARDADO_MS) {
        ultimoGuardado = ahora;
        registrarActividad(ahora);
      }
    };
    const alVolver = (): void => {
      if (this.documento.visibilityState === 'visible') revisar();
    };
    const intervalo = setInterval(revisar, REVISION_MS);
    const detener = (): void => {
      if (!activo) return;
      activo = false;
      for (const evento of EVENTOS) this.documento.removeEventListener(evento, alActuar, opciones);
      this.documento.removeEventListener('visibilitychange', alVolver);
      clearInterval(intervalo);
    };

    for (const evento of EVENTOS) this.documento.addEventListener(evento, alActuar, opciones);
    this.documento.addEventListener('visibilitychange', alVolver);
    revisar();
    return detener;
  }

  private async cerrar(motivo: MotivoCierre): Promise<void> {
    const desde = this.router.url;
    await this.auth.cerrarSesion();
    await this.router.navigate(['/login'], {
      queryParams: { motivo, ...(desde && desde !== '/' ? { desde } : {}) },
      replaceUrl: true,
    });
  }
}
