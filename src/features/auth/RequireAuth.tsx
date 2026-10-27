import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth, type Rol } from '@/features/auth/auth-context';

interface Props {
  children: ReactNode;
  /** Si se indica, el usuario necesita al menos uno de estos roles. Denegar por defecto. */
  roles?: Rol[];
}

export function RequireAuth({ children, roles }: Props) {
  const { cargando, usuario, roles: rolesUsuario } = useAuth();
  const location = useLocation();

  if (cargando) return <p className="text-muted-foreground p-6">Cargando…</p>;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (roles && !roles.some((rol) => rolesUsuario.includes(rol))) {
    return <p className="p-6">No tienes permiso para ver esta sección.</p>;
  }
  return children;
}
