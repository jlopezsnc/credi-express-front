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
        title: 'Inicio · Crédito Expres',
        loadComponent: () => import('@/features/inicio/inicio').then((m) => m.Inicio),
      },
      {
        path: 'clientes',
        title: 'Clientes · Crédito Expres',
        loadComponent: () => import('@/features/clientes/clientes').then((m) => m.Clientes),
      },
      {
        path: 'prestamos',
        title: 'Préstamos · Crédito Expres',
        loadComponent: () => import('@/features/prestamos/prestamos').then((m) => m.Prestamos),
      },
      {
        path: 'prestamos/nuevo',
        title: 'Nuevo préstamo · Crédito Expres',
        loadComponent: () =>
          import('@/features/prestamos/nuevo-prestamo').then((m) => m.NuevoPrestamo),
      },
      {
        path: 'convenios',
        title: 'Convenios · Crédito Expres',
        loadComponent: () => import('@/features/convenios/convenios').then((m) => m.Convenios),
      },
      {
        path: 'convenios/nuevo',
        title: 'Nuevo convenio · Crédito Expres',
        loadComponent: () =>
          import('@/features/convenios/nuevo-convenio').then((m) => m.NuevoConvenio),
      },
      {
        path: 'cobranza',
        title: 'Cobranza · Crédito Expres',
        loadComponent: () => import('@/features/cobranza/cobranza').then((m) => m.Cobranza),
      },
      {
        path: 'reportes',
        title: 'Reportes · Crédito Expres',
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
