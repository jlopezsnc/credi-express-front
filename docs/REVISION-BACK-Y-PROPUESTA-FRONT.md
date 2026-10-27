# srvc-credi-express: revisión del back y propuesta de front

> Fecha: 2026-10-22. Estado del proyecto: en desarrollo (back parcial, front inexistente).
> Este documento es una guía de mejoras, no una lista de errores definitivos.
>
> **Contexto:** proyecto independiente para un **emprendimiento** (no pertenece a una empresa grande ni usa herramientas corporativas). Aun así manejará **dinero y datos personales reales de clientes**, así que la seguridad no es opcional. Se despliega **manualmente** (sin integración git → GCP ni CI/CD) en **GKE**, dentro de contenedores, con **Java 21**. No se usan herramientas de escaneo ni de análisis externas (Sonar, Black Duck, Snyk, Dependency-Check, etc.), pero **sí** se exigen seguridad y buenas prácticas de nivel senior.

---

## 1. Back: problemas para atender ya

### 1.1 Seguridad y repositorio

- [ ] **Contraseña en el código:** `application.properties` tiene `root` / `masterkey`. No subirla al repo. Usar variables de entorno (`${DB_PASSWORD}`) y, en GCP, **Secret Manager**.
- [ ] **El `.gitignore` del primer commit ignora `src/`.** La versión modificada ya lo corrige, así que hay que hacerle commit.
- [ ] **`install.cmd` sobra en el repo:** es el instalador de Claude Code. Borrarlo o agregarlo al `.gitignore`.
- [ ] **La API no tiene autenticación** y expone CURP, teléfono y domicilio. Son datos personales protegidos por la LFPDPPP. Agregar Spring Security con JWT, o Firebase Auth / Identity Platform en GCP.

### 1.2 Errores de lógica

- [ ] **El dinero viaja como `Float`:** `importeCredito`, `tasaInteres`, `totalPagar` e `interesGenerado` en `CalculadoraPagosRequest`.
  - Al convertirlo con `BigDecimal.valueOf(float)` en `EstadoPrestamosServiceImpl.voToDto` entran decimales basura (1234.56 se guarda como 1234.56005859375).
  - Usar `BigDecimal` de punta a punta.
- [ ] **El cálculo del préstamo lo manda el front.** Hoy el cliente envía `importeCuota`, `totalPagar` e `interesGenerado` y el back los guarda tal cual.
  - El back debería recibir solo **monto, tasa, plazo y modalidad**, y calcular él la tabla de amortización.
  - Si no, cualquiera puede mandar la cuota que quiera.
- [ ] **Falta `@Transactional` en `guardarEstadoPrestamos`.**
  - Si falla en la cuota 7 de 12, quedan la calculadora y 6 cuotas a medias en la base.
  - Además, juntar las cuotas en una lista y guardarlas con `saveAll`.
- [ ] **Errores 500 posibles en `/calcular-pagos`:**
  - Si falta cualquier campo, truena con NullPointerException.
  - `Integer.valueOf(numeroCuota.toString())` revienta si llega `12.0`.
  - Si el `idModalidad` no existe, `modalidadRepository.getById` (deprecado) lanza `EntityNotFoundException`. Usar `findById(...).orElseThrow(...)` con un error claro.
- [ ] **`Objects.isNull(request)` en el controller nunca se cumple.** Spring ya responde 400 antes de llegar ahí cuando no hay body.
- [ ] **`ClienteServiceImpl.validarRequest`:**
  - Revienta con NullPointerException si un campo viene `null`.
  - Devuelve `true` cuando el request es *inválido*, lo que confunde.
  - Reemplazarlo por Bean Validation: `spring-boot-starter-validation`, `@Valid`, `@NotBlank` y un `@Pattern` para la CURP.
- [ ] **Fechas por días fijos:** la modalidad "mensual" sumando `diasActivos=30` se va desfasando del calendario. Usar `LocalDate.plusMonths()` / `plusWeeks()` / `plusDays()` según la modalidad.
- [ ] **`@OneToOne` hacia `Modalidad`** en `CalculadoraPrestamos` debería ser `@ManyToOne`, porque muchos préstamos comparten la misma modalidad.
- [ ] **`spring.jackson.date-format:"yyyy-MM-dd"`:** las comillas probablemente quedan como parte del valor. Quitarlas y revisar cómo salen las fechas en el JSON.
- [ ] **Log mal armado:** `log.info("... {} dias", diasIncremento + ". Fecha calculada {} " + fecha)` mezcla placeholders con concatenación. Debe ser `log.info("Incrementando {} días. Fecha calculada {}", dias, fecha)`.

