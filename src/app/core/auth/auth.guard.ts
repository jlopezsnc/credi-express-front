import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService, type Rol } from '@/core/auth/auth.service';

/**
 * Exige sesión. Si se indican roles, el usuario necesita al menos uno (denegar por defecto).
 * Los roles del front solo ocultan pantallas; la autorización real la valida el back.
 */
export function requiereSesion(roles?: Rol[]): CanActivateFn {
  return async (_ruta, estado) => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.listo();

    if (!auth.usuario()) {
      const queryParams = estado.url === '/' ? {} : { desde: estado.url };
      return router.createUrlTree(['/login'], { queryParams });
    }
    if (roles && !roles.some((rol) => auth.roles().includes(rol))) {
      return router.createUrlTree(['/sin-permiso']);
    }
    return true;
  };
}

/** El login solo es para quien no tiene sesión. */
export const soloInvitados: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.listo();
  return auth.usuario() ? inject(Router).createUrlTree(['/']) : true;
};
