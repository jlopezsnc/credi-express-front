import { formatearFecha, formatearMoneda, iniciales, normalizarTexto } from '@/core/format';

describe('formatearMoneda', () => {
  it('usa el formato $12,345.67 MXN', () => {
    expect(formatearMoneda('12345.67')).toBe('$12,345.67 MXN');
    expect(formatearMoneda(0)).toBe('$0.00 MXN');
  });

  it('muestra un guion si el valor no es numérico', () => {
    expect(formatearMoneda('abc')).toBe('—');
  });
});

describe('formatearFecha', () => {
  it('no se desfasa un día por la zona horaria', () => {
    expect(formatearFecha('2026-01-31')).toContain('31');
  });

  it('muestra un guion si la fecha es inválida', () => {
    expect(formatearFecha('no-es-fecha')).toBe('—');
  });
});

describe('iniciales', () => {
  it('toma la primera letra de las dos primeras palabras', () => {
    expect(iniciales('María Fernanda López Ruiz')).toBe('MF');
    expect(iniciales('  ana  ')).toBe('A');
  });
});

describe('normalizarTexto', () => {
  it('quita acentos y pasa a minúsculas', () => {
    expect(normalizarTexto('Martínez ÁNGEL')).toBe('martinez angel');
  });
});
