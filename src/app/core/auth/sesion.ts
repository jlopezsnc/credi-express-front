import { isDevMode } from '@angular/core';

/** Sin actividad (mouse, teclado, toque o scroll) durante este tiempo, la sesión se cierra. */
export const INACTIVIDAD_MAXIMA_MS = 15 * 60 * 1000;
/** Desde que se inició sesión con contraseña. El back aplica el mismo límite (`seguridad.sesion-maxima`). */
export const SESION_MAXIMA_MS = 12 * 60 * 60 * 1000;

export type MotivoCierre = 'inactividad' | 'vencida';

export const MENSAJE_CIERRE: Record<MotivoCierre, string> = {
  inactividad: 'Tu sesión se cerró tras 15 minutos sin actividad. Vuelve a entrar.',
  vencida: 'Por seguridad, la sesión se cierra a las 12 horas. Vuelve a entrar.',
};

export function esMotivoCierre(valor: unknown): valor is MotivoCierre {
  return valor === 'inactividad' || valor === 'vencida';
}

/** ¿Hay que cerrar la sesión? `inicioSesion` es el `auth_time` del token (ms), si ya se conoce. */
export function motivoDeCierre(
  ahora: number,
  ultimaActividad: number,
  inicioSesion: number | null,
): MotivoCierre | undefined {
  if (inicioSesion !== null && ahora - inicioSesion >= SESION_MAXIMA_MS) return 'vencida';
  if (ahora - ultimaActividad >= INACTIVIDAD_MAXIMA_MS) return 'inactividad';
  return undefined;
}

const CLAVE = 'credi-express:ultima-actividad';

/**
 * Mismo almacén que la sesión de Firebase (`firebase.ts`): en producción sessionStorage (por pestaña)
 * y en desarrollo localStorage. Solo guarda una hora; nunca tokens ni datos personales. Así la
 * inactividad cuenta aunque se recargue la página.
 */
function almacen(): Storage | undefined {
  try {
    return isDevMode() ? localStorage : sessionStorage;
  } catch {
    return undefined;
  }
}

export function leerUltimaActividad(): number | undefined {
  try {
    const valor = Number(almacen()?.getItem(CLAVE));
    return Number.isFinite(valor) && valor > 0 ? valor : undefined;
  } catch {
    return undefined;
  }
}

export function registrarActividad(ahora: number): void {
  try {
    almacen()?.setItem(CLAVE, String(ahora));
  } catch {
    // Sin almacenamiento la inactividad solo se mide mientras la pestaña siga abierta.
  }
}

export function borrarActividad(): void {
  try {
    almacen()?.removeItem(CLAVE);
  } catch {
    // Nada que borrar.
  }
}
