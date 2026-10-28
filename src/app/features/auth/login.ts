import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@/core/auth/auth.service';

/** Solo se aceptan rutas internas para evitar redirecciones abiertas (`//sitio-malicioso.com`). */
function rutaSegura(ruta: string | undefined): string {
  return ruta?.startsWith('/') && !ruta.startsWith('//') ? ruta : '/';
}

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Ruta a la que se regresa después de entrar (query param `?desde=`). */
  readonly desde = input<string>();

  protected readonly form = new FormGroup({
    correo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(254)],
    }),
    contrasena: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(128)],
    }),
  });

  protected readonly enviado = signal(false);
  protected readonly enviando = signal(false);
  protected readonly error = signal<string | undefined>(undefined);

  protected async entrar(): Promise<void> {
    this.enviado.set(true);
    this.error.set(undefined);
    if (this.form.invalid) return;

    this.enviando.set(true);
    try {
      const { correo, contrasena } = this.form.getRawValue();
      await this.auth.iniciarSesion(correo, contrasena);
      await this.router.navigateByUrl(rutaSegura(this.desde()), { replaceUrl: true });
    } catch {
      // Mensaje genérico: no revelar si el correo existe (OWASP).
      this.error.set('Correo o contraseña incorrectos.');
    } finally {
      this.enviando.set(false);
    }
  }
}
