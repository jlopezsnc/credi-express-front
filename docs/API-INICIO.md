# API de Inicio

Actualizado: 2026-10-30. Pantalla: `/` (`src/app/features/inicio/`). Prototipo:
https://claude.ai/artifact/2Nt4AoQDvpmp6gzPy1WYDJ

| Endpoint                              | Estado               | Uso                                    |
| ------------------------------------- | -------------------- | -------------------------------------- |
| `GET /operaciones-inicio/resumen?mes` | ✅ Hecho (sin MySQL) | Resumen del mes y cartera al día de hoy |

## 1. Regla del diseño

Sin tablas nuevas ni procesos programados (decisión del usuario). Por eso:

- **El resumen del mes** solo trae cifras que se calculan exactas para cualquier mes con los datos
  que ya se guardan: cobrado, aplicado, esperado, cumplimiento, préstamos otorgados, liquidados y
  convenios.
- **La cartera** (saldo, vencido, clientes con atraso, próximos 7 días) es **al día de hoy** y no
  cambia con el mes: la cartera "al cierre" de un mes pasado no se puede reconstruir exacta sin una
  tabla de cierre.

## 2. `GET /resumen`

`mes` = `AAAA-MM` (opcional; sin él, el mes actual en hora de México). Un mes que no ha empezado →
400; un formato inválido → 400.

Reutiliza lo que ya existe, para que las cifras coincidan con Cobranza y Reportes:

| Cifra                                  | De dónde sale                                                      |
| -------------------------------------- | ------------------------------------------------------------------ |
| `cobrado` / `aplicado` y por semana    | `ReporteService.cobranza` (por fecha de registro, como Reportes)   |
| Cartera, vencido, clientes con atraso  | `ReporteService.cartera`                                           |
| Próximos 7 días                        | `CobranzaConsultaService.resumen`                                  |
| Esperado, otorgados, liquidados, convenios | `ResumenMesRepository` (SQL nuevo, sin tablas nuevas)          |

Respuesta (dinero como texto):

- `mes`, `enCurso`.
- `resumen` y `anterior` (el mes anterior completo), cada uno con:
  - `desde` y `corte`: hoy en el mes en curso o el último día en uno cerrado.
  - `cobrado`: lo que entró en caja, importe + recargo.
  - `aplicado`: lo que se aplicó a cuotas, sin recargos.
  - `esperado`: cuotas que vencían en el mes, sin las convenidas (4) ni las canceladas (5).
  - `esperadoALaFecha`.
  - `cumplimiento`: aplicado entre esperado a la fecha, en %. `null` si no se esperaba nada.
  - `otorgados` y `colocado`: sin los préstamos que genera un convenio.
  - `liquidados`, `convenios` (solo los vigentes) y `convenido`.
  - `semanas`: días 1–7, 8–14, 15–21, 22–28 y 29 al fin de mes, con `esperado`, `aplicado` y
    `cumplimiento`. Solo en `resumen`.
- `variaciones`: `cobrado`, `otorgados` y `convenios` contra el mes anterior, en %. `null` si el
  anterior fue 0.
- `hoy`: `cartera`, `vencido`, `porcentajeVencido`, `prestamosActivos`, `clientesConAtraso`,
  `proximos7Dias` (`{cuotas, importe}`) y `requierenAtencion`: los 5 clientes con más atraso, en el
  mismo formato que Reportes › Cartera.

## 3. Pantalla

- Selector de mes (no avanza más allá del mes actual).
- Cuatro cifras del mes con su variación. El color dice si es buena o mala noticia y el texto
  siempre lo dice también. Los convenios van sin color de juicio.
- Gráfica semanal de aplicado contra esperado (colores validados para daltonismo, en tema claro y
  oscuro), con detalle al pasar el cursor y "Ver como tabla".
- "Al día de hoy" y accesos rápidos.
