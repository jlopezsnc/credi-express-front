import { computed, Injectable, signal } from '@angular/core';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from '@firebase/auth';
import { getFirebaseAuth } from '@/core/firebase';

export type Rol = 'ADMIN' | 'CAJERO' | 'COBRADOR';

const ROLES_VALIDOS: readonly Rol[] = ['ADMIN', 'CAJERO', 'COBRADOR'];

interface EstadoAuth {
  cargando: boolean;
  usuario: User | null;
  /** Roles leídos de los custom claims del token. La autorización real la decide el back. */
  roles: Rol[];
}

function leerRoles(claim: unknown): Rol[] {
  if (!Array.isArray(claim)) return [];
  return claim.filter((rol): rol is Rol => ROLES_VALIDOS.includes(rol as Rol));
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getFirebaseAuth();
  private readonly estado = signal<EstadoAuth>({ cargando: true, usuario: null, roles: [] });
  private readonly primerEstado: Promise<void>;

  readonly cargando = computed(() => this.estado().cargando);
  readonly usuario = computed(() => this.estado().usuario);
  readonly roles = computed(() => this.estado().roles);

  constructor() {
    let resolver: () => void;
    this.primerEstado = new Promise((resolve) => (resolver = resolve));

    onIdTokenChanged(this.auth, (usuario) => {
      if (!usuario) {
        this.estado.set({ cargando: false, usuario: null, roles: [] });
        resolver();
        return;
      }
      void usuario.getIdTokenResult().then((token) => {
        this.estado.set({ cargando: false, usuario, roles: leerRoles(token.claims['roles']) });
        resolver();
      });
    });
  }

  /** Resuelve cuando Firebase terminó de restaurar la sesión (y sus roles) al abrir la app. */
  listo(): Promise<void> {
    return this.primerEstado;
  }

  /** El token de vida corta lo renueva el SDK cuando hace falta; nunca se guarda a mano. */
  obtenerToken(): Promise<string | undefined> {
    return this.auth.currentUser?.getIdToken() ?? Promise.resolve(undefined);
  }

  async iniciarSesion(correo: string, contrasena: string): Promise<void> {
    await signInWithEmailAndPassword(this.auth, correo, contrasena);
  }

  async cerrarSesion(): Promise<void> {
    await signOut(this.auth);
  }
}
