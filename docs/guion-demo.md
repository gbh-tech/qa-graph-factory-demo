# Guion de la demo — Grafos de conocimiento aplicados a QA

Lámina 10: *Pasemos al ejercicio práctico.* Consultamos el grafo desde el Agentic IDE (Claude Code) y revisamos **la respuesta, la evidencia y sus límites**.

Preparación (antes de subir al escenario):
```bash
cd Projects/qa-graph-demo
npm run seed && npm run dev & npm run dev:web   # dashboard abierto en el navegador
open graphify-out/graph.html                     # grafo visual en otra pestaña
```

Este archivo es el **contrato de aceptación**: cada pregunta tiene una respuesta esperada. La Fase 4 pega aquí la salida real.

---

## Q1 — Impacto
**Pregunta:** ¿Qué pruebas debo correr si cambio `calculatePassRate()`?
**Comando:** `/graphify query "¿Qué pruebas dependen de calculatePassRate?"`
**Respuesta esperada:** `tests/unit/metrics.test.ts` (llamada directa) y `tests/integration/dashboard.api.test.ts` (prueba → `getDashboardSummary` → `calculatePassRate`, 2 saltos).
**Mensaje:** el grafo recorre función → llamadas → pruebas. Sin grafo, esto es leer imports a mano.
**Salida real:** _(Fase 4)_

## Q2 — Rutas de error sin cobertura
**Pregunta:** ¿Qué rutas de error no tienen cobertura?
**Comando:** `/graphify query "¿Qué clases de error se lanzan en el código y cuáles no son referenciadas por ninguna prueba?"`
**Respuesta esperada:** `ReportTooLargeError` — lanzado en `ingestReport`, exigido por REQ-003, sin ninguna prueba. `InvalidReportError` y `DuplicateRunError` sí están cubiertos.
**Salida real:** _(Fase 4)_

## Q3 — Trazabilidad
**Preguntas:**
1. ¿Qué requisito respalda la prueba de `detectFlakyTests`? → **REQ-004**.
2. ¿Qué requisitos no tienen pruebas? → **REQ-008** (`exportRunCsv`).
3. ¿Qué pruebas no respaldan ningún requisito? → la prueba de `formatDuration`.
**Comando:** `/graphify query "..."` y `/graphify explain "REQ-008"`
**Salida real:** _(Fase 4)_

## Q4 — Recorrido de un reporte
**Pregunta:** ¿Cómo llega un reporte desde `POST /api/runs` hasta la tabla `test_results`?
**Comando:** `graphify path "createRunHandler" "insertResults"`
**Respuesta esperada:** `createRunHandler` → `ingestReport` → `insertResults` (y `validateReport`, `insertRun` en el camino).
**Salida real:** _(Fase 4)_

## Q5 — Dónde está el riesgo
**Pregunta:** ¿Qué componentes concentran más dependencias?
**Comando:** abrir `graphify-out/GRAPH_REPORT.md` → sección *God nodes*.
**Respuesta esperada:** `getDb`, `TestResult`, `ingestReport` entre los primeros. Gancho: priorizar pruebas por riesgo.
**Salida real:** _(Fase 4)_

## Q6 — Los límites del grafo
**Pregunta:** ¿Quién llama a `parseJunitXml()`?
**Comando:** `/graphify query "¿Quién llama a parseJunitXml?"`
**Respuesta esperada:** el grafo solo muestra la prueba unitaria. **Pero** `ingestReport` lo usa vía el mapa dinámico `PARSERS[format]`. El análisis estático no ve el despacho dinámico → hay que revisar la evidencia (EXTRACTED vs INFERRED).
**Salida real:** _(Fase 4)_

## Q7 — Cuando el grafo sobra
**Pregunta:** ¿Dónde se define el timeout de ingesta?
**Comando:** `rg INGEST_TIMEOUT_MS`
**Respuesta esperada:** `src/server/config.ts`. Una búsqueda de texto basta (lámina 6, columna derecha).

## Q8 — Explicar un nodo
**Comando:** `graphify explain "detectFlakyTests"`
**Respuesta esperada:** quién la llama (`getDashboardSummary`), quién la prueba (`metrics.test.ts`), qué requisito la respalda (REQ-004).
**Salida real:** _(Fase 4)_

## Cambio en vivo
Rama `demo/live-change`: cambio en `classifyResult()`.
1. Preguntar al grafo qué pruebas dependen de `classifyResult`.
2. Correr solo esas: `npx vitest run <archivos>` → fallan.
3. Ajustar y correr la suite completa para confirmar.
_(Detalle en Fase 5)_

---
**Cierre (lámina 11):** ¿Qué pregunta de tu día a día sería más fácil de responder si pudieras consultar sus relaciones?
