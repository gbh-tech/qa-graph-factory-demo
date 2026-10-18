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
**Salida real:**
```
# Comando: graphify path "metrics.test" "calculatePassRate"
Shortest path (1 hops):
  metrics.test.ts --imports [EXTRACTED]--> calculatePassRate()

# Comando: graphify path "dashboard.api.test" "calculatePassRate"
Shortest path (3 hops):
  dashboard.api.test.ts --imports_from [EXTRACTED]--> app.ts
    --imports [EXTRACTED]--> getDashboardSummary()
    --calls [EXTRACTED]--> calculatePassRate()
```
El grafo confirma las dos rutas de dependencia. La ruta de integración pasa por `app.ts` (3 saltos en lugar de 2) porque el test usa supertest contra el servidor HTTP, no importa `getDashboardSummary` directamente.

## Q2 — Rutas de error sin cobertura
**Pregunta:** ¿Qué rutas de error no tienen cobertura?
**Comando:** `/graphify query "¿Qué clases de error se lanzan en el código y cuáles no son referenciadas por ninguna prueba?"`
**Respuesta esperada:** `ReportTooLargeError` — lanzado en `ingestReport`, exigido por REQ-003, sin ninguna prueba. `InvalidReportError` y `DuplicateRunError` sí están cubiertos.
**Salida real:**
```
# Inspección del grafo: nodos de error y sus test_edges
ReportTooLargeError   → test_edges=0   ← sin cobertura
InvalidReportError    → test_edges=1   (unit_ingest_test imports)
DuplicateRunError     → test_edges=1   (unit_ingest_test imports)
```
Confirmado: solo `ReportTooLargeError` carece de prueba.

## Q3 — Trazabilidad
**Preguntas:**
1. ¿Qué requisito respalda la prueba de `detectFlakyTests`? → **REQ-004**.
2. ¿Qué requisitos no tienen pruebas? → **REQ-008** (`exportRunCsv`).
3. ¿Qué pruebas no respaldan ningún requisito? → la prueba de `formatDuration`.
**Comando:** `/graphify query "..."` y `/graphify explain "REQ-008"`
**Salida real:**
```
# graphify explain "Flaky Test Detection"
Node: REQ-004: Flaky Test Detection
  Connections: --> detectFlakyTests() [references] [EXTRACTED]

# graphify explain "Export Run to CSV"
Node: REQ-008: Export Run to CSV
  Connections: --> exportRunCsv() [references] [EXTRACTED]
               --> GET /api/runs/:id/export [references] [INFERRED]
# (no inbound test edges a exportRunCsv)

# graphify explain "detectFlakyTests"
  <-- metrics.test.ts [imports] [EXTRACTED]   ← prueba existe
  <-- REQ-004 [references] [EXTRACTED]         ← requisito existe

# formatDuration: solo metrics.test.ts la importa; sin REQ vinculado
```
REQ-008/exportRunCsv sin prueba; formatDuration con prueba pero sin REQ.

## Q4 — Recorrido de un reporte
**Pregunta:** ¿Cómo llega un reporte desde `POST /api/runs` hasta la tabla `test_results`?
**Comando:** `graphify path "createRunHandler" "insertResults"`
**Respuesta esperada:** `createRunHandler` → `ingestReport` → `insertResults` (y `validateReport`, `insertRun` en el camino).
**Salida real:**
```
# graphify path "createRunHandler" "insertResults"
Shortest path (2 hops):
  createRunHandler() --calls [EXTRACTED]--> ingestReport()
    --calls [EXTRACTED]--> insertResults()
```
Ruta confirmada. `validateReport` e `insertRun` aparecen en el mismo nivel de vecinos de `ingestReport`.

## Q5 — Dónde está el riesgo
**Pregunta:** ¿Qué componentes concentran más dependencias?
**Comando:** abrir `graphify-out/GRAPH_REPORT.md` → sección *God nodes*.
**Respuesta esperada:** `getDb`, `TestResult`, `ingestReport` entre los primeros. Gancho: priorizar pruebas por riesgo.
**Salida real:**
```
# graphify-out/GRAPH_REPORT.md → sección God Nodes
1. TestRun              - 12 edges
2. TestResult           - 12 edges
3. scripts              - 10 edges
4. getDashboardSummary()- 10 edges
5. ingestReport()       - 10 edges
```
`getDb` aparece en posición 7 (7 edges). `TestResult` e `ingestReport` confirmados. `TestRun` lidera por ser referenciado por múltiples repos y tipos.

