import type { Routes } from '@angular/router';
import { requiereSesion, soloInvitados } from '@/core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [soloInvitados],
    loadComponent: () => import('@/features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [requiereSesion()],
    loadComponent: () => import('@/features/inicio/inicio').then((m) => m.Inicio),
  },
  {
    path: 'sin-permiso',
    loadComponent: () => import('@/features/errores/sin-permiso').then((m) => m.SinPermiso),
  },
  {
    path: '**',
    loadComponent: () => import('@/features/errores/no-encontrada').then((m) => m.NoEncontrada),
  },
];
