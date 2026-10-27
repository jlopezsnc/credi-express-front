import { onIdTokenChanged } from '@firebase/auth';
import { useEffect, useState, type ReactNode } from 'react';
import { AuthContext, type AuthState, type Rol } from '@/features/auth/auth-context';
import { getFirebaseAuth } from '@/lib/firebase';

const ROLES_VALIDOS: readonly Rol[] = ['ADMIN', 'CAJERO', 'COBRADOR'];

function leerRoles(claim: unknown): Rol[] {
  if (!Array.isArray(claim)) return [];
  return claim.filter((rol): rol is Rol => ROLES_VALIDOS.includes(rol as Rol));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<AuthState>({ cargando: true, usuario: null, roles: [] });

  useEffect(
    () =>
      onIdTokenChanged(getFirebaseAuth(), (usuario) => {
        if (!usuario) {
          setEstado({ cargando: false, usuario: null, roles: [] });
          return;
        }
        void usuario.getIdTokenResult().then((token) => {
          setEstado({ cargando: false, usuario, roles: leerRoles(token.claims['roles']) });
        });
      }),
    [],
  );

  return <AuthContext value={estado}>{children}</AuthContext>;
}
