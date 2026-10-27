import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Las pantallas de cobranza se diseñan primero para el celular (docs §4.3).
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
    // Valores ficticios: las pruebas e2e no deben tocar el proyecto real de Firebase.
    env: {
      VITE_FIREBASE_API_KEY: 'e2e-api-key',
      VITE_FIREBASE_AUTH_DOMAIN: 'e2e.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'e2e',
      VITE_FIREBASE_APP_ID: 'e2e-app-id',
    },
  },
});