### 1.3 Código muerto o incompleto

- [ ] `EstadoPrestamosServiceImpl.guardarEstadoPrestamo` (privado) no se usa, asigna `estadoPago` dos veces y la segunda con el valor equivocado.
- [ ] `EstadoPrestamosServiceImpl.dtoToVo` devuelve `null`.
- [ ] `ModalidadService` está vacío.

---

## 2. Back: diseño y mantenimiento

### 2.1 Estructura y modelo

- [ ] **Paquetes:** las entidades y los repositorios viven en `dto.entity` y `dto.repository`, y no son DTOs. Propuesta:
  ```
  com.crediexpress
  ├── CrediExpressApplication.java
  ├── api/            (controllers, dto/request, dto/response, exception handler)
  ├── domain/         (entidades JPA, enums)
  ├── repository/
  ├── service/
  └── config/         (seguridad, CORS, OpenAPI)
  ```
  Si la clase main queda en `com.crediexpress`, se pueden quitar `scanBasePackages`, `@EnableJpaRepositories`, `@EntityScan` y el `@EnableAutoConfiguration`, que de por sí sobra.
- [ ] **Fechas:** cambiar `java.sql.Date`, `java.util.Date` y `Calendar` por **`LocalDate`**.
- [ ] **Enums en lugar de valores sueltos:** `alerta = "VIGENTE"` y `estadoPago` como `Integer` quedarían mejor como `enum EstadoCuota { PENDIENTE, PAGADA, VENCIDA }` con `@Enumerated(EnumType.STRING)`.
- [ ] **Nombres de campos:**
  - En las entidades, `Cliente idCliente` debería llamarse `cliente` (y lo mismo con `idModalidad` e `idCalculadoraPrestamo`).
  - `numeroCuota` debería ser `Integer`, no `BigDecimal`.
- [ ] **Inyección:** unas clases usan constructor y otras `@Autowired` en campos. Unificar con constructor (`@RequiredArgsConstructor`).
- [ ] **Nombres del proyecto:** el group es `com.credito.expres`, el paquete `com.crediexpress` y la carpeta `srvc-credi-expres`. Conviene unificarlos.

### 2.2 API pensada para el front

- [ ] **Respuestas consistentes:**
  - Unos endpoints devuelven `GenericResponse` y otros listas sueltas. Elegir un solo formato.
  - Una lista vacía debe responder **200 con `[]`**, no 404 con body `null`.
  - Un `@RestControllerAdvice` centraliza los errores en un formato único (código, mensaje, campos con error).
- [ ] **URLs REST con versión:**

  | Hoy | Propuesta |
  |---|---|
  | `GET /operaciones-cliente/cliente-lst` | `GET /api/v1/clientes?search=&page=` |
  | `POST /operaciones-cliente/cliente-agregar` | `POST /api/v1/clientes` |
  | `GET /operaciones-prestamos/buscar-ep/{idCliente}` | `GET /api/v1/clientes/{id}/prestamos` |
  | `GET /operaciones-prestamos/buscar-ep/todo` | `GET /api/v1/cuotas?estado=&page=` |
  | `POST /operaciones-prestamos/calcular-pagos` | `POST /api/v1/prestamos` |

- [ ] **Endpoints que el front va a necesitar y que hoy no existen:**
  - `POST /api/v1/prestamos/simular`: calcula la tabla de amortización sin guardar nada.
  - `GET /api/v1/modalidades`: catálogo de modalidades.
  - `GET / PUT /api/v1/clientes/{id}`: detalle y edición, más validar que la CURP no se repita.
  - `POST /api/v1/cuotas/{id}/pagos`: registrar un pago, con cálculo de días moratorios.
  - `GET /api/v1/dashboard/resumen`: cartera activa, cobros de hoy, vencidos y morosidad.