## Q6 — Los límites del grafo
**Pregunta:** ¿Quién llama a `parseJunitXml()`?
**Comando:** `/graphify query "¿Quién llama a parseJunitXml?"`
**Respuesta esperada:** el grafo solo muestra la prueba unitaria. **Pero** `ingestReport` lo usa vía el mapa dinámico `PARSERS[format]`. El análisis estático no ve el despacho dinámico → hay que revisar la evidencia (EXTRACTED vs INFERRED).
**Salida real:**
```
# graphify query "parseJunitXml callers"
Traversal: BFS depth=2 | Start: ['parseJunitXml()'] | 4 nodes found
NODE parseJunitXml() [community=3]
EDGE parseJunitXml() --calls [EXTRACTED]--> extractTestcases()
EDGE parseJunitXml() --calls [EXTRACTED]--> propValue()
EDGE parseJunitXml() --calls [EXTRACTED]--> xmlAttr()

# Inbound edges al nodo (inspección manual del graph.json):
parsers_index         --imports-->  parsers_junit_parsejunitxml  [EXTRACTED]
unit_parsers_test     --imports-->  parsers_junit_parsejunitxml  [EXTRACTED]
docs_requisitos_req_001 --references--> parsers_junit_parsejunitxml [EXTRACTED]
```
`ingestReport` NO aparece como llamador — ciego al despacho dinámico `PARSERS[format]`.

## Q7 — Cuando el grafo sobra
**Pregunta:** ¿Dónde se define el timeout de ingesta?
**Comando:** `rg INGEST_TIMEOUT_MS`
**Respuesta esperada:** `src/server/config.ts`. Una búsqueda de texto basta (lámina 6, columna derecha).

## Q8 — Explicar un nodo
**Comando:** `graphify explain "detectFlakyTests"`
**Respuesta esperada:** quién la llama (`getDashboardSummary`), quién la prueba (`metrics.test.ts`), qué requisito la respalda (REQ-004).
**Salida real:**
```
# graphify explain "detectFlakyTests"
Node: detectFlakyTests()
  Source: src/server/services/metrics.ts L12
  Community: 4  Degree: 5

Connections (5):
  <-- dashboard.ts       [imports]    [EXTRACTED]
  <-- metrics.ts         [contains]   [EXTRACTED]
  <-- metrics.test.ts    [imports]    [EXTRACTED]
  <-- getDashboardSummary() [calls]   [EXTRACTED]
  <-- REQ-004: Flaky Test Detection [references] [EXTRACTED]
```
Respuesta completa: llamador, prueba y requisito — todo EXTRACTED.

## Cambio en vivo

**Historia:** producto decide que `pending` significa que el entorno
rompió antes de ejecutar la prueba, así que debe contar como `error`
(afecta la tasa de aprobación), no como `skipped`.

### Paso 1 — Preguntar al grafo qué pruebas debo correr

```
graphify explain "classifyResult"
```

Salida real (extracto):
```
Node: classifyResult()
  Source: src/server/services/ingest.ts L10  Community: 3  Degree: 6
Connections (6):
  <-- ingest.ts       [contains]   [EXTRACTED]
  <-- ingest.test.ts  [imports]    [EXTRACTED]   ← test directo
  <-- junit.ts        [imports]    [EXTRACTED]   ← parser lo llama
  <-- json.ts         [imports]    [EXTRACTED]   ← parser lo llama
  <-- POST /api/runs  [references] [EXTRACTED]
  <-- REQ-005         [references] [EXTRACTED]
```

```
graphify path "parsers.test" "classifyResult"
```

```
Shortest path (2 hops):
  parsers.test.ts --imports_from--> junit.ts --imports--> classifyResult()
```

