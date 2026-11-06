import { computed, Injectable, signal } from '@angular/core';
import { onIdTokenChanged, signInWithEmailAndPassword, signOut, type User } from '@firebase/auth';
import { borrarActividad, registrarActividad } from '@/core/auth/sesion';
import { getFirebaseAuth } from '@/core/firebase';

export type Rol = 'ADMIN' | 'CAJERO' | 'COBRADOR';

const ROLES_VALIDOS: readonly Rol[] = ['ADMIN', 'CAJERO', 'COBRADOR'];

interface EstadoAuth {
  cargando: boolean;
  usuario: User | null;
  /** Roles leídos de los custom claims del token. La autorización real la decide el back. */
  roles: Rol[];
  /** Cuándo se inició sesión con contraseña (`auth_time` del token, en ms); limita la sesión a 12 h. */
  inicioSesion: number | null;
}

function leerInicioSesion(authTime: string): number | null {
  const ms = Date.parse(authTime);
  return Number.isFinite(ms) ? ms : null;
}

function leerRoles(claim: unknown): Rol[] {
  if (!Array.isArray(claim)) return [];
  return claim.filter((rol): rol is Rol => ROLES_VALIDOS.includes(rol as Rol));
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = getFirebaseAuth();
  private readonly estado = signal<EstadoAuth>({
    cargando: true,
    usuario: null,
    roles: [],
    inicioSesion: null,
  });
  private readonly primerEstado: Promise<void>;

  readonly cargando = computed(() => this.estado().cargando);
  readonly usuario = computed(() => this.estado().usuario);
  readonly roles = computed(() => this.estado().roles);
  readonly inicioSesion = computed(() => this.estado().inicioSesion);

  constructor() {
    let resolver: () => void;
    this.primerEstado = new Promise((resolve) => (resolver = resolve));

    onIdTokenChanged(this.auth, (usuario) => {
      if (!usuario) {
        this.estado.set({ cargando: false, usuario: null, roles: [], inicioSesion: null });
        resolver();
        return;
      }
      void usuario.getIdTokenResult().then((token) => {
        this.estado.set({
          cargando: false,
          usuario,
          roles: leerRoles(token.claims['roles']),
          inicioSesion: leerInicioSesion(token.authTime),
        });
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
    // La inactividad empieza a contar desde el login, no desde la sesión anterior.
    registrarActividad(Date.now());
  }

  async cerrarSesion(): Promise<void> {
    borrarActividad();
    await signOut(this.auth);
  }
}
