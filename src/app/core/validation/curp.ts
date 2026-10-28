import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Estructura oficial de la CURP (RENAPO). El back debe volver a validarla siempre. */
const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}(\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])([HM])(AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QT|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}([A-Z\d])(\d)$/;

const DICCIONARIO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

function digitoVerificador(curp17: string): number {
  let suma = 0;
  for (let i = 0; i < curp17.length; i++) {
    suma += DICCIONARIO.indexOf(curp17.charAt(i)) * (18 - i);
  }
  return (10 - (suma % 10)) % 10;
}

export interface DatosCurp {
  fechaNacimiento: string;
  sexo: 'H' | 'M';
}

/** Obtiene fecha de nacimiento (yyyy-MM-dd) y sexo de una CURP válida (docs §4.2). */
export function extraerDatosCurp(curp: string): DatosCurp | undefined {
  const match = CURP_REGEX.exec(curp);
  if (!match) return undefined;
  const [, yy = '', mm = '', dd = '', sexo, , homoclave = ''] = match;
  // Homoclave numérica = nacido antes de 2000; letra = 2000 en adelante.
  const siglo = /\d/.test(homoclave) ? '19' : '20';
  return { fechaNacimiento: `${siglo}${yy}-${mm}-${dd}`, sexo: sexo === 'H' ? 'H' : 'M' };
}

export function esCurpValida(curp: string): boolean {
  if (!CURP_REGEX.test(curp)) return false;
  return digitoVerificador(curp.slice(0, 17)) === Number(curp.slice(17));
}

/** Quita espacios y pasa a mayúsculas. Aplicarlo al valor antes de enviarlo al back. */
export function normalizarCurp(valor: string): string {
  return valor.trim().toUpperCase();
}

/**
 * Validador para formularios reactivos: `new FormControl('', [Validators.required, curpValidator])`.
 * Errores: `{ curpLongitud: true }` → "La CURP debe tener 18 caracteres",
 * `{ curpInvalida: true }` → "La CURP no es válida". Un valor vacío lo resuelve `Validators.required`.
 */
export const curpValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  if (typeof control.value !== 'string' || control.value === '') return null;
  const curp = normalizarCurp(control.value);
  if (curp.length !== 18) return { curpLongitud: true };
  return esCurpValida(curp) ? null : { curpInvalida: true };
};