**Conclusión del grafo:** correr `tests/unit/ingest.test.ts` (directo)
y `tests/unit/parsers.test.ts` (indirecto, 2 saltos vía parser).

### Paso 2 — Ir al commit donde el código cambió pero los tests no

```bash
git switch -d demo/live-change~1   # commit 1016712: feat: treat pending as error
```

### Paso 3 — Correr solo los archivos seleccionados → rojo

```bash
npx vitest run tests/unit/ingest.test.ts tests/unit/parsers.test.ts
```

Salida real:
```
 ❯ tests/unit/ingest.test.ts (30 tests | 1 failed)
   × normalises "pending" → skipped

AssertionError: expected 'error' to be 'skipped'
  Expected: "skipped"
  Received: "error"

 Test Files  1 failed | 1 passed (2)
     Tests   1 failed | 56 passed (57)
```

### Paso 4 — Avanzar al commit con los tests corregidos → verde

```bash
git switch demo/live-change        # commit 39c5e3c: test: update expectations
npx vitest run
```

```
 Test Files  5 passed (5)
     Tests   100 passed (100)
```

### Paso 5 — Volver a main

```bash
git switch main
```

---
**Cierre (lámina 11):** ¿Qué pregunta de tu día a día sería más fácil de responder si pudieras consultar sus relaciones?

---

## Notas de ensayo (Fase 4)

### Tamaño del grafo
178 nodos, 372 edges (en grafo dirigido), 13 comunidades. 165 nodos AST + 13 semánticos (8 REQ + 5 endpoints de api.md).

### Q1 — 3 saltos, no 2
El path de `dashboard.api.test` a `calculatePassRate` pasa por `app.ts` (3 hops: test → app.ts → getDashboardSummary → calculatePassRate). Esto ocurre porque el integration test usa supertest contra el servidor HTTP; nunca importa `getDashboardSummary` directamente. La afirmación "2 saltos" del guion es correcta en términos funcionales (el salto conceptual va a través de getDashboardSummary), pero el grafo muestra el salto de importación a app.ts. No se modificó el código porque el diseño es correcto.

### Q5 — TestRun lidera, no getDb
Los god nodes por grado (dirigido) son: TestRun=12, TestResult=12, scripts=10, getDashboardSummary=10, ingestReport=10. `getDb` aparece en posición 7 (7 edges). En el grafo no dirigido, `getDb` sería más prominente porque la dirección de `calls` lo separa. Ajuste de mensaje: mencionar TestRun/TestResult como las abstracciones más conectadas.

### Q6 — Blind spot confirmado
`ingestReport` no aparece como llamador de `parseJunitXml` porque el despacho es dinámico (`PARSERS[format](rawBody)`). Los bordes EXTRACTED solo muestran `unit_parsers_test` e `parsers_index`. La etiqueta EXTRACTED en el edge de `parsers_index` es correcta: el index.ts sí importa `parseJunitXml` explícitamente para construir el mapa.

### Q6 — Insight para ensayo: `graphify path "ingestReport" "parseJunitXml"`

Ejecutar este comando durante la demo produce:

```
Shortest path (2 hops):
  ingestReport() --references_from--> REQ-001: JUnit XML Report Ingestion
    --references--> parseJunitXml()
```

El camino más corto pasa por el nodo de **requisito** (REQ-001), no por el código.
El grafo une `ingestReport` y `parseJunitXml` porque ambos están nombrados en
`docs/requisitos.md`, no porque haya un `import` o `call` estático entre ellos.

Mensaje al público: leer la etiqueta del edge importa. Un borde `[references]`
entre dos funciones a través de un REQ es documentación, no una llamada en
tiempo de ejecución. La llamada real existe — vía `PARSERS[format]` — pero el
análisis estático no la ve. El grafo dice la verdad; el presentador debe leer
la evidencia antes de concluir.

### Edges INFERRED vs EXTRACTED
Todos los edges REQ→función son EXTRACTED (nombrados explícitamente en requisitos.md). Los edges REQ→endpoint son INFERRED (0.95) porque la relación es estructural pero no cita la URL. El edge del grafo que conecta REQ-008 con el endpoint de export es INFERRED.
