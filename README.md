# credi-express-front

Front de la aplicación Credi Express: administración de préstamos y cobranza.
Diseño y estándares en [docs/REVISION-BACK-Y-PROPUESTA-FRONT.md](docs/REVISION-BACK-Y-PROPUESTA-FRONT.md).

## Stack

| Pieza               | Herramienta                                            |
| ------------------- | ------------------------------------------------------ |
| Framework           | React 19 + Vite + TypeScript (`strict`)                |
| Rutas               | React Router                                           |
| Llamadas a la API   | TanStack Query + `openapi-fetch`                       |
| Tipos de la API     | Generados desde OpenAPI del back (springdoc)           |
| Formularios         | React Hook Form + Zod                                  |
| Estilos/componentes | Tailwind CSS 4 + shadcn/ui                             |
| Autenticación       | Firebase Auth / Identity Platform (`@firebase/auth`)   |
| PWA                 | `vite-plugin-pwa`                                      |
| Calidad             | ESLint, Prettier, Vitest + Testing Library, Playwright |
| Contenedor          | nginx sin privilegios (puerto 8080) en GKE             |

> Se eligió shadcn/ui (Tailwind, CSS estático) en lugar de MUI porque MUI inyecta estilos
> en línea y obligaría a relajar la CSP con `style-src 'unsafe-inline'`.

## Requisitos

- Node.js 24 (`.nvmrc`) y npm 11.
- El back (`srvc-credi-express`) corriendo en `http://localhost:8080` para desarrollo.

## Levantar en local

```bash
npm ci
cp .env.example .env.local   # completar la configuración web de Firebase
npm run dev                  # http://localhost:5173 (proxy /api -> localhost:8080)
```

## Scripts

| Script                  | Qué hace                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `npm run dev`           | Servidor de desarrollo                                                      |
| `npm run build`         | Revisa tipos y genera `dist/`                                               |
| `npm run check`         | Tipos + lint + formato + pruebas (obligatorio antes de desplegar)           |
| `npm test`              | Pruebas unitarias (Vitest)                                                  |
| `npm run test:coverage` | Pruebas con cobertura                                                       |
| `npm run test:e2e`      | Pruebas e2e (Playwright). La primera vez: `npx playwright install chromium` |
| `npm run api:types`     | Regenera `src/lib/api/schema.d.ts` desde `/v3/api-docs` del back            |
| `npm run format`        | Aplica Prettier                                                             |

## Estructura

```
src/
├── app/            providers, router, QueryClient
├── features/       una carpeta por pantalla o dominio (auth, clientes, prestamos, cobranza…)
├── components/ui/  componentes de shadcn/ui (npx shadcn@latest add button)
├── lib/            api (cliente + tipos generados), firebase, env, formatos, validaciones
└── test/           setup de Vitest
nginx/              configuración de nginx y headers de seguridad (CSP)
k8s/                Deployment, Service y NetworkPolicy del front
deploy/             script de despliegue manual (PowerShell)
e2e/                pruebas Playwright
```

## Seguridad (docs §5.2)

- CSP estricta sin `unsafe-inline` ni `unsafe-eval` (`nginx/security-headers.conf`). Si se agrega
  una librería que inyecte `<style>` o scripts en línea, hay que revisarla contra la CSP.
- Prohibido `dangerouslySetInnerHTML` y `localStorage.setItem` (regla de ESLint).
- La sesión la administra el SDK de Firebase (`sessionStorage`); el token se adjunta en cada
  llamada desde `src/lib/api/client.ts`.
- Los roles del front solo ocultan pantallas; la autorización real siempre la valida el back.
- El service worker solo precachea el shell estático; las respuestas de `/api` no se guardan.
- Solo las variables `VITE_*` llegan al navegador: nunca poner secretos ahí.

## Despliegue manual en GKE

```powershell
# .env.production.local con la configuración web de Firebase de producción
.\deploy\deploy-front.ps1 -Version 0.1.0 -Proyecto <proyecto> -Region <region> -Cluster <cluster>
```

El script corre `npm run check`, construye la imagen versionada, la sube a Artifact Registry,
aplica `k8s/` y espera el rollout (si falla, hace `rollout undo`). El `Ingress`,
`ManagedCertificate` y `BackendConfig` (Cloud Armor) son compartidos con el back:
`/api/*` → `crediexpress-back` y `/*` → `crediexpress-front` (puerto 80 del Service).

## Convenciones

- Ramas `feature/*` hacia `main`, commits con Conventional Commits (`feat:`, `fix:`, `refactor:`).
- Montos: el back los envía como string decimal; mostrarlos con `formatearMoneda` (`$12,345.67 MXN`).
