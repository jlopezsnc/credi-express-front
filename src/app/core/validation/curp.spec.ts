import { FormControl } from '@angular/forms';
import {
  curpValidator,
  esCurpValida,
  extraerDatosCurp,
  normalizarCurp,
} from '@/core/validation/curp';

// CURPs ficticias con dígito verificador calculado (no corresponden a personas reales).
const CURP_SIGLO_XX = 'GOMJ850214HDFRRN07';
const CURP_SIGLO_XXI = 'PELA030721MJCRPNA9';

describe('CURP', () => {
  it('acepta una CURP con dígito verificador correcto', () => {
    expect(esCurpValida(CURP_SIGLO_XX)).toBe(true);
    expect(esCurpValida(CURP_SIGLO_XXI)).toBe(true);
  });

  it('rechaza una CURP con dígito verificador incorrecto', () => {
    expect(esCurpValida('GOMJ850214HDFRRN08')).toBe(false);
  });

  it('rechaza una CURP con fecha o estado inválidos', () => {
    expect(esCurpValida('GOMJ851314HDFRRN07')).toBe(false);
    expect(esCurpValida('GOMJ850214HXXRRN07')).toBe(false);
  });

  it('normaliza espacios y mayúsculas antes de validar', () => {
    expect(normalizarCurp(` ${CURP_SIGLO_XX.toLowerCase()} `)).toBe(CURP_SIGLO_XX);
    expect(curpValidator(new FormControl(` ${CURP_SIGLO_XX.toLowerCase()} `))).toBeNull();
  });

  it('reporta longitud o CURP inválida en el validador', () => {
    expect(curpValidator(new FormControl('GOMJ85'))).toEqual({ curpLongitud: true });
    expect(curpValidator(new FormControl('GOMJ850214HDFRRN08'))).toEqual({ curpInvalida: true });
    expect(curpValidator(new FormControl(''))).toBeNull();
  });

  it('extrae fecha de nacimiento y sexo según el siglo de la homoclave', () => {
    expect(extraerDatosCurp(CURP_SIGLO_XX)).toEqual({ fechaNacimiento: '1985-02-14', sexo: 'H' });
    expect(extraerDatosCurp(CURP_SIGLO_XXI)).toEqual({ fechaNacimiento: '2003-07-21', sexo: 'M' });
  });
});
