import { signal } from '@angular/core';
import { ordenar, paginar, paginasVisibles } from '@/core/tabla/tabla';
import { TablaLocal } from '@/core/tabla/tabla-local';
import { type PaginaApi, paginaDeApi, TablaRemota } from '@/core/tabla/tabla-remota';

interface Fila {
  nombre: string;
  saldo: number | undefined;
}

const FILAS: Fila[] = [
  { nombre: 'Óscar', saldo: 300 },
  { nombre: 'ana', saldo: undefined },
  { nombre: 'Beto', saldo: 1200 },
  { nombre: 'Cliente 10', saldo: 300 },
  { nombre: 'Cliente 9', saldo: 50 },
];

const CRITERIOS = { nombre: (f: Fila) => f.nombre, saldo: (f: Fila) => f.saldo };

describe('ordenar', () => {
  it('compara texto en español sin acentos ni mayúsculas, y los números dentro del texto', () => {
    const nombres = ordenar(FILAS, CRITERIOS, { columna: 'nombre', direccion: 'asc' }).map(
      (f) => f.nombre,
    );
    expect(nombres).toEqual(['ana', 'Beto', 'Cliente 9', 'Cliente 10', 'Óscar']);
  });

  it('los vacíos van al final en las dos direcciones y los empates conservan su orden', () => {
    const asc = ordenar(FILAS, CRITERIOS, { columna: 'saldo', direccion: 'asc' });
    expect(asc.map((f) => f.nombre)).toEqual(['Cliente 9', 'Óscar', 'Cliente 10', 'Beto', 'ana']);
    const desc = ordenar(FILAS, CRITERIOS, { columna: 'saldo', direccion: 'desc' });
    expect(desc.map((f) => f.nombre)).toEqual(['Beto', 'Óscar', 'Cliente 10', 'Cliente 9', 'ana']);
  });

  it('no modifica la lista original', () => {
    const copia = [...FILAS];
    ordenar(FILAS, CRITERIOS, { columna: 'nombre', direccion: 'desc' });
    expect(FILAS).toEqual(copia);
  });
});

describe('paginar', () => {
  const lista = Array.from({ length: 23 }, (_, i) => i + 1);

  it('corta la página y dice qué se muestra', () => {
    expect(paginar(lista, 2, 10)).toEqual({
      elementos: [21, 22, 23],
      pagina: 2,
      totalPaginas: 3,
      total: 23,
      desde: 21,
      hasta: 23,
    });
  });

  it('una página que ya no existe se convierte en la última', () => {
    expect(paginar(lista, 9, 10).pagina).toBe(2);
    expect(paginar([], 3, 10)).toMatchObject({ pagina: 0, totalPaginas: 1, desde: 0, hasta: 0 });
  });

  it('muestra las páginas vecinas con puntos suspensivos', () => {
    expect(paginasVisibles(0, 5)).toEqual([0, 1, 2, 3, 4]);
    expect(paginasVisibles(5, 10)).toEqual([0, null, 4, 5, 6, null, 9]);
    expect(paginasVisibles(0, 10)).toEqual([0, 1, 2, 3, null, 9]);
    expect(paginasVisibles(9, 10)).toEqual([0, null, 6, 7, 8, 9]);
  });
});

describe('TablaLocal', () => {
  it('alterna la dirección, cambia de columna y regresa a la primera página', () => {
    const datos = signal(
      Array.from({ length: 25 }, (_, i) => ({ nombre: `N${String(i)}`, saldo: i })),
    );
    const tabla = new TablaLocal<Fila, 'nombre' | 'saldo'>({
      datos: () => datos(),
      criterios: CRITERIOS,
      ordenInicial: { columna: 'saldo', direccion: 'asc' },
      tamano: 10,
    });
    tabla.irA(2);
    expect(tabla.pagina().elementos.map((f) => f.saldo)).toEqual([20, 21, 22, 23, 24]);

    tabla.ordenarPor('saldo');
    expect(tabla.orden()).toEqual({ columna: 'saldo', direccion: 'desc' });
    expect(tabla.pagina().pagina).toBe(0);
    expect(tabla.pagina().elementos[0]?.saldo).toBe(24);
    expect(tabla.ariaSort('saldo')).toBe('descending');
    expect(tabla.ariaSort('nombre')).toBe('none');

    tabla.ordenarPor('nombre');
    expect(tabla.orden()).toEqual({ columna: 'nombre', direccion: 'asc' });

    tabla.irA(1);
    datos.set(datos().slice(0, 15));
    expect(tabla.pagina().pagina).toBe(0);
  });
});

describe('TablaRemota', () => {
  it('arma la petición con orden y página, y vuelve a la página 0 al cambiar los filtros', () => {
    const filtro = signal('ACTIVOS');
    const respuesta = signal<PaginaApi<string> | undefined>(undefined);
    const tabla = new TablaRemota<'cliente' | 'saldo', string>({
      ordenInicial: { columna: 'cliente', direccion: 'asc' },
      reiniciarCon: () => filtro(),
      respuesta: () => respuesta(),
    });
    expect(tabla.peticion()).toEqual({
      orden: { columna: 'cliente', direccion: 'asc' },
      pagina: 0,
    });
    expect(tabla.pagina()).toMatchObject({ total: 0, totalPaginas: 1, desde: 0 });

    tabla.irA(2);
    expect(tabla.peticion().pagina).toBe(2);
    filtro.set('LIQUIDADOS');
    expect(tabla.peticion().pagina).toBe(0);

    tabla.irA(1);
    tabla.ordenarPor('saldo');
    expect(tabla.peticion()).toEqual({ orden: { columna: 'saldo', direccion: 'asc' }, pagina: 0 });
  });

  it('convierte la página del back para el paginador', () => {
    expect(
      paginaDeApi({
        contenido: ['a', 'b'],
        pagina: 2,
        tamano: 10,
        totalElementos: 22,
        totalPaginas: 3,
      }),
    ).toEqual({
      elementos: ['a', 'b'],
      pagina: 2,
      totalPaginas: 3,
      total: 22,
      desde: 21,
      hasta: 22,
    });
  });
});
