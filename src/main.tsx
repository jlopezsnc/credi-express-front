import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ErrorBoundary } from '@/app/ErrorBoundary';
import { crearQueryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { AuthProvider } from '@/features/auth/AuthProvider';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root en index.html');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={crearQueryClient()}>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
        {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-left" />}
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);
