import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { env } from '@env';
import type { Recibo } from '@/features/cobranza/recibo';

/*
 * Recibo en PNG dibujado con canvas, sin librerías, del tamaño del diálogo en pantalla y a la
 * densidad de la pantalla (docs/API-COBRANZA.md §7.8). Siempre sale en colores claros, como papel.
 */

const PAPEL = {
  fondo: '#ffffff',
  texto: '#11201f',
  suave: '#566866',
  borde: '#e1e7e6',
  primario: '#0f766e',
  okFondo: '#dcf2e5',
  okTexto: '#14632f',
  avisoFondo: '#fef4dc',
  avisoTexto: '#7a4b00',
} as const;

const LETRA = "'Manrope Variable', system-ui, sans-serif";
const LETRA_MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
/** Los mismos trazos del ícono `marca`: es el logotipo temporal. */
const TRAZOS_LOGO = ['M17 7.5A6.5 6.5 0 1 0 17 16.5', 'M12 9.5v5M10 12h4'];
const TRAZO_PALOMITA = ['M5 12.5 10 17.5 19 7'];
const MARGEN = 24;
const ALTO_FILA = 30;

/** Dibuja y entrega el recibo. Es un servicio para poder sustituirlo en las pruebas (jsdom no tiene canvas). */
@Injectable({ providedIn: 'root' })
export class ReciboPng {
  private readonly documento = inject(DOCUMENT);

  /** `ancho` y `alto` en píxeles CSS (los del diálogo); el PNG sale a `devicePixelRatio`. */
  async crear(recibo: Recibo, ancho: number, alto: number): Promise<Blob> {
    const escala = Math.max(1, this.documento.defaultView?.devicePixelRatio ?? 1);
    const [logo] = await Promise.all([this.cargarLogo(), this.cargarLetras()]);
    return dibujar(this.documento, recibo, ancho, alto, escala, logo);
  }

  /** Descarga el archivo con su nombre. */
  descargar(url: string, archivo: string): void {
    const enlace = this.documento.createElement('a');
    enlace.href = url;
    enlace.download = archivo;
    enlace.hidden = true;
    this.documento.body.append(enlace);
    enlace.click();
    enlace.remove();
  }

  private cargarLogo(): Promise<HTMLImageElement | undefined> {
    const url = env.logoUrl.trim();
    if (!url) return Promise.resolve(undefined);
    return new Promise((resolver) => {
      const imagen = new Image();
      imagen.onload = () => {
        resolver(imagen);
      };
      // Si el logotipo configurado no carga, el recibo sale con el temporal.
      imagen.onerror = () => {
        resolver(undefined);
      };
      imagen.src = url;
    });
  }

  private async cargarLetras(): Promise<void> {
    const fuentes = this.documento.fonts as FontFaceSet | undefined;
    if (!fuentes) return;
    await Promise.all(
      [`500 14px ${LETRA}`, `700 14px ${LETRA}`, `800 20px ${LETRA}`, `500 13px ${LETRA_MONO}`].map(
        (f) => fuentes.load(f),
      ),
    ).catch(() => undefined);
  }
}

