// Genera src/environments/env.ts con la configuración pública del front.
// Lee .env.local (desarrollo) y las variables del proceso (Docker / CI), que tienen prioridad.
// Solo las variables NG_APP_* llegan al navegador: NUNCA poner aquí secretos de servidor.
//
// Uso: node scripts/generar-env.mjs [--sin-validar]
//   --sin-validar  permite valores vacíos (pruebas unitarias y revisión de tipos sin Firebase).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const archivoLocal = join(raiz, '.env.local');
const destino = join(raiz, 'src', 'environments', 'env.ts');
const sinValidar = process.argv.includes('--sin-validar');

const desdeArchivo = existsSync(archivoLocal) ? parseEnv(readFileSync(archivoLocal, 'utf8')) : {};
const leer = (nombre) => (process.env[nombre] ?? desdeArchivo[nombre] ?? '').trim();

const env = {
  apiBaseUrl: leer('NG_APP_API_BASE_URL') || '/api',
  firebase: {
    apiKey: leer('NG_APP_FIREBASE_API_KEY'),
    authDomain: leer('NG_APP_FIREBASE_AUTH_DOMAIN'),
    projectId: leer('NG_APP_FIREBASE_PROJECT_ID'),
    appId: leer('NG_APP_FIREBASE_APP_ID'),
  },
};

// Falla rápido y con un mensaje claro si falta configuración (ver .env.example).
const nombres = {
  apiKey: 'NG_APP_FIREBASE_API_KEY',
  authDomain: 'NG_APP_FIREBASE_AUTH_DOMAIN',
  projectId: 'NG_APP_FIREBASE_PROJECT_ID',
  appId: 'NG_APP_FIREBASE_APP_ID',
};
const faltantes = Object.entries(env.firebase)
  .filter(([, valor]) => !valor)
  .map(([clave]) => nombres[clave]);
if (faltantes.length > 0 && !sinValidar) {
  console.error(`Configuración incompleta. Revisa .env.local: ${faltantes.join(', ')}`);
  process.exit(1);
}

mkdirSync(dirname(destino), { recursive: true });
writeFileSync(
  destino,
  `// Archivo GENERADO por scripts/generar-env.mjs. No editar ni subir a git.
export const env = ${JSON.stringify(env, null, 2).replace(/"/g, "'")} as const;
`,
);
