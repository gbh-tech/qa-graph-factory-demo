# Requisitos — TestPulse

TestPulse recibe reportes de ejecución de pruebas, los guarda y muestra un dashboard de calidad.
Cada requisito nombra las funciones que lo implementan. Esta es la fuente de trazabilidad requisito → código.

## REQ-001 — Ingesta de reportes JUnit XML
El sistema acepta reportes JUnit XML por `POST /api/runs`.
Implementado por `createRunHandler`, `ingestReport` y `parseJunitXml`.

## REQ-002 — Ingesta de reportes JSON
El sistema acepta reportes en formato JSON propio.
Implementado por `ingestReport` y `parseJsonReport`.

## REQ-003 — Validación de reportes
Un reporte sin ejecución o sin resultados se rechaza con `InvalidReportError`.
Una ejecución con un id ya existente se rechaza con `DuplicateRunError`.
Un reporte mayor a `MAX_REPORT_BYTES` se rechaza con `ReportTooLargeError`.
Implementado por `validateReport` e `ingestReport`.

## REQ-004 — Detección de pruebas inestables
Una prueba es inestable (flaky) si alterna entre aprobada y fallida al menos 2 veces en la ventana de 30 días y su tasa de fallo está entre 25 % y 85 % (por debajo es ruido; por encima, una falla real).
Implementado por `detectFlakyTests`.

## REQ-005 — Tasa de aprobación
La tasa de aprobación es aprobadas / (aprobadas + fallidas + errores). Las omitidas no cuentan.
Los estados crudos de cada herramienta se normalizan con `classifyResult`.
Implementado por `calculatePassRate` y `classifyResult`.

## REQ-006 — Tendencia de 30 días
El dashboard muestra la tasa de aprobación diaria de los últimos 30 días.
Implementado por `buildTrend`.

## REQ-007 — Resumen del dashboard
El dashboard muestra tasa de aprobación, total de ejecuciones, pruebas inestables, defectos abiertos y ejecuciones recientes.
Implementado por `getDashboardSummary`, `listRunsHandler` y `countOpenDefects`.

## REQ-008 — Exportar una ejecución a CSV
El usuario puede descargar los resultados de una ejecución en CSV desde `GET /api/runs/:id/export`.
Implementado por `exportRunCsv`.
