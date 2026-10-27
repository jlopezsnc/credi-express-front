import { createBrowserRouter } from 'react-router';
import { RequireAuth } from '@/features/auth/RequireAuth';
import { InicioPage } from '@/features/inicio/InicioPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { NoEncontradaPage } from '@/app/NoEncontradaPage';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <InicioPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <NoEncontradaPage /> },
]);
