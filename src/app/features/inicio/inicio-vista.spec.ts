import type { SemanaInicio } from '@/features/inicio/inicio-api';
import {
  detalleSemana,
  etiquetaMes,
  graficaSemanas,
  moverMes,
  nombreMes,
  variacion,
} from '@/features/inicio/inicio-vista';

function semana(
  numero: number,
  esperado: string,
  aplicado: string,
  cumplimiento: string | null,
): SemanaInicio {
  const desde = 1 + (numero - 1) * 7;
  const hasta = numero === 5 ? 31 : desde + 6;
  return {
    numero,
    desde: `2026-10-${String(desde).padStart(2, '0')}`,
    hasta: `2026-10-${String(hasta).padStart(2, '0')}`,
    esperado,
    aplicado,
    cumplimiento,
  };
}

describe('inicio-vista', () => {
  it('nombra y mueve meses, también al cambiar de año', () => {
    expect(etiquetaMes('2026-10')).toBe('Octubre 2026');
    expect(nombreMes('2026-09')).toBe('septiembre');
    expect(moverMes('2026-01', -1)).toBe('2025-12');
    expect(moverMes('2026-12', 1)).toBe('2027-01');
  });

  it('el texto de la variación dice si sube o baja; el tono, si conviene', () => {
    expect(variacion('12.5', 'septiembre', 'subir')).toEqual({
      texto: '▲ 12.5% vs septiembre',
      tono: 'bien',
    });
    expect(variacion('-7.8', 'septiembre', 'subir')).toEqual({
      texto: '▼ 7.8% vs septiembre',
      tono: 'mal',
    });
    expect(variacion('50.0', 'septiembre', 'nada').tono).toBe('neutra');
    expect(variacion(null, 'julio', 'subir')).toEqual({
      texto: 'Sin base en julio',
      tono: 'neutra',
    });
    expect(variacion('0.0', 'julio', 'subir').texto).toBe('= igual que julio');
  });

  it('la gráfica usa una sola escala, etiqueta las semanas y no dibuja barras vacías', () => {
    const g = graficaSemanas([
      semana(1, '18500.00', '17900.00', '96.8'),
      semana(2, '29800.00', '28100.00', '94.3'),
      semana(5, '0.00', '0.00', null),
    ]);

    expect(g.ticks.map((t) => t.texto)).toEqual(['$0', '$10k', '$20k', '$30k', '$40k']);
    expect(g.grupos.map((s) => s.etiqueta)).toEqual(['1–7', '8–14', '29–31']);
    expect(g.grupos[0]?.esperado).toMatch(/^M/);
    expect(g.grupos[2]?.esperado).toBe('');
    expect(g.grupos[2]?.aplicado).toBe('');
  });

  it('el detalle de una semana muestra el cumplimiento que calcula el back', () => {
    expect(detalleSemana(semana(1, '18500.00', '17900.00', '96.8'), '2026-10')).toEqual({
      titulo: 'Del 1 al 7 de octubre',
      esperado: '$18,500.00 MXN',
      aplicado: '$17,900.00 MXN',
      cumplimiento: '96.8%',
    });
    expect(detalleSemana(semana(5, '0.00', '0.00', null), '2026-10').cumplimiento).toBe('—');
  });
});
