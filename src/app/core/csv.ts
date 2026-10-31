/*
 * Exportación a CSV que Excel abre directo: UTF-8 con BOM (para que respete los acentos), comas
 * y renglones con CRLF. Para PDF o .xlsx hace falta una librería (pendiente en docs/PENDIENTES.md).
 */

/** Marca de orden de bytes: le dice a Excel que el archivo viene en UTF-8. */
const BOM = String.fromCharCode(0xfeff);

export type Celda = string | number | null | undefined;

/**
 * Celdas que Excel interpretaría como fórmula (`=`, `+`, `-`, `@`, tabulador o retorno) llevan un
 * apóstrofo al inicio: evita la inyección de fórmulas con datos capturados (OWASP "CSV injection").
 */
function celda(valor: Celda): string {
  if (valor === null || valor === undefined) return '';
  let texto = String(valor);
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[",\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function aCsv(encabezados: readonly string[], filas: readonly (readonly Celda[])[]): string {
  return `${BOM}${[encabezados, ...filas].map((fila) => fila.map(celda).join(',')).join('\r\n')}\r\n`;
}

/** Descarga `contenido` como archivo con el nombre dado. */
export function descargarCsv(documento: Document, nombre: string, contenido: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
  const enlace = documento.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.hidden = true;
  documento.body.append(enlace);
  enlace.click();
  enlace.remove();
  // Se libera después: algunos navegadores leen el blob cuando ya terminó el clic.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
