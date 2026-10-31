import type { Routes } from '@angular/router';
import { requiereSesion, soloInvitados } from '@/core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [soloInvitados],
    loadComponent: () => import('@/features/auth/login').then((m) => m.Login),
  },
  {
    // Pantallas con sesión: comparten el layout con menú lateral.
    path: '',
    canActivate: [requiereSesion()],
    loadComponent: () => import('@/layout/shell').then((m) => m.Shell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Inicio · Credi Express',
        loadComponent: () => import('@/features/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'clientes',
        title: 'Clientes · Credi Express',
        loadComponent: () => import('@/features/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'prestamos',
        title: 'Préstamos · Credi Express',
        loadComponent: () => import('@/features/prestamos/prestamos').then((m) => m.Prestamos),
      },
      {
        path: 'prestamos/nuevo',
        title: 'Nuevo préstamo · Credi Express',
        loadComponent: () =>
          import('@/features/prestamos/nuevo-prestamo').then((m) => m.NuevoPrestamo),
      },
      {
        path: 'cobranza',
        title: 'Cobranza · Credi Express',
        loadComponent: () => import('@/features/cobranza/cobranza').then((m) => m.Cobranza),
      },
      {
        path: 'reportes',
        title: 'Reportes · Credi Express',
        loadComponent: () => import('@/features/reportes/reportes').then((m) => m.Reportes),
      },
    ],
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