### 2.3 Rendimiento

- [ ] `findAll()` sin paginación, más las relaciones EAGER por defecto, genera consultas N+1. Usar `Pageable` y `@EntityGraph` o un JOIN FETCH.
- [ ] `getEstadoPrestamosById` llama `findById` dos veces.

### 2.4 Configuración, base de datos y pruebas

- [ ] **Flyway** para versionar el esquema de la base (hoy `ddl-auto` está comentado y no hay scripts).
- [ ] Quitar `MySQL8Dialect`: está deprecado y Hibernate 6 lo detecta solo.
- [ ] Perfiles `application-dev.properties` y `application-prod.properties`, con `show-sql=true` solo en `dev`.
- [ ] **Tests:** el único que hay necesita MySQL arriba. Usar Testcontainers para MySQL y priorizar los tests de la tabla de amortización.
- [ ] **Documentación:** **springdoc-openapi** da Swagger UI, y además permite generar los tipos TypeScript del front.

---

## 3. Puesta en GCP

Despliegue **manual** en **GKE**, con back y front en contenedores.

### 3.1 Arquitectura

```
Internet ──HTTPS──> Ingress de GKE (certificado administrado por Google + Cloud Armor)
                     ├── /api/*  ──> Service crediexpress-back  ──> Pods Spring Boot (Java 21)
                     │                                               └─ sidecar Cloud SQL Auth Proxy ──> Cloud SQL (MySQL, IP privada)
                     └── /*      ──> Service crediexpress-front ──> Pods nginx (build estático del front)
```

- **GKE Autopilot:** pagas por los pods y no administras nodos. El crédito gratuito de GKE cubre la tarifa de administración de un clúster.
- **Front y back en el mismo dominio,** detrás del Ingress. Así se evita casi todo el problema de CORS y queda un solo certificado.
- **Cloud SQL (MySQL)** con IP privada, accedido a través del sidecar *Cloud SQL Auth Proxy*.
- **Workload Identity:** el pod usa una cuenta de servicio de GCP con permisos mínimos, sin archivos de llaves JSON.
- **Secretos:** van en **Secret Manager**, montados en el pod con el add-on de Secret Manager para GKE. No se guardan en manifiestos ni en la imagen. (Los `Secret` de Kubernetes solo están en base64, no cifrados.)
- **Artifact Registry** guarda las imágenes.

### 3.2 Contenedor del back (Java 21)

- **Dockerfile multi-stage:**
  - Etapa de build con `eclipse-temurin:21-jdk`, que ejecuta `./gradlew bootJar`.
  - Etapa final con `eclipse-temurin:21-jre` (o una imagen distroless de Java 21).
- **Usuario no root,** sin herramientas de más en la imagen final.
- **JVM adaptada al contenedor:** `-XX:MaxRAMPercentage=75`.
- **Imagen base con versión fija,** no `latest`.
- **Tags de la imagen por versión** (`0.1.0`, `0.1.1`…), nunca `latest`, para poder regresar a una versión anterior.
- **`.dockerignore`** para que no se cuelen `build/`, `.git` ni archivos de configuración local.

### 3.3 Manifiestos de Kubernetes (carpeta `k8s/`)

- **Para el back:** `Deployment`, `Service`, `ConfigMap` (config sin secretos) y `ServiceAccount` con Workload Identity.
- **Para el front:** `Deployment` y `Service` (nginx sin privilegios).
- **`Ingress` + `ManagedCertificate`,** y `BackendConfig` con política de Cloud Armor (rate limiting básico).
- **En cada Deployment:**
  - `resources.requests` y `resources.limits`.
  - `readinessProbe` y `livenessProbe` apuntando a `/actuator/health/readiness` y `/actuator/health/liveness`.
  - `securityContext`: `runAsNonRoot: true`, `readOnlyRootFilesystem: true`, `allowPrivilegeEscalation: false` y `capabilities.drop: [ALL]`.
- **`NetworkPolicy`:** el front no habla con la base de datos y solo el back sale hacia Cloud SQL.
- **Configuración de Spring:** el perfil `prod` se activa por variable de entorno (`SPRING_PROFILES_ACTIVE=prod`) y los logs salen en JSON para Cloud Logging.

