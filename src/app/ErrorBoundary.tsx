import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Evita la pantalla en blanco ante un error no controlado. El detalle solo se muestra en desarrollo. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Error no controlado', error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main role="alert" className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-muted-foreground mt-2">
          {import.meta.env.DEV
            ? error.message
            : 'Ocurrió un error inesperado. Recarga la página o intenta más tarde.'}
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.reload();
          }}
          className="bg-primary text-primary-foreground mt-4 rounded-md px-4 py-2 font-medium"
        >
          Recargar
        </button>
      </main>
    );
  }
}
