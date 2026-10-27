import { zodResolver } from '@hookform/resolvers/zod';
import { signInWithEmailAndPassword } from '@firebase/auth';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { useAuth } from '@/features/auth/auth-context';
import { getFirebaseAuth } from '@/lib/firebase';

const loginSchema = z.object({
  correo: z.email('Correo inválido').max(254),
  contrasena: z.string().min(1, 'Captura tu contraseña').max(128),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string>();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const destino = (location.state as { desde?: string } | null)?.desde ?? '/';
  if (usuario) return <Navigate to={destino} replace />;

  const onSubmit = async ({ correo, contrasena }: LoginForm) => {
    setError(undefined);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), correo, contrasena);
      void navigate(destino, { replace: true });
    } catch {
      // Mensaje genérico: no revelar si el correo existe (OWASP).
      setError('Correo o contraseña incorrectos.');
    }
  };

  return (
    <main className="mx-auto flex min-h-svh max-w-sm flex-col justify-center p-4">
      <h1 className="mb-6 text-2xl font-semibold">Iniciar sesión</h1>
      <form noValidate onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium">Correo</span>
          <input
            type="email"
            autoComplete="username"
            className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2"
            aria-invalid={errors.correo ? true : undefined}
            {...register('correo')}
          />
          {errors.correo && (
            <span className="text-destructive text-sm">{errors.correo.message}</span>
          )}
        </label>
        <label className="block">
          <span className="text-sm font-medium">Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2"
            aria-invalid={errors.contrasena ? true : undefined}
            {...register('contrasena')}
          />
          {errors.contrasena && (
            <span className="text-destructive text-sm">{errors.contrasena.message}</span>
          )}
        </label>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground w-full rounded-md px-4 py-2 font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