function dibujar(
  documento: Document,
  r: Recibo,
  ancho: number,
  altoPantalla: number,
  escala: number,
  logo: HTMLImageElement | undefined,
): Promise<Blob> {
  // Encabezado y confirmación (229) + filas + separador (17) + importes + saldo + nota + pie + margen.
  const contenido =
    229 +
    r.filas.length * ALTO_FILA +
    17 +
    r.importes.length * ALTO_FILA +
    ALTO_FILA +
    (r.nota ? 28 : 0) +
    62 +
    MARGEN;
  const alto = Math.max(Math.round(altoPantalla), contenido);

  const lienzo = documento.createElement('canvas');
  lienzo.width = Math.round(ancho * escala);
  lienzo.height = Math.round(alto * escala);
  const ctx = lienzo.getContext('2d');
  if (!ctx) return Promise.reject(new Error('El navegador no permite dibujar el recibo.'));
  ctx.scale(escala, escala);
  ctx.fillStyle = PAPEL.fondo;
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'alphabetic';

  // Encabezado: logotipo, negocio y folio.
  const anchoLogo = dibujarLogo(ctx, MARGEN, 20, 44, logo);
  texto(ctx, 'Credi Express', MARGEN + anchoLogo + 12, 40, `800 17px ${LETRA}`, PAPEL.texto);
  texto(ctx, 'Préstamos y cobranza', MARGEN + anchoLogo + 12, 57, `500 12px ${LETRA}`, PAPEL.suave);
  texto(ctx, 'RECIBO DE PAGO', ancho - MARGEN, 38, `700 11px ${LETRA}`, PAPEL.suave, 'right');
  texto(ctx, r.folio, ancho - MARGEN, 57, `500 13px ${LETRA_MONO}`, PAPEL.texto, 'right');
  ctx.fillStyle = PAPEL.borde;
  ctx.fillRect(0, 80, ancho, 1);

  // Confirmación.
  let y = 101;
  ctx.fillStyle = PAPEL.okFondo;
  ctx.beginPath();
  ctx.arc(ancho / 2, y + 20, 20, 0, Math.PI * 2);
  ctx.fill();
  trazos(ctx, TRAZO_PALOMITA, ancho / 2 - 11, y + 9, 22, PAPEL.okTexto, 1.8);
  texto(ctx, r.titulo, ancho / 2, y + 70, `800 20px ${LETRA}`, PAPEL.texto, 'center');
  texto(
    ctx,
    `Registrado el ${r.registro}`,
    ancho / 2,
    y + 92,
    `500 13px ${LETRA}`,
    PAPEL.suave,
    'center',
  );
  y += 128;

  const fila = (etiqueta: string, valor: string, fuerte: boolean): void => {
    ctx.font = (fuerte ? '700 16px ' : '500 14px ') + LETRA;
    const anchoEtiqueta = ctx.measureText(etiqueta).width;
    texto(ctx, etiqueta, MARGEN, y + 20, ctx.font, fuerte ? PAPEL.texto : PAPEL.suave);
    ctx.font = (fuerte ? '800 16px ' : '700 14px ') + LETRA;
    const disponible = ancho - 2 * MARGEN - anchoEtiqueta - 16;
    texto(
      ctx,
      recortar(ctx, valor, disponible),
      ancho - MARGEN,
      y + 20,
      ctx.font,
      PAPEL.texto,
      'right',
    );
    y += ALTO_FILA;
  };
  for (const f of r.filas) fila(f.etiqueta, f.valor, false);
  y += 6;
  ctx.fillStyle = PAPEL.borde;
  ctx.fillRect(MARGEN, y, ancho - 2 * MARGEN, 1);
  y += 11;
  for (const f of r.importes) fila(f.etiqueta, f.valor, f.fuerte);

  // Saldo como etiqueta de color.
  texto(ctx, r.saldoEtiqueta, MARGEN, y + 20, `500 14px ${LETRA}`, PAPEL.suave);
  ctx.font = `700 12px ${LETRA}`;
  const anchoPildora = ctx.measureText(r.saldo).width + 32;
  const xPildora = ancho - MARGEN - anchoPildora;
  ctx.fillStyle = r.liquidada ? PAPEL.okFondo : PAPEL.avisoFondo;
  ctx.beginPath();
  ctx.roundRect(xPildora, y + 4, anchoPildora, 24, 12);
  ctx.fill();
  const tinta = r.liquidada ? PAPEL.okTexto : PAPEL.avisoTexto;
  ctx.fillStyle = tinta;
  ctx.beginPath();
  ctx.arc(xPildora + 13, y + 16, 3, 0, Math.PI * 2);
  ctx.fill();
  texto(ctx, r.saldo, xPildora + 22, y + 20, ctx.font, tinta);
  y += ALTO_FILA;
  if (r.nota) {
    texto(ctx, r.nota, ancho / 2, y + 22, `700 14px ${LETRA}`, PAPEL.okTexto, 'center');
  }

  // Pie, pegado abajo.
  const pie = alto - MARGEN - 46;
  ctx.fillStyle = PAPEL.borde;
  ctx.fillRect(MARGEN, pie, ancho - 2 * MARGEN, 1);
  texto(
    ctx,
    'Gracias por su pago.',
    ancho / 2,
    pie + 24,
    `700 13px ${LETRA}`,
    PAPEL.texto,
    'center',
  );
  texto(
    ctx,
    'Conserve este recibo como comprobante.',
    ancho / 2,
    pie + 42,
    `500 12px ${LETRA}`,
    PAPEL.suave,
    'center',
  );

  return new Promise((resolver, rechazar) => {
    lienzo.toBlob((png) => {
      if (png) resolver(png);
      else rechazar(new Error('No se pudo crear la imagen.'));
    }, 'image/png');
  });
}

function texto(
  ctx: CanvasRenderingContext2D,
  contenido: string,
  x: number,
  y: number,
  fuente: string,
  color: string,
  alineacion: CanvasTextAlign = 'left',
): void {
  ctx.font = fuente;
  ctx.fillStyle = color;
  ctx.textAlign = alineacion;
  ctx.fillText(contenido, x, y);
}

/** Recorta con "…" lo que no cabe (nombres muy largos). */
function recortar(ctx: CanvasRenderingContext2D, contenido: string, maximo: number): string {
  if (ctx.measureText(contenido).width <= maximo) return contenido;
  let corto = contenido;
  while (corto.length > 1 && ctx.measureText(`${corto}…`).width > maximo)
    corto = corto.slice(0, -1);
  return `${corto}…`;
}

function trazos(
  ctx: CanvasRenderingContext2D,
  lista: readonly string[],
  x: number,
  y: number,
  lado: number,
  color: string,
  grosor: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(lado / 24, lado / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of lista) ctx.stroke(new Path2D(d));
  ctx.restore();
}

/** Logotipo configurado o el temporal; devuelve el ancho que ocupó. */
function dibujarLogo(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  alto: number,
  imagen: HTMLImageElement | undefined,
): number {
  if (imagen && imagen.naturalHeight > 0) {
    const ancho = Math.min(160, (alto * imagen.naturalWidth) / imagen.naturalHeight);
    ctx.drawImage(imagen, x, y, ancho, alto);
    return ancho;
  }
  ctx.fillStyle = PAPEL.primario;
  ctx.beginPath();
  ctx.roundRect(x, y, alto, alto, 12);
  ctx.fill();
  trazos(ctx, TRAZOS_LOGO, x + alto * 0.2, y + alto * 0.2, alto * 0.6, '#ffffff', 2.4);
  return alto;
}
