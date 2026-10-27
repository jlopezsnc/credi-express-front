import { useAuth } from '@/features/auth/auth-context';

/** Marcador temporal: aquí irá el dashboard (docs §4.2). */
export function InicioPage() {
  const { usuario } = useAuth();
  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Credi Express</h1>
      <p className="text-muted-foreground mt-2">Sesión iniciada como {usuario?.email}</p>
    </main>
  );
}
