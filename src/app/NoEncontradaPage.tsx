import { Link } from 'react-router';

export function NoEncontradaPage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <Link to="/" className="text-primary mt-4 inline-block underline">
        Volver al inicio
      </Link>
    </main>
  );
}
