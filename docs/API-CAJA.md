# API de caja: contrato e implementación

Pestaña **Reportes → Saldo de caja** (acordada el 2026-11-05). Dice cuánto dinero debe haber entre
efectivo y banco, porque el capital y los intereses que se cobran se vuelven a prestar.

```
saldo = capital aportado + cobrado − prestado − retirado
```

| Concepto | De dónde sale |
| --- | --- |
| Capital aportado | `movimiento_caja` tipo `APORTACION` vigente (incluye el capital inicial), por `fecha` |
| Cobrado | `pago` vigente: `importe + recargo`, por `fecha_pago`. Incluye lo cargado del Excel |
| Prestado | `calculadora_prestamos.importe_credito` (sin intereses), por `fecha_solicitud`. Sin los préstamos que genera un convenio |
| Retirado | `movimiento_caja` tipo `RETIRO` vigente, por `fecha` |

Tabla nueva: `movimiento_caja` (V9). Los movimientos no se borran: se cancelan con motivo.

Base: `/api/operaciones-caja`. Mismo sobre y errores que el resto de la API
(`docs/API-COBRANZA.md` §1). Dinero como texto decimal.

| # | Endpoint | Estado |
| --- | --- | --- |
| 1 | `GET /saldo?anio=` | ✅ Hecho (V9) |
| 2 | `GET /movimientos?pagina=&tamano=` | ✅ Hecho (V9) |
| 3 | `POST /movimiento-registrar` | ✅ Hecho (V9) |
| 4 | `PUT /movimiento-cancelar/{idMovimiento}` | ✅ Hecho (V9) |

## 1. `GET /saldo`

`anio` opcional (2000–2100); sin él, toda la historia. Los meses van del primero con movimientos al
mes actual, con ceros donde no hubo nada. El `acumulado` de cada mes siempre incluye todo lo
anterior, aunque se consulte un solo año.

```json
{
  "anio": 2026,
  "anios": [2025, 2026],
  "totales": { "aportado": "0.00", "cobrado": "3000.00", "prestado": "0.00", "retirado": "500.00", "neto": "2500.00" },
  "saldoInicial": "2000.00",
  "saldoFinal": "4500.00",
  "saldoActual": "4500.00",
  "meses": [
    { "mes": "2026-01", "aportado": "0.00", "cobrado": "3000.00", "prestado": "0.00", "retirado": "500.00", "neto": "2500.00", "acumulado": "4500.00" }
  ]
}
```

400 `"El año no es válido."` si `anio` está fuera de rango.

## 2. `GET /movimientos`

Paginado (`pagina` desde 0, `tamano` 1–100, por defecto 10), del más reciente al más antiguo, con los
cancelados. Cada elemento: `idMovimiento`, `tipo` (`APORTACION` | `RETIRO`), `importe`, `fecha`,
`concepto`, `estatus` (`VIGENTE` | `CANCELADO`), `registradoPor`, `fechaRegistro`, `canceladoPor`,
`fechaCancelacion`, `motivoCancelacion`.

## 3. `POST /movimiento-registrar`

```json
{ "tipo": "APORTACION", "importe": "50000", "fecha": "2026-11-05", "concepto": "Capital inicial" }
```

201 con el movimiento. 400 `"Revisa los datos del movimiento."` con `campos` si falta el tipo, el
importe no es mayor a cero o tiene más de dos decimales, la fecha es posterior a hoy o el concepto no
tiene de 3 a 200 caracteres. `registradoPor` sale del token.

## 4. `PUT /movimiento-cancelar/{idMovimiento}`

`{ "motivo": "Se capturó dos veces" }` (5–200 caracteres). 200 con el movimiento cancelado. 404
`"El movimiento no existe."`; 409 `"Este movimiento ya estaba cancelado."`.

## Pendiente de revisar con datos reales

- El préstamo 401 del Excel ($34,640 al 0%) es una reestructura y el P5 una renovación: hoy cuentan
  como dinero prestado. Si no salió dinero nuevo, el saldo sale más bajo de lo real.
- Del Excel solo vinieron los préstamos activos: lo cobrado y prestado en préstamos ya liquidados
  antes de la carga no está. Se puede compensar con una aportación o un retiro de ajuste.
