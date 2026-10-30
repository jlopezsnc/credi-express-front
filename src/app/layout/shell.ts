import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService, type Rol } from '@/core/auth/auth.service';
import { iniciales } from '@/core/format';
import { AvisosService } from '@/core/ui/avisos.service';
import { Icono, type NombreIcono } from '@/core/ui/icono';
import { TemaService } from '@/core/ui/tema.service';

interface Seccion {
  ruta: string;
  etiqueta: string;
  icono: NombreIcono;
}

const SECCIONES: readonly Seccion[] = [
  { ruta: '/', etiqueta: 'Inicio', icono: 'inicio' },
  { ruta: '/clientes', etiqueta: 'Clientes', icono: 'clientes' },
  { ruta: '/prestamos', etiqueta: 'Préstamos', icono: 'prestamos' },
  { ruta: '/cobranza', etiqueta: 'Cobranza', icono: 'cobranza' },
  { ruta: '/reportes', etiqueta: 'Reportes', icono: 'reportes' },
];

const NOMBRE_ROL: Record<Rol, string> = {
  ADMIN: 'Administrador',
  CAJERO: 'Cajero',
  COBRADOR: 'Cobrador',
};

/**
 * Layout de las pantallas con sesión: menú lateral (se contrae en escritorio y es un cajón en el
 * teléfono), cambio de tema, usuario con cierre de sesión y avisos.
 */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icono],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './shell.html',
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly tema = inject(TemaService);
  protected readonly avisos = inject(AvisosService);

  protected readonly secciones = SECCIONES;
  protected readonly colapsado = signal(false);
  protected readonly menuAbierto = signal(false);
  /** En el teléfono el menú cerrado queda `inert` para que el teclado no entre en él. */
  protected readonly esEscritorio = signal(false);

  protected readonly esOscuro = computed(() => this.tema.tema() === 'oscuro');
  protected readonly textoTema = computed(() => (this.esOscuro() ? 'Tema claro' : 'Tema oscuro'));

  protected readonly nombreUsuario = computed(() => {
    const usuario = this.auth.usuario();
    return usuario?.displayName ?? usuario?.email ?? '';
  });
  protected readonly inicialesUsuario = computed(() => {
    const usuario = this.auth.usuario();
    if (usuario?.displayName) return iniciales(usuario.displayName);
    return (usuario?.email ?? '').slice(0, 2).toUpperCase();
  });
  protected readonly rolUsuario = computed(() => {
    const rol = this.auth.roles()[0];
    return rol ? NOMBRE_ROL[rol] : 'Usuario';
  });

  constructor() {
    // Mismo corte que el prefijo `lg:` de Tailwind (64rem).
    const consulta = inject(DOCUMENT).defaultView?.matchMedia('(min-width: 64rem)');
    if (consulta) {
      this.esEscritorio.set(consulta.matches);
      const alCambiar = (evento: MediaQueryListEvent): void => {
        this.esEscritorio.set(evento.matches);
        if (evento.matches) this.menuAbierto.set(false);
      };
      consulta.addEventListener('change', alCambiar);
      inject(DestroyRef).onDestroy(() => {
        consulta.removeEventListener('change', alCambiar);
      });
    }
  }

  protected alternarColapso(): void {
    this.colapsado.update((valor) => !valor);
  }

  protected async cerrarSesion(): Promise<void> {
    await this.auth.cerrarSesion();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
