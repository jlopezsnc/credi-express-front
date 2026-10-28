import { env } from '@env';

/**
 * Base de todas las llamadas al back. Los tipos de request/response vienen de `schema.d.ts`,
 * generado desde el OpenAPI del back (`npm run api:types`). Ejemplo en un servicio:
 *
 *   type Cliente = components['schemas']['ClienteDto'];
 *   this.http.get<Cliente[]>(apiUrl('/v1/clientes'));
 */
export function apiUrl(ruta: string): string {
  return `${env.apiBaseUrl}${ruta}`;
}

export function esUrlDeApi(url: string): boolean {
  return url === env.apiBaseUrl || url.startsWith(`${env.apiBaseUrl}/`);
}