### 3.4 Pasos del despliegue manual

Conviene guardarlos como script en `deploy/` (PowerShell) para no olvidar ningún paso:

1. `./gradlew clean build`. Si fallan los tests, **no se despliega**.
2. `docker build -t <region>-docker.pkg.dev/<proyecto>/crediexpress/back:<version> .`
3. `gcloud auth configure-docker <region>-docker.pkg.dev` (solo la primera vez) y luego `docker push ...`.
4. `gcloud container clusters get-credentials <cluster> --region <region>`.
5. Actualizar el tag de la imagen en el manifiesto y ejecutar `kubectl apply -f k8s/`.
6. Verificar con `kubectl rollout status deployment/crediexpress-back`. Si falla, regresar con `kubectl rollout undo`.

El front sigue los mismos pasos con su propia imagen nginx.

---

## 4. Propuesta de front

Contexto supuesto: financiera pequeña en México con cobranza diaria o semanal y cobradores en campo.

### 4.1 Stack sugerido

| Pieza | Opción |
|---|---|
| Framework | React + Vite + TypeScript (Angular si el equipo viene de Java empresarial) |
| Llamadas a la API | TanStack Query |
| Formularios y validación | React Hook Form + Zod |
| Componentes | MUI o shadcn/ui |
| Tipos de la API | Generados desde OpenAPI (springdoc) |
| Celular | PWA, para que los cobradores lo usen en el teléfono y aguante mala señal |
| Despliegue | Contenedor nginx sin privilegios en el mismo clúster GKE, detrás del mismo Ingress que el back |

### 4.2 Pantallas

1. **Login** con roles: admin, cajero y cobrador.
2. **Dashboard:**
   - Cartera activa, cobros de hoy, cuotas vencidas y porcentaje de morosidad.
   - Gráfica de lo cobrado contra lo esperado por semana.
3. **Clientes:**
   - Tabla con búsqueda por nombre o CURP.
   - Alta con validación de CURP en vivo (de ahí también se sacan la fecha de nacimiento y el sexo).
   - Ficha del cliente con su historial de préstamos.
4. **Nuevo préstamo, como asistente en pasos:**
   1. Elegir cliente.
   2. Capturar monto, modalidad, plazo y tasa.
   3. Ver la tabla de amortización en vivo, calculada por el endpoint `simular`.
   4. Confirmar y generar el contrato o pagaré en PDF.
5. **Detalle del préstamo:** línea de tiempo de cuotas con colores (verde pagada, amarillo próxima, rojo vencida) y saldo restante.
6. **Cobranza del día:**
   - Lista de cuotas que vencen hoy o están atrasadas.
   - Botón para registrar pago y recibo digital.
   - Enlace a WhatsApp con el recordatorio ya redactado.
   - Modo ruta para cobradores en campo, que funcione sin conexión.
7. **Reportes:** cartera vencida, cobranza por periodo y exportación a Excel o PDF.

### 4.3 Detalles de experiencia

- Montos con formato `$12,345.67 MXN`.
- Estados de carga y estados vacíos amables.
- Confirmación antes de cualquier acción que mueva dinero.
- Diseño pensado primero para el celular en las pantallas de cobranza.

---

## 5. Estándares obligatorios del código

Todo el código nuevo o refactorizado (back y front) debe cumplir con SOLID, con OWASP y con las prácticas de un desarrollador senior. Esta sección es la referencia para revisar cada cambio.

### 5.1 SOLID aplicado a este proyecto

| Principio | Qué significa aquí | Situación actual |
|---|---|---|
| **S**: responsabilidad única | El controller solo recibe, valida y responde. El service tiene la lógica de negocio. El mapper convierte. El calculador de amortización es su propia clase. | `EstadoPrestamosServiceImpl` guarda el préstamo, calcula fechas, genera cuotas y mapea, todo en una sola clase. El controller arma respuestas de negocio. |
| **O**: abierto/cerrado | Cada modalidad (diaria, semanal, quincenal, mensual) es una estrategia (`EstrategiaPeriodicidad`). Agregar una nueva no obliga a tocar el código existente. | Hoy todo depende de `diasActivos` sumado a mano. |
| **L**: sustitución de Liskov | Cualquier implementación de una interfaz debe respetar su contrato: mismas excepciones y sin devolver `null` cuando se espera un objeto. | `getEstadoPrestamosById` devuelve `null` y `dtoToVo` devuelve `null`. |
| **I**: segregación de interfaces | Interfaces pequeñas y con propósito, por ejemplo `CalculadoraAmortizacion` y `RegistroPagoService`, en lugar de un service gigante. | `ClienteService` expone `validarRequest`, que no es responsabilidad del service. |
| **D**: inversión de dependencias | Depender de interfaces e inyectar por constructor (campos `final`). | Hay `@Autowired` en campos. |

