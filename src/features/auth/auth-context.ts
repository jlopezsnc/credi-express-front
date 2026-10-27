import { createContext, useContext } from 'react';
import type { User } from '@firebase/auth';

export type Rol = 'ADMIN' | 'CAJERO' | 'COBRADOR';

export interface AuthState {
  cargando: boolean;
  usuario: User | null;
  /** Roles leídos de los custom claims del token. La autorización real la decide el back. */
  roles: Rol[];
}

export const AuthContext = createContext<AuthState | undefined>(undefined);

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
