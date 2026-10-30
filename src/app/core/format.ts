const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

/**
 * Formatea montos como `$12,345.67 MXN`.
 * El back envía el dinero como string decimal (BigDecimal); no se hacen cálculos con él en el front.
 */
export function formatearMoneda(monto: string | number): string {
  const valor = typeof monto === 'string' ? Number(monto) : monto;
  if (!Number.isFinite(valor)) return '—';
  return `${formatoMoneda.format(valor)} MXN`;
}

/** Formatea una fecha ISO `yyyy-MM-dd` (LocalDate del back) sin desfases por zona horaria. */
export function formatearFecha(fechaIso: string): string {
  const fecha = new Date(`${fechaIso}T00:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return '—';
  return formatoFecha.format(fecha);
}

/** Iniciales para avatares: "María Fernanda López" → "MF". */
export function iniciales(nombre: string): string {
  const [primera = '', segunda = ''] = nombre.trim().split(/\s+/);
  return (primera.charAt(0) + segunda.charAt(0)).toUpperCase();
}

/** Para buscar sin importar acentos ni mayúsculas: "Martínez" → "martinez". */
export function normalizarTexto(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
