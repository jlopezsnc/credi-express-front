const AVATARES = [
  'bg-av0 text-av0-ink',
  'bg-av1 text-av1-ink',
  'bg-av2 text-av2-ink',
  'bg-av3 text-av3-ink',
  'bg-av4 text-av4-ink',
] as const;

/** Colores del avatar de un cliente: siempre los mismos para el mismo id. */
export function claseAvatar(idCliente: number): string {
  return AVATARES[Math.abs(idCliente) % AVATARES.length] ?? AVATARES[0];
}