### 5.2 Seguridad OWASP

Referencias: **OWASP API Security Top 10 (2023)**, **OWASP Top 10** (web), **OWASP ASVS** como lista de verificación y **OWASP Cheat Sheet Series**.

| Riesgo (API Top 10) | Medida en credi-express |
|---|---|
| API1: autorización a nivel de objeto (BOLA) | Validar en el **service** que el usuario tenga permiso sobre ese cliente o préstamo, no solo que esté autenticado. Usar UUID públicos en lugar de IDs secuenciales en las URLs. |
| API2: autenticación rota | Spring Security con OAuth2 Resource Server y JWT (Firebase Auth / Identity Platform). Tokens de vida corta. Nada de sesiones caseras. |
| API3: autorización a nivel de propiedad | DTOs de entrada y salida separados de las entidades: nunca exponer ni recibir entidades JPA. Exponer la CURP enmascarada cuando no haga falta completa. |
| API4: consumo de recursos sin límite | Paginación obligatoria con tamaño máximo. Límites de tamaño en los requests. Rate limiting (Cloud Armor o Bucket4j). Límite de número de cuotas y de monto. |
| API5: autorización a nivel de función | Roles (`ADMIN`, `CAJERO`, `COBRADOR`) con `@PreAuthorize` en cada operación sensible. Denegar por defecto. |
| API6: flujos de negocio sensibles | Evitar préstamos o pagos duplicados con una idempotency key en `POST /prestamos` y `POST /pagos`. Auditar quién crea, paga y cancela. |
| API8: mala configuración | CORS solo para el dominio del front. Headers de seguridad. Sin stack traces en las respuestas. Actuator expuesto solo en `/health`. `show-sql` apagado en prod. |
| API9: inventario de APIs | Versionar (`/api/v1`). OpenAPI siempre actualizado. Swagger deshabilitado o protegido en prod. |
| API10: consumo inseguro de APIs | Validar y limitar las respuestas de terceros (por ejemplo una futura validación de CURP con RENAPO). |

**Reglas generales:**
- **Inyección:** solo JPA/JPQL con parámetros. Prohibido concatenar SQL.
- **Validación:** toda entrada pasa por Bean Validation (`@Valid`), con listas blancas y longitudes máximas.
- **Secretos:** nunca en el repo. En local van en variables de entorno y en GCP en Secret Manager. Revisar el historial de git y **cambiar la contraseña `masterkey`** si alguna vez se subió.
- **Datos personales (LFPDPPP):**
  - Cifrado en tránsito (TLS) y en reposo (Cloud SQL ya cifra).
  - No escribir CURP, teléfono ni correo en los logs.
  - Minimizar los datos que devuelve cada endpoint.
- **Errores:** usar `@RestControllerAdvice` con mensajes genéricos al cliente y el detalle solo en el log interno, con un `traceId`.
- **Logs y auditoría:** registrar eventos de seguridad (logins fallidos, accesos denegados) y de negocio (préstamo creado, pago registrado), en JSON y con un `traceId`.
- **Dependencias (sin escáneres):**
  - Usar pocas dependencias, todas conocidas y con versión fija (el BOM de Spring Boot las controla).
  - Subir Spring Boot de versión periódicamente, revisando a mano sus avisos de seguridad.
  - Usar imágenes base oficiales y mínimas, con tag fijo.
- **Front:**
  - Nada de `dangerouslySetInnerHTML`.
  - Content Security Policy.
  - Tokens administrados por el SDK de Firebase Auth, no guardados a mano en `localStorage`.
  - Validar en el front por usabilidad y **siempre** volver a validar en el back.

