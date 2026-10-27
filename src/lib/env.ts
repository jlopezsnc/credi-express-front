import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).default('/api'),
  VITE_FIREBASE_API_KEY: z.string().min(1),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1),
  VITE_FIREBASE_APP_ID: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

/** Falla rápido y con un mensaje claro si falta configuración (ver .env.example). */
export function loadEnv(source: Record<string, unknown> = import.meta.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const faltantes = result.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Configuración incompleta. Revisa .env.local: ${faltantes}`);
  }
  return result.data;
}
