# API de reportes — contrato e implementación

Base: `http://localhost:8080/api/operaciones-reportes` (en el front: `apiUrl('/operaciones-reportes/...')`).

Estado al 2026-10-30: los 2 endpoints están implementados en el back, con pruebas unitarias y de
controller. **Falta probarlos contra MySQL real.** Pantalla: `src/app/features/reportes/`.

Alcance tomado de la propuesta (REVISION-BACK-Y-PROPUESTA-FRONT.md §4.2, punto 7): cobranza por
periodo, cartera vencida y exportación. La exportación es a **CSV** (Excel lo abre directo); PDF o
`.xlsx` quedan pendientes porque necesitan una librería.

| #   | Endpoint        | Lo usa la pantalla                 |
| --- | --------------- | ---------------------------------- |
| 1   | `GET cobranza`  | Pestaña "Cobranza por periodo"     |
| 2   | `GET cartera`   | Pestaña "Cartera"                  |

Convenciones (seguridad, sobre de respuesta, dinero como texto, "hoy" en hora de México): las
mismas de [API-COBRANZA.md §1](API-COBRANZA.md#1-convenciones).

---

## 1. `GET /cobranza`

| Parámetro | Tipo  | Obligatorio | Por defecto                                     |
| --------- | ----- | ----------- | ----------------------------------------------- |
| `desde`   | fecha | no          | Día 1 del mes de `hasta`                        |
| `hasta`   | fecha | no          | Hoy (o `desde`, si `desde` es posterior a hoy)  |

Ambos días incluidos. Cuenta por **fecha de registro** del pago (cuando entró el dinero a caja, igual
que "Cobrado hoy"), con los días en hora de México. Máximo **92 días**.

- `totales`, `porDia` y `porMetodo` solo suman pagos `VIGENTE`.
- `operaciones` trae también los cancelados, con su `estatus`; `cancelados` los resume aparte.
- Una operación es un **folio**: una liquidación (varios renglones de `pago`) es una sola, con
  `cuotaInicial`–`cuotaFinal`.
- `porDia` tiene un renglón por cada día del periodo, aunque no haya cobros; `porMetodo`, uno por
  cada método.

**200**

```json
{
  "objetoResponse": {
    "desde": "2026-10-01",
    "hasta": "2026-10-30",
    "totales": { "operaciones": 2, "importe": "2930.00", "recargo": "50.00", "totalRecibido": "2980.00" },
    "cancelados": { "operaciones": 1, "totalRecibido": "300.00" },
    "porDia": [
      { "fecha": "2026-10-01", "operaciones": 0, "importe": "0.00", "recargo": "0.00", "totalRecibido": "0.00" }
    ],
    "porMetodo": [{ "metodoPago": "EFECTIVO", "operaciones": 1, "totalRecibido": "760.00" }],
    "operaciones": [
      {
        "folio": "P-000240",
        "fechaRegistro": "2026-10-30T11:02:00-06:00",
        "fechaPago": "2026-10-30",
        "cliente": { "idCliente": 2, "nombreCompleto": "JOSÉ ANTONIO HERNÁNDEZ CRUZ", "telefono": null },
        "idPrestamo": 12,
        "cuotaInicial": 3,
        "cuotaFinal": 4,
        "totalCuotas": 8,
        "tipo": "LIQUIDACION",
        "metodoPago": "TRANSFERENCIA",
        "referencia": "998877",
        "importe": "2220.00",
        "recargo": "0.00",
        "totalRecibido": "2220.00",
        "registradoPor": "cobrador@ejemplo.com",
        "estatus": "VIGENTE"
      }
    ]
  },
  "httpStatus": "OK",
  "mensaje": "Reporte de cobranza."
}
```

**400**: `mensaje` "Revisa el periodo del reporte." con `campos`:

| Campo   | Cuándo                         | Mensaje                                              |
| ------- | ------------------------------ | ---------------------------------------------------- |
| `desde` | `desde` > `hasta`              | "La fecha inicial no puede ser posterior a la final." |
| `hasta` | más de 92 días                 | "El periodo no puede pasar de 92 días."              |
| `desde` / `hasta` | formato inválido     | "Usa el formato aaaa-mm-dd." (`mensaje` "Revisa los parámetros de la petición.") |

## 2. `GET /cartera`

Sin parámetros: foto de la cartera **al día de hoy**. Toma todas las cuotas con saldo
(`estado_pago` 1 o 2, menos sus abonos vigentes); una cuota cubierta por sus abonos no cuenta.

- `saldoVencido`: cuotas con `fechaVencimiento` < hoy. `saldoPorVencer` = `saldoTotal − saldoVencido`.
- `porcentajeVencido`: `saldoVencido / saldoTotal × 100`, con un decimal, como texto (`"35.0"`).
- `antiguedad`: el saldo vencido en rangos de días de atraso: 1–7, 8–15, 16–30, 31–60 y más de 60
  (`diasHasta: null`). Siempre los cinco.
- `clientesConAtraso`: del más atrasado al menos; a igual atraso, el que más debe vencido.
  `saldoTotal` es todo lo que debe el cliente (vencido y por vencer).

**200**

```json
{
  "objetoResponse": {
    "fecha": "2026-10-30",
    "totales": {
      "prestamosActivos": 2,
      "clientesActivos": 2,
      "clientesConAtraso": 1,
      "cuotasVencidas": 2,
      "saldoTotal": "4000.00",
      "saldoVencido": "1400.00",
      "saldoPorVencer": "2600.00",
      "porcentajeVencido": "35.0"
    },
    "antiguedad": [
      { "etiqueta": "1 a 7 días", "diasDesde": 1, "diasHasta": 7, "cuotas": 1, "saldo": "400.00" },
      { "etiqueta": "Más de 60 días", "diasDesde": 61, "diasHasta": null, "cuotas": 1, "saldo": "1000.00" }
    ],
    "clientesConAtraso": [
      {
        "cliente": { "idCliente": 1, "nombreCompleto": "ANA RUIZ", "telefono": null },
        "prestamos": 1,
        "cuotasVencidas": 2,
        "saldoVencido": "1400.00",
        "saldoTotal": "2400.00",
        "diasMaximoAtraso": 65,
        "vencimientoMasAntiguo": "2026-08-26"
      }
    ]
  },
  "httpStatus": "OK",
  "mensaje": "Reporte de cartera."
}
```

---

## 3. Implementación

**Back** (`com.crediexpress`):

| Capa | Clases |
| ---- | ------ |
| Controller | `ReporteController` (`/operaciones-reportes`). |
| Servicio | `ReporteService` / `ReporteServiceImpl` (solo lectura). |
| Lógica (`service/reporte`) | `PeriodoReporte` (valida y completa el periodo; solo existe si es válido), `ReporteCobranza` y `ReporteCartera` (arman cada reporte; sin base de datos, se prueban solos). |
| Datos | `PagoRepository` y `EstadoPrestamosRepository` ganan `findAll(Specification, Sort)` con `@EntityGraph` (cliente y préstamo en la misma consulta). Reutiliza `PagoSpecs`, `CuotaSpecs`, `SaldosCuotas` y `CobranzaMapper`. |

Volumen: los dos reportes se arman en memoria. El de cobranza está acotado a 92 días; el de cartera
lee todas las cuotas con saldo (una consulta) y sus abonos (otra). Si la cartera crece a decenas de
miles de cuotas, pasar los totales a consultas agregadas.

**Front** (`src/app/features/reportes/`): `reportes.ts` (pantalla), `reportes-vista.ts` (periodos,
validación, geometría de las gráficas y CSV), `reportes.service.ts`; `core/csv.ts` arma el CSV
(UTF-8 con BOM, CRLF y protección contra inyección de fórmulas). Las gráficas son SVG (la CSP no
permite estilos en línea); cada una tiene su tabla equivalente.
