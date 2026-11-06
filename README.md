# credi-express-front

Front de la aplicación Crédito Expres: administración de préstamos y cobranza.
Diseño y estándares en [docs/REVISION-BACK-Y-PROPUESTA-FRONT.md](docs/REVISION-BACK-Y-PROPUESTA-FRONT.md).

## Stack

| Pieza             | Herramienta                                                        |
| ----------------- | ------------------------------------------------------------------ |
| Framework         | Angular 22 (standalone, signals, zoneless) + TypeScript (`strict`) |
| Rutas             | Angular Router (lazy loading + guards funcionales)                 |
| Llamadas a la API | `HttpClient` + interceptores (token y errores)                     |
| Tipos de la API   | Generados desde OpenAPI del back (springdoc + openapi-typescript)  |
| Formularios       | Reactive Forms                                                     |
| Estilos           | Tailwind CSS 4 (solo en `src/styles.css`)                          |
| Autenticación     | Firebase Auth / Identity Platform (`@firebase/auth`)               |
| PWA               | `@angular/service-worker`                                          |
| Calidad           | angular-eslint, Prettier, Vitest (`ng test`), Playwright           |
| Hosting           | Firebase Hosting (`/api/**` → Cloud Run del back)                  |

> No se usa Angular Material ni estilos por componente: Angular los inyecta como `<style>` en
> línea y obligaría a relajar la CSP con `style-src 'unsafe-inline'`.

## Requisitos

- Node.js 24 (`.nvmrc`) y npm 11.
- El back (`srvc-credi-express`) corriendo en `http://localhost:8080` para desarrollo.

## Levantar en local

```bash
npm ci
cp .env.example .env.local   # completar la configuración web de Firebase
npm start                    # http://localhost:4200 (proxy /api -> localhost:8080)
```

## Scripts

| Script                  | Qué hace                                                                    |
| ----------------------- | --------------------------------------------------------------------------- |
| `npm start`             | Servidor de desarrollo (`ng serve`)                                         |
| `npm run build`         | Genera `dist/` para producción                                              |
| `npm run check`         | Tipos + lint + formato + pruebas (obligatorio antes de desplegar)           |
| `npm test`              | Pruebas unitarias (`ng test`, Vitest)                                       |
| `npm run test:coverage` | Pruebas con cobertura                                                       |
| `npm run test:e2e`      | Pruebas e2e (Playwright). La primera vez: `npx playwright install chromium` |
| `npm run api:types`     | Regenera `src/app/core/api/schema.d.ts` desde `/v3/api-docs` del back       |
| `npm run format`        | Aplica Prettier                                                             |

`start`, `build` y `test` corren antes `scripts/generar-env.mjs`, que crea
`src/environments/env.ts` (ignorado en git) a partir de `.env.local` o de las variables del proceso.

## Estructura

```
src/
├── app/
│   ├── app.ts, app.config.ts, app.routes.ts   raíz, providers y rutas
│   ├── core/       auth (servicio + guards), api (interceptores, tipos), firebase, formatos, validaciones
│   └── features/   una carpeta por pantalla o dominio (auth, inicio, clientes, prestamos, cobranza…)
├── environments/   env.ts generado (no editar)
├── styles.css      Tailwind y tokens de tema
└── index.html
scripts/            generar-env.mjs
firebase.json       Firebase Hosting: rewrite de /api a Cloud Run, headers de seguridad (CSP) y caché
deploy/             script de despliegue manual (PowerShell)
e2e/                pruebas Playwright
```

Generar un componente nuevo: `npx ng g c features/clientes/lista-clientes` (ya sale sin hoja de
estilos y con `OnPush`). Importar con el alias `@/` (`@/core/auth/auth.service`).

## Seguridad (docs §5.2)

- CSP estricta sin `unsafe-inline` ni `unsafe-eval` (`firebase.json`). Por eso los
  componentes no llevan `styles`/`styleUrl` ni atributos `style="…"` (reglas de ESLint), y el build
  no incrusta CSS crítico (`inlineCritical: false` en `angular.json`).
- Prohibido `bypassSecurityTrust*` y `localStorage.setItem` (reglas de ESLint).
- La sesión la administra el SDK de Firebase (`sessionStorage`); `authInterceptor` adjunta el
  token solo a las llamadas a `/api`.
- Los roles del front solo ocultan pantallas (`requiereSesion(['ADMIN'])`); la autorización real
  siempre la valida el back.
- El service worker solo precachea el shell estático (`ngsw-config.json`); `/api` no se guarda.
- Solo las variables `NG_APP_*` llegan al navegador: nunca poner secretos ahí.

## Despliegue manual en Firebase Hosting

```powershell
# .env.production.local con la configuración web de Firebase de producción
npx firebase-tools@15.34.0 login     # solo la primera vez
.deploydeploy-front.ps1 -Version 0.1.0
```

El script corre `npm run check`, hace el build y lo publica con `firebase deploy --only hosting`.
Hosting sirve el front en `https://credi-express-app.web.app` y envía `/api/**` al servicio de
Cloud Run `crediexpress-back` (mismo origen: sin CORS). El back se despliega antes; ver
`docs/DESPLIEGUE-GCP.md` en su repo. Para revertir: Consola de Firebase > Hosting > historial.

## Convenciones

- Ramas `feature/*` hacia `main`, commits con Conventional Commits (`feat:`, `fix:`, `refactor:`).
- Montos: el back los envía como string decimal; mostrarlos con `formatearMoneda` (`$12,345.67 MXN`).