### 5.3 Prácticas de desarrollador senior

**Código**
- Nombres claros en español y consistentes (`cliente`, no `idCliente`, para una entidad). Cada método hace una sola cosa y es corto.
- Inmutabilidad: usar `record` de Java 21 para los DTOs de request y response, y campos `final`.
- `Optional` en lugar de `null`. Excepciones de dominio propias (`ClienteNoEncontradoException`, `ReglaNegocioException`) que el handler global traduce a HTTP.
- `BigDecimal` con `RoundingMode.HALF_EVEN` y escala fija para el dinero. `LocalDate` y `Clock` inyectable para las fechas, así se pueden probar.
- Mappers con **MapStruct** en lugar de builders manuales repetidos.
- Constantes y enums en lugar de valores sueltos (`"VIGENTE"`, `estadoPago = 1`).
- `@Transactional` en el service, y `readOnly = true` en las consultas.
- Nada de código muerto ni comentado. Los TODO van ligados a un ticket.

**Calidad y pruebas**
- Pruebas unitarias (JUnit 5 + Mockito + AssertJ) de toda la lógica de negocio, con prioridad en la amortización y las fechas.
- Pruebas de integración con Testcontainers (MySQL) y pruebas de controllers con `@WebMvcTest`.
- Cobertura mínima de 80% en el service, medida con JaCoCo.
- Formato automático con Spotless. Sin herramientas de análisis externas: la calidad se cuida con la Definición de terminado (5.4) y con revisión propia.
- En el front: ESLint, Prettier, TypeScript en `strict`, Vitest y Testing Library, y Playwright para los flujos críticos.

**Proceso**
- Git simple: ramas `feature/*` que se unen a `main`. Commits con *Conventional Commits* (`feat:`, `fix:`, `refactor:`).
- Despliegue manual con script (sección 3.4): tests, imagen versionada, push y `kubectl apply`. Si algo falla, no se despliega.
- Documentación: `README` con cómo levantar el proyecto, OpenAPI siempre actualizado y decisiones importantes registradas como ADR en `docs/adr/`.
- Observabilidad: health checks, métricas con Micrometer y logs estructurados.

### 5.4 Definición de terminado (checklist por cada cambio)

- [ ] Cumple SOLID (responsabilidad única, depende de interfaces, inyección por constructor).
- [ ] Toda la entrada está validada y los errores salen con el formato estándar.
- [ ] Revisa autorización (rol y dueño del recurso) y no expone datos de más.
- [ ] No hay secretos ni datos personales en el código ni en los logs.
- [ ] Tiene pruebas unitarias y de integración que pasan.
- [ ] `./gradlew build` (con tests) pasa en local antes de construir la imagen.
- [ ] Si cambió el contenedor o los manifiestos, sigue corriendo como no root, con sus límites de recursos y sin secretos en texto plano.
- [ ] OpenAPI y la documentación están actualizados.

---

## 6. Orden sugerido de trabajo

1. Sacar las credenciales del repo, hacer commit del `.gitignore` y borrar `install.cmd`.
2. Configurar la base de calidad: reestructurar los paquetes y agregar Spotless, JaCoCo y Testcontainers.
3. Cambiar el dinero a `BigDecimal`, las fechas a `LocalDate` y los DTOs a `record`. Pasar el cálculo al back (calculador de amortización con estrategias por modalidad) con el endpoint `/simular`.
4. Agregar `@Transactional`, Bean Validation, excepciones de dominio y el manejador global de errores.
5. Agregar Flyway y springdoc-openapi.
6. Agregar Spring Security (JWT y roles), CORS, headers de seguridad y auditoría, **antes** de exponer más endpoints.
7. Crear los endpoints faltantes (modalidades, detalle de cliente, registro de pagos con idempotencia, dashboard), cada uno con sus pruebas.
8. Crear el esqueleto del front: login, clientes y nuevo préstamo.
9. Contenerizar: Dockerfile del back (Java 21) y del front (nginx), manifiestos en `k8s/` y script de despliegue en `deploy/`.
10. Hacer el despliegue manual en GCP: Artifact Registry, Cloud SQL, GKE Autopilot, Secret Manager, Ingress con certificado y Cloud Armor.
